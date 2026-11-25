import assert from 'node:assert/strict'
import { test } from 'node:test'
import { casaComBusca, estadoDaBusca, normalizarBusca, palavrasDaBusca, singular } from './busca'

// TC14 (TS05): busca sem resultados mostra estado vazio; falha de rede não é confundida com vazio.
test('lista vazia sem erro é estado vazio', () => {
  assert.equal(estadoDaBusca([], null), 'vazio')
  assert.equal(estadoDaBusca(null, undefined), 'vazio')
})

test('falha de rede ou de contrato é erro, mesmo sem itens', () => {
  assert.equal(estadoDaBusca([], { mensagem: 'Serviço indisponível' }), 'erro')
  assert.equal(estadoDaBusca(null, { mensagem: 'Serviço indisponível' }), 'erro')
  assert.equal(estadoDaBusca([{ slug: 'vaso' }], { mensagem: 'parcial' }), 'erro')
})

test('com itens e sem erro, exibe resultados', () => {
  assert.equal(estadoDaBusca([{ slug: 'vaso' }], null), 'resultados')
})

test('normaliza acentos e maiúsculas da busca', () => {
  assert.equal(normalizarBusca('Tracunhaém CERÂMICA'), 'tracunhaem ceramica')
})

test('separa palavras, descarta palavras de ligação e gera variante no singular', () => {
  assert.deepEqual(palavrasDaBusca('  Jarras de Cerâmica '), [['jarras', 'jarra'], ['ceramica']])
  assert.deepEqual(palavrasDaBusca('de'), [['de']])
  assert.deepEqual(palavrasDaBusca('   '), [])
  assert.equal(palavrasDaBusca('a1 a2 a3 a4 a5 a6 a7 a8 a9').length, 8)
})

test('reduz plurais comuns como o catálogo', () => {
  assert.equal(singular('flores'), 'flor')
  assert.equal(singular('artesanais'), 'artesana')
  assert.equal(singular('leoes'), 'lea')
  assert.equal(singular('jardins'), 'jardim')
  assert.equal(singular('mas'), 'mas')
})

test('casa quando todas as palavras aparecem em algum dos campos', () => {
  const campos = ['Severina Ramos', 'Ateliê Barro Vivo', 'Tracunhaém']
  assert.equal(casaComBusca(campos, 'atelie barro vivo'), true)
  assert.equal(casaComBusca(campos, 'SEVERINA tracunhaem'), true)
  assert.equal(casaComBusca(campos, 'severina couro'), false)
  assert.equal(casaComBusca(campos, '   '), false)
  assert.equal(casaComBusca([undefined, null, 'Leões de barro'], 'leões'), true)
})
