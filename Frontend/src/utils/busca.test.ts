import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estadoDaBusca } from './busca'

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
