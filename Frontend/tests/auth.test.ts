import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type IncomingMessage } from 'node:http'
import { encaminharApi } from '../src/services/api/proxy'
import { destinoInicial, destinoSeguro, lerSessaoDoCookie, sessaoDoUsuario } from '../src/services/sessao/cookie'
import { papelDaRota, rotaProtegida } from '../src/services/sessao/rotas'
import { validarSenha } from '../src/utils/validacao'

const chamadas: { caminho: string; metodo: string; headers: IncomingMessage['headers']; corpo: string }[] = []
let statusUsuario = 200
const contaReal = { id: '160bf59e-eabe-4d15-9f94-ef881dfac9ed', nome: 'Conta real', email: 'conta@teste.invalid', papel: 'comprador' }
const gateway = createServer(async (req, res) => {
  let corpo = ''
  for await (const pedaco of req) corpo += pedaco
  chamadas.push({ caminho: req.url!, metodo: req.method!, headers: req.headers, corpo })
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/api/v1/usuario') {
    res.statusCode = statusUsuario
    res.end(JSON.stringify({ dados: res.statusCode === 200 ? contaReal : null, erro: res.statusCode === 200 ? null : { codigo: 'NAO_AUTENTICADO', mensagem: 'Sem sessão' } }))
    return
  }
  res.setHeader('Set-Cookie', 'balaio_sessao=jwt.exemplo.assinatura; Path=/api/v1; HttpOnly; SameSite=Lax; Max-Age=3600')
  res.end(JSON.stringify({ dados: { ok: true }, erro: null }))
})

before(async () => {
  await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(gateway.address() as { port: number }).port}/api/v1`
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})
after(async () => { await new Promise<void>((resolve) => gateway.close(() => resolve())) })

const chamar = (caminho: string, metodo = 'GET', headers: HeadersInit = {}, corpo?: unknown) => encaminharApi(new Request(`http://localhost:4321/api/v1${caminho}`, {
  method: metodo, headers: { Origin: 'http://localhost:4321', 'Content-Type': 'application/json', ...headers },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
}))

for (const caminho of ['/auth/cadastro', '/auth/login', '/auth/entrar', '/auth/logout']) {
  test(`${caminho} vai ao gateway e preserva cookie HttpOnly na raiz`, async () => {
    chamadas.length = 0
    const resposta = await chamar(caminho, 'POST', { Cookie: 'balaio_sessao=real; balaio-sessao=forjado; outro=1', 'X-User-Id': 'admin', 'X-Role': 'admin' }, { email: 'conta@teste.invalid', senha: 'SenhaSomenteTeste123' })
    assert.equal(resposta.status, 200)
    assert.equal(chamadas.length, 1)
    assert.equal(chamadas[0].caminho, `/api/v1${caminho}`)
    assert.equal(chamadas[0].headers.cookie, 'balaio_sessao=real')
    assert.equal(chamadas[0].headers['x-user-id'], undefined)
    assert.equal(chamadas[0].headers['x-role'], undefined)
    assert.equal(chamadas[0].headers.origin, 'http://localhost:4321')
    const cookies = resposta.headers.getSetCookie()
    const sessao = cookies.find((cookie) => cookie.startsWith('balaio_sessao=jwt.'))
    assert.ok(sessao && sessao.endsWith('Path=/') && sessao.includes('HttpOnly') && !sessao.includes('Path=/api/v1'))
    assert.ok(cookies.some((cookie) => cookie.startsWith('balaio_sessao=;') && cookie.includes('Path=/api/v1;') && cookie.includes('Max-Age=0')))
  })
}

test('GET /usuario repassa Bearer e conserva 401 e 403 do gateway', async () => {
  try {
    for (const status of [200, 401, 403]) {
      chamadas.length = 0
      statusUsuario = status
      const resposta = await chamar('/usuario', 'GET', { Authorization: 'Bearer jwt-real', Cookie: 'balaio_sessao=real' })
      assert.equal(resposta.status, status)
      assert.equal(chamadas.length, 1)
      assert.equal(chamadas[0].headers.authorization, 'Bearer jwt-real')
      assert.equal(chamadas[0].headers.cookie, 'balaio_sessao=real')
    }
  } finally { statusUsuario = 200 }
})

