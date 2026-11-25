import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'
import { encaminharApi } from './services/api/proxy'
import { buscar } from './services/api/cliente'
import { excluirPeca } from './services/api/pecas.servico'
import { listarPedidosPendentes, atualizarEstadoPedido, listarPedidos, obterPedido, conversaDoPedido, enviarMensagem } from './services/api/pedidos.servico'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const request = (path: string) => new NextRequest(`http://localhost:4321${path}`, {
  headers: { cookie: `balaio_sessao=revoked; balaio-sessao=${encodeURIComponent(JSON.stringify({ id: '1', nome: 'Ana', papel: 'admin' }))}` },
})

test('sessão revogada bloqueia área protegida e libera login mesmo com cookie local antigo', async () => {
  globalThis.fetch = async () => Response.json({ dados: null, erro: { codigo: 'NAO_AUTENTICADO' } }, { status: 401 })
  const protegida = await proxy(request('/account'))
  assert.equal(protegida.status, 307)
  assert.equal(new URL(protegida.headers.get('location')!).pathname, '/login')
  const login = await proxy(request('/login'))
  assert.equal(login.status, 200)
})

test('permissão usa papel retornado pelo backend', async () => {
  globalThis.fetch = async () => Response.json({ dados: { id: '1', nome: 'Ana', email: 'ana@example.com', papel: 'comprador', imagem: '' }, erro: null })
  const resposta = await proxy(request('/admin'))
  assert.equal(resposta.status, 307)
  assert.equal(new URL(resposta.headers.get('location')!).pathname, '/account')
})

test('cada papel só entra nas áreas permitidas e volta ao próprio início nas demais', async () => {
  const casos: [string, string, string | null][] = [
    ['comprador', '/checkout', null],
    ['comprador', '/account/addresses', null],
    ['comprador', '/orders/123', null],
    ['comprador', '/dashboard', '/account'],
    ['artesao', '/dashboard/pieces', null],
    ['artesao', '/account', null],
    ['artesao', '/checkout', null],
    ['artesao', '/orders', null],
    ['artesao', '/orders/123/review', null],
    ['artesao', '/confirmation/123', null],
    ['artesao', '/account/addresses', null],
    ['artesao', '/admin', '/dashboard'],
    ['organizador', '/account', null],
    ['organizador', '/orders', '/events/new'],
    ['organizador', '/confirmation/123', '/events/new'],
    ['organizador', '/dashboard', '/events/new'],
    ['organizador', '/admin', '/events/new'],
    ['admin', '/admin/criteria', null],
    ['admin', '/checkout', '/admin'],
    ['admin', '/orders', '/admin'],
    ['admin', '/account/addresses', '/admin'],
    ['organizador', '/checkout', '/events/new'],
    ['organizador', '/account/addresses', '/events/new'],
    ['admin', '/dashboard', '/admin'],
  ]
  for (const [papel, caminho, destino] of casos) {
    globalThis.fetch = async () => Response.json({ dados: { id: '1', nome: 'Ana', email: 'ana@example.com', papel, imagem: '' }, erro: null })
    const resposta = await proxy(request(caminho))
    if (destino === null) assert.equal(resposta.status, 200, `${papel} em ${caminho}`)
    else {
      assert.equal(resposta.status, 307, `${papel} em ${caminho}`)
      assert.equal(new URL(resposta.headers.get('location')!).pathname, destino, `${papel} em ${caminho}`)
    }
  }
})

test('escrita de peças encaminha cookie de sessão como Bearer ao gateway', async () => {
  for (const [path, method] of [
    ['/api/v1/pecas', 'POST'],
    ['/api/v1/pecas/peca-teste', 'PATCH'],
    ['/api/v1/pecas/peca-teste', 'DELETE'],
  ]) {
    const requisicao = new NextRequest(`http://localhost:4321${path}`, {
      method, headers: { cookie: 'balaio_sessao=jwt-assinado' },
    })
    const resposta = await proxy(requisicao)
    assert.equal(resposta.headers.get('x-middleware-request-authorization'), 'Bearer jwt-assinado')
  }
})

test('consultas de usuário e identidade do artesão encaminham JWT ao profile-service', async () => {
  for (const caminho of ['/api/v1/usuario', '/api/v1/artesao/me']) {
    const requisicao = new NextRequest(`http://localhost:4321${caminho}`, {
      headers: { cookie: 'balaio_sessao=jwt-assinado' },
    })
    const resposta = await proxy(requisicao)
    assert.equal(resposta.headers.get('x-middleware-request-authorization'), 'Bearer jwt-assinado')
  }
})

