import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { encaminharApi } from './proxy'
import { ehRotaDeMidia, limiteDoCorpo } from './rotas-proxy'
import { mesclarColecao, normalizarColecoes } from '../../store/colecoesVisitante'
import { formatarDuracao, problemaDoArquivoDeVideo } from '../../utils/midiaVideo'
import { consultarAvaliado } from './avaliacoes.servico'

const fetchOriginal = globalThis.fetch
const gatewayOriginal = process.env.API_GATEWAY_URL

beforeEach(() => { process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1' })
afterEach(() => {
  globalThis.fetch = fetchOriginal
  if (gatewayOriginal === undefined) delete process.env.API_GATEWAY_URL
  else process.env.API_GATEWAY_URL = gatewayOriginal
})

test('rotas JSON do community têm limite de corpo e as demais seguem sem limite próprio', () => {
  for (const [metodo, caminho] of [
    ['POST', '/pecas/vaso/perguntas'], ['PATCH', '/pecas/vaso/perguntas/1'], ['PUT', '/estado/videosSalvos'],
    ['POST', '/videos'], ['PATCH', '/videos/1'], ['POST', '/videos/1/comentarios'],
    ['POST', '/pedidos/1/avaliacao'], ['POST', '/pedidos/1/conversa'], ['POST', '/admin/mediacoes/1/decisao'],
  ]) assert.equal(limiteDoCorpo(metodo, caminho), 64 * 1024, `${metodo} ${caminho}`)
  assert.equal(limiteDoCorpo('PUT', '/videos/1/arquivo'), 100 * 1024 * 1024)
  assert.equal(limiteDoCorpo('POST', '/pecas'), null)
  assert.equal(limiteDoCorpo('PUT', '/estado/qualquer'), null)
})

test('qualquer rota da API é encaminhada ao gateway configurado', async () => {
  const destinos: string[] = []
  globalThis.fetch = async (entrada) => {
    destinos.push(String(entrada))
    return Response.json({ dados: [], erro: null })
  }
  for (const caminho of ['/eventos', '/artesaos', '/coletivos/c1', '/estado/sacola', '/usuario/enderecos']) {
    await encaminharApi(new Request(`http://localhost:4321/api/v1${caminho}`))
  }
  assert.deepEqual(destinos, [
    'http://gateway.local/api/v1/eventos',
    'http://gateway.local/api/v1/artesaos',
    'http://gateway.local/api/v1/coletivos/c1',
    'http://gateway.local/api/v1/estado/sacola',
    'http://gateway.local/api/v1/usuario/enderecos',
  ])
})

test('sem API_GATEWAY_URL o proxy usa o gateway local padrão', async () => {
  delete process.env.API_GATEWAY_URL
  let destino = ''
  globalThis.fetch = async (entrada) => {
    destino = String(entrada)
    return Response.json({ dados: [], erro: null })
  }
  await encaminharApi(new Request('http://localhost:4321/api/v1/pecas?pagina=2'))
  assert.equal(destino, 'http://127.0.0.1:8080/api/v1/pecas?pagina=2')
})

test('caminhos ambíguos e parâmetros internos são recusados sem chamar o gateway', async () => {
  let chamou = false
  globalThis.fetch = async () => {
    chamou = true
    return Response.json({ dados: [], erro: null })
  }
  for (const caminho of ['/pecas/a%2fb', '/pecas/a%5cb', '/pecas//x', '/pecas?_expand=usuario']) {
    const resposta = await encaminharApi(new Request(`http://localhost:4321/api/v1${caminho}`))
    assert.equal(resposta.status, 400, caminho)
  }
  const metodoErrado = await encaminharApi(new Request('http://localhost:4321/api/v1/auth/login'))
  assert.equal(metodoErrado.status, 405)
  assert.equal(chamou, false)
})

test('gateway fora do ar vira 502 com envelope de erro', async () => {
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/pecas'))
  assert.equal(resposta.status, 502)
  assert.equal((await resposta.json()).erro.codigo, 'API_INDISPONIVEL')
})

test('cookie de sessão devolvido pelo gateway é regravado na raiz', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ dados: {}, erro: null }), {
    headers: { 'content-type': 'application/json', 'set-cookie': 'balaio_sessao=novo; Path=/api/v1; HttpOnly; SameSite=Lax' },
  })
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/auth/login', {
    method: 'POST', body: '{}', headers: { origin: 'http://localhost:4321' },
  }))
  const cookies = resposta.headers.getSetCookie()
  assert.ok(cookies.some((cookie) => cookie.startsWith('balaio_sessao=novo') && cookie.endsWith('Path=/')))
})

test('só arquivo e capa do vídeo são tratados como mídia', () => {
  assert.equal(ehRotaDeMidia('/videos/1/arquivo'), true)
  assert.equal(ehRotaDeMidia('/videos/1/capa'), true)
  assert.equal(ehRotaDeMidia('/videos/1/comentarios'), false)
})

test('rota real recebe o cookie de sessão como Bearer', async () => {
  let autorizacao: string | null = null
  globalThis.fetch = async (_entrada, opcoes) => {
    autorizacao = new Headers(opcoes?.headers).get('authorization')
    return Response.json({ dados: [], erro: null })
  }
  await encaminharApi(new Request('http://localhost:4321/api/v1/estado/favoritos', {
    headers: { cookie: 'balaio_sessao=jwt-assinado; outro=1' },
  }))
  assert.equal(autorizacao, 'Bearer jwt-assinado')
})

