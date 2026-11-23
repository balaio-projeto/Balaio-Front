import assert from 'node:assert/strict'
import { test } from 'node:test'
import { abrirPagamentoAposLimpeza, linkDePagamentoConfiavel } from './abrirPagamento'

test('espera PUT de limpeza antes de abrir pagamento', async () => {
  let confirmar!: (valor: { ok: boolean }) => void
  const pendente = new Promise<{ ok: boolean }>((resolve) => { confirmar = resolve })
  const navegacoes: string[] = []
  const abertura = abrirPagamentoAposLimpeza(() => pendente, 'https://sandbox.mercadopago.com/pay',
    (url) => { navegacoes.push(url) })
  await Promise.resolve()
  assert.deepEqual(navegacoes, [])
  confirmar({ ok: true })
  assert.deepEqual(await abertura, { ok: true })
  assert.deepEqual(navegacoes, ['https://sandbox.mercadopago.com/pay'])
})

test('falha do PUT mantém pagamento pendente sem navegação', async () => {
  const navegacoes: string[] = []
  const resultado = await abrirPagamentoAposLimpeza(
    async () => ({ ok: false, mensagem: 'Sem conexão.' }), 'https://sandbox.mercadopago.com/pay',
    (url) => { navegacoes.push(url) })
  assert.deepEqual(resultado, { ok: false, mensagem: 'Sem conexão.' })
  assert.deepEqual(navegacoes, [])
})

test('só abre links de checkout do Mercado Pago em HTTPS, de teste ou de produção', () => {
  assert.equal(linkDePagamentoConfiavel('https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1')?.hostname, 'sandbox.mercadopago.com.br')
  assert.equal(linkDePagamentoConfiavel('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1')?.hostname, 'www.mercadopago.com.br')
  assert.equal(linkDePagamentoConfiavel('http://www.mercadopago.com.br/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('https://mercadopago.com.br.golpe.com/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('https://usuario:senha@www.mercadopago.com.br/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('não é url'), null)
})