test('checkout, pedido e mediação encaminham sessão como Bearer', async () => {
  for (const [path, method] of [
    ['/api/v1/checkout', 'POST'],
    ['/api/v1/estado/sacola', 'GET'],
    ['/api/v1/estado/sacola', 'PUT'],
    ['/api/v1/sacola/revalidar', 'POST'],
    ['/api/v1/pedidos/123/cancelar', 'PATCH'],
    ['/api/v1/pedidos/123/estado', 'PATCH'],
    ['/api/v1/pedidos/123/conversa', 'GET'],
    ['/api/v1/pedidos/123/conversa', 'POST'],
    ['/api/v1/admin/mediacoes/123/decisao', 'POST'],
    ['/api/v1/admin/mediacoes/123/cancelamento', 'POST'],
    ['/api/v1/artesao/pedidos-pendentes', 'GET'],
    ['/api/v1/artesao/vendas', 'GET'],
  ]) {
    const requisicao = new NextRequest(`http://localhost:4321${path}`, {
      method, headers: { cookie: 'balaio_sessao=jwt-assinado' },
    })
    const resposta = await proxy(requisicao)
    assert.equal(resposta.headers.get('x-middleware-request-authorization'), 'Bearer jwt-assinado')
  }
})

test('comprador consulta pedidos e conversa e envia texto pelo contrato público', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const chamadas: string[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push(`${opcoes?.method ?? 'GET'} ${entrada} ${new Headers(opcoes?.headers).get('authorization')} ${opcoes?.body ?? ''}`)
    return Response.json({ dados: opcoes?.method === 'POST' ? { autor: 'comprador', texto: 'Olá', hora: '09:00' } : [], erro: null })
  }
  try {
    await listarPedidos('jwt-comprador')
    await obterPedido('123', 'jwt-comprador')
    await conversaDoPedido('123', 'jwt-comprador')
    assert.equal((await enviarMensagem('123', { texto: 'Olá' })).dados?.texto, 'Olá')
    assert.deepEqual(chamadas, [
      'GET http://gateway.local/api/v1/pedidos Bearer jwt-comprador ',
      'GET http://gateway.local/api/v1/pedidos/123 Bearer jwt-comprador ',
      'GET http://gateway.local/api/v1/pedidos/123/conversa Bearer jwt-comprador ',
      'POST http://gateway.local/api/v1/pedidos/123/conversa null {"texto":"Olá"}',
    ])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('pedidos do artesão preservam lista, PATCH e envelope do Gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const chamadas: { metodo: string; url: string; token: string | null; corpo: string | undefined }[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push({ metodo: opcoes?.method ?? 'GET', url: String(entrada),
      token: new Headers(opcoes?.headers).get('authorization'), corpo: opcoes?.body?.toString() })
    return Response.json({ dados: opcoes?.method === 'PATCH' ? { id: '123', estado: 'producao' } : [], erro: null })
  }
  try {
    assert.deepEqual((await listarPedidosPendentes('jwt-artesao')).dados, [])
    assert.equal((await atualizarEstadoPedido('123', 'producao')).dados?.estado, 'producao')
    assert.deepEqual(chamadas, [
      { metodo: 'GET', url: 'http://gateway.local/api/v1/artesao/pedidos-pendentes', token: 'Bearer jwt-artesao', corpo: undefined },
      { metodo: 'PATCH', url: 'http://gateway.local/api/v1/pedidos/123/estado', token: null, corpo: '{"estado":"producao"}' },
    ])
    const semSessao = await proxy(new NextRequest('http://localhost:4321/api/v1/artesao/pedidos-pendentes'))
    assert.equal(semSessao.headers.get('x-middleware-request-authorization'), null)
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('falha de autorização ao atualizar pedido preserva erro da API', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  globalThis.fetch = async () => Response.json({ dados: null,
    erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Pedido de outro ateliê.' } }, { status: 403 })
  try {
    const resposta = await atualizarEstadoPedido('123', 'producao')
    assert.equal(resposta.dados, null)
    assert.equal(resposta.erro?.codigo, 'SEM_PERMISSAO')
    assert.equal(resposta.erro?.status, 403)
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('adaptador de pedido encaminha cookie no PATCH e preserva 403 e sessão ausente', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const chamadas: { url: string; metodo: string | undefined; token: string | null; corpo: string | undefined }[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    const token = new Headers(opcoes?.headers).get('authorization')
    chamadas.push({ url: String(entrada), metodo: opcoes?.method, token,
      corpo: opcoes?.body instanceof ArrayBuffer ? new TextDecoder().decode(opcoes.body) : undefined })
    return Response.json({ dados: null, erro: { codigo: token ? 'SEM_PERMISSAO' : 'NAO_AUTENTICADO' } },
      { status: token ? 403 : 401 })
  }
  try {
    const caminho = 'http://localhost:4321/api/v1/pedidos/123/estado'
    const corpo = '{"estado":"producao"}'
    const comSessao = await encaminharApi(new Request(caminho, { method: 'PATCH', body: corpo,
      headers: { cookie: 'balaio_sessao=jwt-artesao', origin: 'http://localhost:4321' } }))
    assert.equal(comSessao.status, 403)
    assert.equal((await comSessao.json()).erro.codigo, 'SEM_PERMISSAO')
    const semSessao = await encaminharApi(new Request(caminho, { method: 'PATCH', body: corpo }))
    assert.equal(semSessao.status, 401)
    assert.equal((await semSessao.json()).erro.codigo, 'NAO_AUTENTICADO')
    assert.deepEqual(chamadas, [
      { url: 'http://gateway.local/api/v1/pedidos/123/estado', metodo: 'PATCH', token: 'Bearer jwt-artesao', corpo },
      { url: 'http://gateway.local/api/v1/pedidos/123/estado', metodo: 'PATCH', token: null, corpo },
    ])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('sacola autenticada encaminha GET e PUT com Bearer e envelope ao gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const chamadas: string[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push(`${opcoes?.method} ${entrada} ${new Headers(opcoes?.headers).get('authorization')}`)
    if (opcoes?.method === 'GET') throw new Error('rede indisponível')
    return Response.json({ dados: [{ slug: 'peca-teste', quantidade: 1 }], erro: null })
  }
  try {
    const headers = { authorization: 'Bearer comprador-a' }
    const get = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/sacola', { headers }))
    assert.equal(get.status, 502)
    const put = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/sacola', {
      method: 'PUT', headers, body: JSON.stringify({ sacola: [{ slug: 'peca-teste', quantidade: 1 }] }),
    }))
    assert.equal(put.status, 200)
    assert.deepEqual((await put.json()).dados, [{ slug: 'peca-teste', quantidade: 1 }])
    assert.deepEqual(chamadas, ['GET http://gateway.local/api/v1/estado/sacola Bearer comprador-a',
      'PUT http://gateway.local/api/v1/estado/sacola Bearer comprador-a'])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('POST de revalidação mantém rota pública, JWT e resposta do Gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  let destino = '', autorizacao = ''
  globalThis.fetch = async (entrada, opcoes) => {
    destino = String(entrada)
    autorizacao = new Headers(opcoes?.headers).get('authorization') ?? ''
    return Response.json({ dados: { itens: [], podeProsseguir: false, revalidadoEm: '2026-11-17T00:00:00Z' }, erro: null })
  }
  try {
    const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/sacola/revalidar', {
      method: 'POST', headers: { authorization: 'Bearer comprador-a', 'content-type': 'application/json' },
      body: '{}',
    }))
    assert.equal(resposta.status, 200)
    assert.equal(destino, 'http://gateway.local/api/v1/sacola/revalidar')
    assert.equal(autorizacao, 'Bearer comprador-a')
    assert.equal((await resposta.json()).dados.podeProsseguir, false)
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})


test('checkout usa Gateway e preserva Idempotency-Key', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  let destino = ''
  let chave = ''
  globalThis.fetch = async (entrada, opcoes) => {
    destino = String(entrada)
    chave = new Headers(opcoes?.headers).get('idempotency-key') ?? ''
    return Response.json({ dados: { id: 'pedido-1' }, erro: null })
  }
  try {
    const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'compra-1', authorization: 'Bearer teste' },
      body: JSON.stringify({ itens: [] }),
    }))
    assert.equal(resposta.status, 200)
    assert.equal(destino, 'http://gateway.local/api/v1/checkout')
    assert.equal(chave, 'compra-1')
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('Route Handler encaminha criação, edição e exclusão de peças ao Gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const chamadas: string[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push(`${opcoes?.method} ${entrada} ${new Headers(opcoes?.headers).get('authorization')}`)
    if (opcoes?.method === 'DELETE') return new Response(null, { status: 204 })
    return Response.json({ dados: { slug: 'peca-teste' }, erro: null })
  }
  try {
    for (const [caminho, metodo] of [
      ['/pecas', 'POST'], ['/pecas/peca-teste', 'PATCH'], ['/pecas/peca-teste', 'DELETE'],
    ]) {
      const resposta = await encaminharApi(new Request(`http://localhost:4321/api/v1${caminho}`, {
        method: metodo,
        headers: { authorization: 'Bearer jwt-assinado', 'content-type': 'application/json' },
        ...(metodo === 'DELETE' ? {} : { body: '{}' }),
      }))
      assert.equal(resposta.status, metodo === 'DELETE' ? 204 : 200)
    }
    assert.deepEqual(chamadas, [
      'POST http://gateway.local/api/v1/pecas Bearer jwt-assinado',
      'PATCH http://gateway.local/api/v1/pecas/peca-teste Bearer jwt-assinado',
      'DELETE http://gateway.local/api/v1/pecas/peca-teste Bearer jwt-assinado',
    ])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('cliente aceita exclusão 204 sem corpo do catálogo', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  globalThis.fetch = async () => new Response(null, { status: 204 })
  try {
    const resposta = await excluirPeca('peca-teste')
    assert.deepEqual(resposta, { dados: null, erro: null })
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('foto persistida mantém bytes e Content-Type ao passar pelo Gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  const chamadas: string[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push(`${opcoes?.method} ${entrada}`)
    return new Response(opcoes?.method === 'HEAD' ? null : bytes, {
      headers: { 'content-type': 'image/png' },
    })
  }
  try {
    const caminho = '/api/v1/arquivos/pecas/foto-persistida.png'
    const get = await encaminharApi(new Request(`http://localhost:4321${caminho}`))
    assert.equal(get.headers.get('content-type'), 'image/png')
    assert.deepEqual(new Uint8Array(await get.arrayBuffer()), bytes)
    const head = await encaminharApi(new Request(`http://localhost:4321${caminho}`, { method: 'HEAD' }))
    assert.equal(head.headers.get('content-type'), 'image/png')
    assert.deepEqual(chamadas, [
      'GET http://gateway.local/api/v1/arquivos/pecas/foto-persistida.png',
      'HEAD http://gateway.local/api/v1/arquivos/pecas/foto-persistida.png',
    ])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('consultas server-side vão todas ao gateway', async () => {
  const gatewayAnterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1/'
  const destinos: string[] = []
  globalThis.fetch = async (entrada) => {
    destinos.push(String(entrada))
    return Response.json({ dados: [], erro: null })
  }
  try {
    for (const caminho of ['/eventos', '/videos', '/pecas/peca-teste/historico', '/pedidos/pedido-1']) {
      const resposta = await buscar(caminho)
      assert.equal(resposta.erro, null)
    }
    assert.deepEqual(destinos, [
      'http://gateway.local/api/v1/eventos',
      'http://gateway.local/api/v1/videos',
      'http://gateway.local/api/v1/pecas/peca-teste/historico',
      'http://gateway.local/api/v1/pedidos/pedido-1',
    ])
  } finally {
    if (gatewayAnterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = gatewayAnterior
  }
})

test('sessão recusada pelo gateway é removida do navegador e só o primeiro cookie é repassado', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const cookiesRepassados: (string | null)[] = []
  globalThis.fetch = async (_entrada, opcoes) => {
    cookiesRepassados.push(new Headers(opcoes?.headers).get('cookie'))
    return Response.json({ dados: null, erro: { codigo: 'NAO_AUTENTICADO' } }, { status: 401 })
  }
  try {
    const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/pecas', {
      headers: { cookie: 'balaio_sessao=legado; balaio_sessao=atual' },
    }))
    assert.equal(resposta.status, 401)
    assert.deepEqual(cookiesRepassados, ['balaio_sessao=legado'])
    assert.ok(resposta.headers.getSetCookie().some((cookie) => /^balaio_sessao=;.*Path=\/;.*Max-Age=0/.test(cookie)))
  } finally {
    process.env.API_GATEWAY_URL = anterior
  }
})

test('sair da conta limpa a sessão mesmo com o servidor fora do ar', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }
  try {
    const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/auth/logout', {
      method: 'POST', headers: { cookie: 'balaio_sessao=jwt', origin: 'http://localhost:4321' },
    }))
    assert.equal(resposta.status, 502)
    assert.ok(resposta.headers.getSetCookie().some((cookie) => /^balaio_sessao=;.*Path=\/;.*Max-Age=0/.test(cookie)))
  } finally {
    process.env.API_GATEWAY_URL = anterior
  }
})

test('foto de peça sai com cache longo e sem repassar a sessão ao gateway', async () => {
  const anterior = process.env.API_GATEWAY_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  const credenciais: (string | null)[] = []
  globalThis.fetch = async (_entrada, opcoes) => {
    const cabecalhos = new Headers(opcoes?.headers)
    credenciais.push(cabecalhos.get('cookie') ?? cabecalhos.get('authorization'))
    return new Response('imagem', { status: 200, headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } })
  }
  try {
    const foto = await encaminharApi(new Request(
      'http://localhost:4321/api/v1/arquivos/pecas/2343a110-c0a0-4c00-93ff-41df8a02a6e7.webp',
      { headers: { cookie: 'balaio_sessao=jwt' } }))
    assert.equal(foto.status, 200)
    assert.equal(foto.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.equal(foto.headers.get('content-type'), 'image/webp')
    assert.deepEqual(foto.headers.getSetCookie(), [])
    assert.deepEqual(credenciais, [null])

    const outra = await encaminharApi(new Request('http://localhost:4321/api/v1/pecas'))
    assert.equal(outra.headers.get('cache-control'), 'no-store')
  } finally {
    process.env.API_GATEWAY_URL = anterior
  }
})
