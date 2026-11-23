import assert from 'node:assert/strict'
import { test } from 'node:test'
import { abrirPagamentoAposLimpeza, linkDePagamentoConfiavel } from './abrirPagamento'
import { agruparPorAtelie, grupoEscolhido } from './gruposAtelie'
import { semItens, type ItemSacola } from '@/store/sacola'

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

test('agrupa as peças da sacola por ateliê na ordem em que aparecem', () => {
  const entradas = [
    { item: { slug: 'vaso', quantidade: 1 }, peca: { artesao: 'mestre-vitalino' } },
    { item: { slug: 'renda', quantidade: 2 }, peca: { artesao: 'rendeiras-do-cariri' } },
    { item: { slug: 'moringa', quantidade: 1 }, peca: { artesao: 'mestre-vitalino' } },
  ]
  const grupos = agruparPorAtelie(entradas, [{ slug: 'mestre-vitalino', nome: 'Mestre Vitalino' }])
  assert.deepEqual(grupos.map((grupo) => [grupo.artesao, grupo.nome, grupo.entradas.map(({ item }) => item.slug)]), [
    ['mestre-vitalino', 'Mestre Vitalino', ['vaso', 'moringa']],
    ['rendeiras-do-cariri', 'rendeiras do cariri', ['renda']],
  ])
  assert.equal(grupoEscolhido(grupos, null)?.artesao, 'mestre-vitalino')
  assert.equal(grupoEscolhido(grupos, 'rendeiras-do-cariri')?.artesao, 'rendeiras-do-cariri')
  assert.equal(grupoEscolhido(grupos, 'ateliê-que-saiu')?.artesao, 'mestre-vitalino')
})

test('após o pedido de um ateliê, remove só as peças pagas antes de abrir o pagamento', async () => {
  let sacola: ItemSacola[] = [{ slug: 'vaso', quantidade: 1 }, { slug: 'renda', quantidade: 2 }, { slug: 'moringa', quantidade: 1 }]
  const navegacoes: string[] = []
  const resultado = await abrirPagamentoAposLimpeza(async () => {
    sacola = semItens(sacola, ['vaso', 'moringa'])
    return { ok: true }
  }, 'https://sandbox.mercadopago.com/pay', (url) => { navegacoes.push(url) })
  assert.deepEqual(resultado, { ok: true })
  assert.deepEqual(sacola, [{ slug: 'renda', quantidade: 2 }])
  assert.deepEqual(navegacoes, ['https://sandbox.mercadopago.com/pay'])
})

test('só abre links de checkout do Mercado Pago em HTTPS, de teste ou de produção', () => {
  assert.equal(linkDePagamentoConfiavel('https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1')?.hostname, 'sandbox.mercadopago.com.br')
  assert.equal(linkDePagamentoConfiavel('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1')?.hostname, 'www.mercadopago.com.br')
  assert.equal(linkDePagamentoConfiavel('http://www.mercadopago.com.br/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('https://mercadopago.com.br.golpe.com/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('https://usuario:senha@www.mercadopago.com.br/checkout'), null)
  assert.equal(linkDePagamentoConfiavel('não é url'), null)
})
