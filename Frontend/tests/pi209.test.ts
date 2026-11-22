import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type IncomingMessage } from 'node:http'
import { atualizarConta, alterarSenha } from '../src/services/api/auth.servico'
import { obterConfiguracoes, atualizarConfiguracoes } from '../src/services/api/artesaos.servico'
import { encaminharApi } from '../src/services/api/proxy'

const chamadas: { url: string; method: string; headers: IncomingMessage['headers']; body: unknown }[] = []
const servidor = createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  chamadas.push({ url: req.url!, method: req.method!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined })
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ dados: { alterada: true }, erro: null }))
})
before(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/api/v1`
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})
after(async () => { await new Promise<void>((resolve) => servidor.close(() => resolve())) })

test('conta envia PATCH parcial e troca de senha reutiliza o endpoint existente', async () => {
  await atualizarConta('conta-1', { email: 'nova@example.test' })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/conta/conta-1')
  assert.equal(chamadas.at(-1)?.method, 'PATCH')
  assert.deepEqual(chamadas.at(-1)?.body, { email: 'nova@example.test' })
  await alterarSenha('SenhaAtual123!', 'NovaSenha456!')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/auth/alterar-senha')
  assert.deepEqual(chamadas.at(-1)?.body, { senhaAtual: 'SenhaAtual123!', novaSenha: 'NovaSenha456!' })
})
test('consulta SSR encaminha Bearer explicitamente e conserva PATCH parcial', async () => {
  await obterConfiguracoes('artesao-1', 'token-apenas-no-servidor')
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer token-apenas-no-servidor')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/artesaos/artesao-1/configuracoes')
  await atualizarConfiguracoes('artesao-1', { encomendasPausadas: true })
  assert.deepEqual(chamadas.at(-1)?.body, { encomendasPausadas: true })
})
test('proxy autentica configuracoes e conta pelo cookie sem expor o JWT ao cliente', async () => {
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/artesaos/artesao-1/configuracoes', {
    method: 'PATCH', headers: { Cookie: 'balaio_sessao=jwt-teste', Origin: 'http://localhost:4321', 'Content-Type': 'application/json' },
    body: JSON.stringify({ prazoPadraoDias: 10 }),
  }))
  assert.equal(resposta.status, 200)
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer jwt-teste')
  assert.ok(!(await resposta.text()).includes('jwt-teste'))
  const bloqueada = await encaminharApi(new Request('http://localhost:4321/api/v1/usuario', {
    method: 'PATCH', headers: { Cookie: 'balaio_sessao=jwt-teste', Origin: 'https://evil.example' }, body: '{}',
  }))
  assert.equal(bloqueada.status, 403)
})
