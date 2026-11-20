import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { validarSenha } from '../src/utils/validacao'
import { solicitarRecuperacao, redefinirSenha } from '../src/services/api/conta.servico'

const requests: { path: string; body: unknown }[] = []
const server = createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  requests.push({ path: req.url!, body: JSON.parse(body) })
  res.writeHead(req.url!.endsWith('/recuperacao') ? 201 : 200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ dados: req.url!.endsWith('/recuperacao') ? { recebida: true } : { redefinida: true }, erro: null }))
})
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`
})
after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())) })

for (const [name, password] of [
  ['12 caracteres ASCII', 'a'.repeat(12)], ['72 bytes ASCII', 'a'.repeat(72)],
  ['36 acentos, 72 bytes', 'é'.repeat(36)], ['12 emojis, 48 bytes', '😀'.repeat(12)],
  ['18 emojis, 72 bytes', '😀'.repeat(18)], ['combinação de caracteres', 'a'.repeat(10) + 'é😀'],
  ['espaço não separável conforme política Java', '\u00a0'.repeat(12)],
  ['espaço literal sem trim', ' ${SEGREDO} '],
] as const) {
  test(`política compartilhada aceita ${name}`, () => assert.equal(validarSenha(password), null))
}
for (const [name, password] of [
  ['11 caracteres ASCII', 'a'.repeat(11)], ['73 bytes ASCII', 'a'.repeat(73)],
  ['37 acentos, 74 bytes', 'é'.repeat(37)], ['11 emojis apesar de 22 unidades UTF-16', '😀'.repeat(11)],
  ['19 emojis, 76 bytes', '😀'.repeat(19)], ['controle', 'a'.repeat(12) + '\u0000'],
  ['UTF-16 inválido', 'a'.repeat(12) + '\ud800'], ['somente espaços', ' '.repeat(12)],
] as const) {
  test(`política compartilhada recusa ${name}`, () => assert.notEqual(validarSenha(password), null))
}
test('recuperação e redefinição preservam os endpoints e payloads existentes', async () => {
  await solicitarRecuperacao('controle@example.test')
  assert.deepEqual(requests.at(-1), { path: '/api/v1/auth/recuperacao', body: { email: 'controle@example.test' } })
  await redefinirSenha('token-sintetico', 'NovaSenhaSegura123!')
  assert.deepEqual(requests.at(-1), { path: '/api/v1/auth/redefinicao', body: { token: 'token-sintetico', novaSenha: 'NovaSenhaSegura123!' } })
})