test('mutações com cookie exigem Origin autorizado; Bearer puro funciona sem Origin', async () => {
  for (const origin of [null, 'null', 'https://externa.invalid', 'http://localhost:4321.externa.invalid']) {
    chamadas.length = 0
    const headers = new Headers({ Cookie: 'balaio_sessao=JWTREAL', 'Content-Type': 'application/json' })
    if (origin !== null) headers.set('Origin', origin)
    const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/usuario/enderecos', { method: 'POST', headers, body: JSON.stringify({ rua: 'A' }) }))
    assert.equal(resposta.status, 403)
    assert.equal(chamadas.length, 0)
  }
  chamadas.length = 0
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/usuario/enderecos', {
    method: 'POST', headers: { Authorization: 'Bearer JWTREAL', 'Content-Type': 'application/json' }, body: JSON.stringify({ rua: 'A' }),
  }))
  assert.equal(resposta.status, 200)
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].corpo, JSON.stringify({ rua: 'A' }))
})

test('gateway indisponível vira 502 sem destino alternativo', async () => {
  const anterior = process.env.API_GATEWAY_URL
  try {
    process.env.API_GATEWAY_URL = 'http://127.0.0.1:1/api/v1'
    chamadas.length = 0
    const resposta = await chamar('/auth/login', 'POST', {}, { email: 'teste', senha: 'somente-teste' })
    assert.equal(resposta.status, 502)
    assert.equal(chamadas.length, 0)
  } finally { process.env.API_GATEWAY_URL = anterior }
})

test('destino inválido, caminhos ambíguos e método errado não chegam ao gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  try {
    process.env.API_GATEWAY_URL = 'ftp://gateway.invalid/api/v1'
    assert.equal((await chamar('/auth/login', 'POST', {}, {})).status, 502)
  } finally { process.env.API_GATEWAY_URL = anterior }
  chamadas.length = 0
  assert.equal((await chamar('/auth%2flogin', 'POST', {}, {})).status, 400)
  assert.equal((await chamar('/auth/login')).status, 405)
  for (const query of ['?_embed=usuarios', '?_expand=usuario']) assert.equal((await chamar(`/artesaos/mestre${query}`)).status, 400)
  assert.equal(chamadas.length, 0)
})

test('JSON legado não autentica e redirects externos são rejeitados', () => {
  assert.equal(lerSessaoDoCookie(encodeURIComponent(JSON.stringify({ id: 'admin', papel: 'admin' }))), null)
  for (const proximo of ['//externa.invalid', '/\\externa.invalid', '/%2fexterna.invalid', '/\nexterna.invalid']) assert.equal(destinoSeguro(proximo), undefined)
  assert.equal(destinoSeguro('/orders?pagina=2'), '/orders?pagina=2')
  assert.equal(sessaoDoUsuario({ nome: 'A', email: 'a@b.c', imagem: '', id: 'a' }), null)
  for (const [papel, destino] of [['comprador', '/account'], ['artesao', '/dashboard'], ['admin', '/admin']] as const) {
    assert.equal(destinoInicial({ id: 'real', nome: 'Real', email: 'real@auth.test', imagem: '', papel }), destino)
  }
})

test('rotas por limites de segmento e política de senha alinhada ao domínio', () => {
  assert.equal(rotaProtegida('/account/details'), true)
  assert.equal(rotaProtegida('/accounting'), false)
  assert.equal(papelDaRota('/admin/criteria'), 'admin')
  assert.equal(papelDaRota('/dashboard/pieces'), 'artesao')
  assert.ok(validarSenha('curta123'))
  assert.equal(validarSenha('SenhaSomenteTeste123'), null)
  assert.ok(validarSenha('á'.repeat(37)))
  assert.ok(validarSenha('a'.repeat(12) + '\u0000'))
})
