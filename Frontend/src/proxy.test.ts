import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'
import { encaminharApi } from './services/api/proxy'
import { buscar } from './services/api/cliente'
import { excluirPeca } from './services/api/pecas.servico'

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
    ['/api/v1/pedidos/123/cancelar', 'PATCH'],
    ['/api/v1/admin/mediacoes/123/decisao', 'POST'],
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

test('sacola Fake lê o agregado existente e preserva PUT existente', async () => {
  const anterior = process.env.API_GATEWAY_URL
  delete process.env.API_GATEWAY_URL
  const chamadas: string[] = []
  globalThis.fetch = async (entrada, opcoes) => {
    chamadas.push(`${opcoes?.method} ${entrada}`)
    return Response.json({ dados: opcoes?.method === 'GET'
      ? { sacola: [{ slug: 'peca-teste', quantidade: 1 }], favoritos: [] }
      : [{ slug: 'peca-teste', quantidade: 1 }], erro: null })
  }
  try {
    const get = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/sacola'))
    assert.deepEqual((await get.json()).dados, [{ slug: 'peca-teste', quantidade: 1 }])
    const put = await encaminharApi(new Request('http://localhost:4321/api/v1/estado/sacola', {
      method: 'PUT', body: JSON.stringify({ sacola: [{ slug: 'peca-teste', quantidade: 1 }] }),
    }))
    assert.equal(put.status, 200)
    assert.deepEqual(chamadas, ['GET http://127.0.0.1:3001/api/v1/estado',
      'PUT http://127.0.0.1:3001/api/v1/estado/sacola'])
  } finally {
    if (anterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = anterior
  }
})

test('sacola autenticada encaminha GET e PUT com Bearer e envelope; falha não lê Fake API', async () => {
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

test('consultas server-side demonstrativas usam Fake API e pedido usa Gateway', async () => {
  const gatewayAnterior = process.env.API_GATEWAY_URL
  const fakeAnterior = process.env.API_URL
  process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1'
  process.env.API_URL = 'http://fake.local/api/v1'
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
      'http://fake.local/api/v1/eventos',
      'http://fake.local/api/v1/videos',
      'http://fake.local/api/v1/pecas/peca-teste/historico',
      'http://gateway.local/api/v1/pedidos/pedido-1',
    ])
  } finally {
    if (gatewayAnterior === undefined) delete process.env.API_GATEWAY_URL
    else process.env.API_GATEWAY_URL = gatewayAnterior
    if (fakeAnterior === undefined) delete process.env.API_URL
    else process.env.API_URL = fakeAnterior
  }
})