test('Authorization explícito tem prioridade sobre o cookie', async () => {
  let autorizacao: string | null = null
  globalThis.fetch = async (_entrada, opcoes) => {
    autorizacao = new Headers(opcoes?.headers).get('authorization')
    return Response.json({ dados: [], erro: null })
  }
  await encaminharApi(new Request('http://localhost:4321/api/v1/videos', {
    headers: { cookie: 'balaio_sessao=do-cookie', authorization: 'Bearer explicito' },
  }))
  assert.equal(autorizacao, 'Bearer explicito')
})

test('reprodução de vídeo repassa Range e devolve os cabeçalhos de trecho', async () => {
  let range: string | null = null
  globalThis.fetch = async (_entrada, opcoes) => {
    range = new Headers(opcoes?.headers).get('range')
    return new Response('abc', {
      status: 206,
      headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-2/10', 'accept-ranges': 'bytes', 'content-length': '3' },
    })
  }
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/videos/1/arquivo', {
    headers: { range: 'bytes=0-2' },
  }))
  assert.equal(range, 'bytes=0-2')
  assert.equal(resposta.status, 206)
  assert.equal(resposta.headers.get('content-range'), 'bytes 0-2/10')
  assert.equal(resposta.headers.get('accept-ranges'), 'bytes')
})

test('Range não é repassado fora das rotas de mídia', async () => {
  let range: string | null = 'nao-chamado'
  globalThis.fetch = async (_entrada, opcoes) => {
    range = new Headers(opcoes?.headers).get('range')
    return Response.json({ dados: [], erro: null })
  }
  await encaminharApi(new Request('http://localhost:4321/api/v1/videos', { headers: { range: 'bytes=0-2' } }))
  assert.equal(range, null)
})

test('mesclagem no login não duplica e preserva a ordem', () => {
  assert.deepEqual(mesclarColecao('favoritos', ['a', 'b'], ['b', 'c']), ['a', 'b', 'c'])
  assert.deepEqual(mesclarColecao('historicoBusca', ['antiga'], ['recente', 'antiga']), ['recente', 'antiga'])
  assert.equal(mesclarColecao('historicoBusca', [], Array.from({ length: 12 }, (_, i) => `t${i}`)).length, 8)
})

test('coleções do visitante ignoram itens inválidos', () => {
  assert.deepEqual(normalizarColecoes({ favoritos: ['a', 1, 'a', null], videosSalvos: 'x' }), {
    favoritos: ['a'], historicoBusca: [], videosCurtidos: [], videosSalvos: [],
  })
})

test('escrita com token do cookie exige Origin permitido', async () => {
  let chamou = false
  globalThis.fetch = async () => {
    chamou = true
    return Response.json({ dados: [], erro: null })
  }
  const semOrigem = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/favoritos', {
    method: 'PUT', body: '{"favoritos":[]}', headers: { cookie: 'balaio_sessao=jwt-assinado' },
  }))
  assert.equal(semOrigem.status, 403)
  assert.equal(chamou, false)

  const mesmaOrigem = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/favoritos', {
    method: 'PUT', body: '{"favoritos":[]}',
    headers: { cookie: 'balaio_sessao=jwt-assinado', origin: 'http://localhost:4321' },
  }))
  assert.equal(mesmaOrigem.status, 200)
  assert.equal(chamou, true)
})

test('corpo JSON grande demais nas rotas do community é recusado', async () => {
  globalThis.fetch = async () => Response.json({ dados: [], erro: null })
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/videos/1/comentarios', {
    method: 'POST', body: JSON.stringify({ texto: 'a'.repeat(70 * 1024) }),
    headers: { authorization: 'Bearer explicito' },
  }))
  assert.equal(resposta.status, 413)
})

test('avaliação inexistente significa não avaliado; outros erros são repassados', async () => {
  globalThis.fetch = async () => Response.json({ dados: null, erro: { codigo: 'AVALIACAO_NAO_ENCONTRADA', mensagem: 'x' } }, { status: 404 })
  assert.deepEqual(await consultarAvaliado('p1', 'jwt'), { dados: false, erro: null })

  globalThis.fetch = async () => Response.json({ dados: null, erro: { codigo: 'COMMERCE_INDISPONIVEL', mensagem: 'fora' } }, { status: 503 })
  const resposta = await consultarAvaliado('p1', 'jwt')
  assert.equal(resposta.dados, null)
  assert.equal(resposta.erro?.codigo, 'COMMERCE_INDISPONIVEL')
})

test('duração desconhecida ou infinita vira 0:00 e o arquivo é validado', () => {
  assert.equal(formatarDuracao(Infinity), '0:00')
  assert.equal(formatarDuracao(Number.NaN), '0:00')
  assert.equal(formatarDuracao(75.4), '1:15')
  assert.equal(problemaDoArquivoDeVideo(new File(['x'], 'v.mov', { type: 'video/quicktime' })), 'Use um vídeo MP4 ou WebM')
  assert.equal(problemaDoArquivoDeVideo(new File(['x'], 'v.mp4', { type: 'video/mp4' })), null)
})
