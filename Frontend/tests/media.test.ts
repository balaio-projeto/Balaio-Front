import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { encaminharApi } from '../src/services/api/proxy'
import { obterArtesao, obterMeuAtelie, enviarImagemPerfil } from '../src/services/api/artesaos.servico'
import { validarFoto } from '../src/utils/foto'
import { buscar } from '../src/services/api/cliente'

const bytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
const perfil = { id: randomUUID(), slug: 'artesao-real', nome: 'Artesao real', atelie: 'Atelie real', historia: '', territorio: '', tecnica: '', imagem: '/fotos/ImagemBase.webp' }
const eventos: { destino: string; caminho: string; metodo: string; cookie?: string; authorization?: string; origem?: string; tipo?: string; bytes: Buffer }[] = []
let imagem = perfil.imagem
let falhar = false
let multipartRecebido: FormData | null = null
const servidores = ['gateway', 'fake'].map((destino) => createServer(async (req, res) => {
  const partes: Buffer[] = []
  for await (const parte of req) partes.push(Buffer.from(parte))
  const corpo = Buffer.concat(partes)
  eventos.push({ destino, caminho: req.url!, metodo: req.method!, cookie: req.headers.cookie, authorization: req.headers.authorization, origem: req.headers.origin, tipo: req.headers['content-type'], bytes: corpo })
  const json = (status: number, dados: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ dados, erro: status >= 400 ? { codigo: 'FALHA_TESTE', mensagem: 'Falha controlada.' } : null }))
  }
  if (req.url!.startsWith('/api/v1/arquivos/perfis/')) {
    if (req.url !== imagem) return json(404, null)
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(req.method === 'HEAD' ? undefined : bytes)
    return
  }
  if (req.url === '/api/v1/artesao/me/imagem') {
    if (falhar) return json(503, null)
    if (req.method === 'PUT') {
      multipartRecebido = await new Request('http://fixture.test/upload', { method: 'PUT', headers: { 'Content-Type': req.headers['content-type']! }, body: corpo }).formData()
      imagem = `/api/v1/arquivos/perfis/${randomUUID()}`
    } else imagem = perfil.imagem
  }
  json(200, { ...perfil, imagem })
}))

before(async () => {
  for (const servidor of servidores) await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  const base = (i: number) => `http://127.0.0.1:${(servidores[i].address() as { port: number }).port}/api/v1`
  process.env.API_GATEWAY_URL = base(0)
  process.env.API_URL = base(1)
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})
beforeEach(() => { eventos.length = 0; imagem = perfil.imagem; falhar = false; multipartRecebido = null })
after(async () => { for (const servidor of servidores) await new Promise<void>((resolve) => servidor.close(() => resolve())) })

function requisicao(caminho: string, metodo = 'GET', body?: BodyInit, headers: HeadersInit = {}) {
  return new Request(`http://localhost:4321/api/v1${caminho}`, { method: metodo, body, headers })
}
function arquivo() { return new File([bytes], 'teste.webp', { type: 'image/webp' }) }
function form() { const dados = new FormData(); dados.append('arquivo', arquivo()); return dados }
const credenciais = { Cookie: 'balaio_sessao=sessao-fixture; balaio_cliente=visitante; balaio_demo_sessao=antiga', Origin: 'http://localhost:4321' }

test('consultas privadas e publicas usam o perfil real no servidor', async () => {
  assert.equal((await obterMeuAtelie()).dados?.id, perfil.id)
  assert.equal((await obterArtesao(perfil.slug)).dados?.slug, perfil.slug)
  assert.ok(eventos.every((evento) => evento.destino === 'gateway'))
})

test('cliente envia FormData com boundary automatico e bytes originais', async () => {
  const resposta = await enviarImagemPerfil(arquivo())
  assert.equal(resposta.dados?.imagem, imagem)
  assert.match(eventos[0].tipo!, /^multipart\/form-data; boundary=/)
  const recebida = multipartRecebido!.get('arquivo') as File
  assert.equal(recebida.name, 'teste.webp')
  assert.deepEqual(Buffer.from(await recebida.arrayBuffer()), bytes)
})

test('consulta autenticada no servidor preserva Bearer em Headers', async () => {
  await buscar('/artesao/me', { headers: new Headers({ Authorization: 'Bearer token-fixture' }) })
  assert.equal(eventos[0].authorization, 'Bearer token-fixture')
  assert.equal(eventos[0].tipo, 'application/json')
})

test('proxy preserva multipart, cookie HttpOnly e Origin somente para o gateway', async () => {
  const request = requisicao('/artesao/me/imagem', 'PUT', form(), credenciais)
  const tipo = request.headers.get('Content-Type')
  const resposta = await encaminharApi(request)
  assert.equal(resposta.status, 200)
  assert.equal(eventos[0].tipo, tipo)
  assert.equal(eventos[0].cookie, 'balaio_sessao=sessao-fixture')
  assert.equal(eventos[0].origem, credenciais.Origin)
  assert.ok(eventos.every((evento) => evento.destino === 'gateway'))
  assert.deepEqual(Buffer.from(await (multipartRecebido!.get('arquivo') as File).arrayBuffer()), bytes)
})

test('substituicao invalida URL anterior e remocao devolve placeholder', async () => {
  const primeira = (await (await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', form(), credenciais))).json()).dados.imagem as string
  const segunda = (await (await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', form(), credenciais))).json()).dados.imagem as string
  assert.notEqual(primeira, segunda)
  assert.equal((await encaminharApi(requisicao(primeira.slice('/api/v1'.length)))).status, 404)
  const removida = await encaminharApi(requisicao('/artesao/me/imagem', 'DELETE', undefined, credenciais))
  assert.equal((await removida.json()).dados.imagem, perfil.imagem)
  assert.equal((await encaminharApi(requisicao(segunda.slice('/api/v1'.length)))).status, 404)
})

test('GET e HEAD publicos conservam binario, tamanho e cabecalhos de seguranca', async () => {
  imagem = `/api/v1/arquivos/perfis/${randomUUID()}`
  for (const metodo of ['GET', 'HEAD']) {
    const response = await encaminharApi(requisicao(imagem.slice('/api/v1'.length), metodo, undefined, { ...credenciais, Authorization: 'Bearer nao-necessario' }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'image/webp')
    assert.equal(response.headers.get('Content-Length'), String(bytes.length))
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), metodo === 'HEAD' ? Buffer.alloc(0) : bytes)
    assert.equal(eventos.at(-1)?.cookie, undefined)
    assert.equal(eventos.at(-1)?.authorization, undefined)
  }
})

test('falha no upload conserva referencia anterior e retorna erro do backend', async () => {
  imagem = `/api/v1/arquivos/perfis/${randomUUID()}`
  const anterior = imagem
  falhar = true
  const response = await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', form(), credenciais))
  assert.equal(response.status, 503)
  assert.equal(imagem, anterior)
  assert.equal((await response.json()).erro.mensagem, 'Falha controlada.')
})

test('arquivo vazio, formato invalido e mais de 2 MiB sao recusados na validacao preliminar', () => {
  assert.ok(validarFoto(new File([], 'vazia.png', { type: 'image/png' })))
  assert.ok(validarFoto(new File(['texto'], 'foto.txt', { type: 'text/plain' })))
  assert.ok(validarFoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })))
  assert.equal(validarFoto(arquivo()), null)
})

test('proxy limita corpo a 3 MiB antes do upstream mesmo sem tamanho declarado', async () => {
  const response = await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', new Uint8Array(3 * 1024 * 1024 + 1), credenciais))
  assert.equal(response.status, 413)
  assert.equal(eventos.length, 0)
})

test('proxy recusa multipart com tamanho declarado acima do limite sem chamar o Gateway', async () => {
  const response = await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', form(), {
    ...credenciais, 'Content-Length': String(3 * 1024 * 1024 + 1),
  }))
  assert.equal(response.status, 413)
  assert.equal(eventos.length, 0)
})

test('cookie em mutacao continua exigindo Origin permitido', async () => {
  for (const headers of [{ Cookie: credenciais.Cookie }, { ...credenciais, Origin: 'https://externa.invalid' }]) {
    const response = await encaminharApi(requisicao('/artesao/me/imagem', 'PUT', form(), headers))
    assert.equal(response.status, 403)
  }
  assert.equal(eventos.length, 0)
})

test('proxy recusa caminhos genericos de storage', async () => {
  for (const caminho of ['/arquivos/perfis/catalog/arquivo', '/arquivos/perfis/arquivo']) {
    assert.equal((await encaminharApi(requisicao(caminho))).status, 404)
  }
  assert.equal(eventos.length, 0)
})
