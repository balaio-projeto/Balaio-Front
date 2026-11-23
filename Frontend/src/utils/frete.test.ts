import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cepParaCotacao, chaveDaCotacao, itensDaChave, opcaoEscolhida, origemDaCotacao } from './frete'

const opcoes = [
  { id: 'me-1', nome: 'Correios PAC', prazo: '5 a 7 dias úteis', valor: 21.5, provedor: 'melhor_envio_sandbox' },
  { id: 'me-2', nome: 'Correios SEDEX', prazo: '1 a 2 dias úteis', valor: 35.1, provedor: 'melhor_envio_sandbox' },
]

test('só cota CEP com oito dígitos', () => {
  assert.equal(cepParaCotacao('52021-030'), '52021030')
  assert.equal(cepParaCotacao('5202'), null)
  assert.equal(cepParaCotacao(''), null)
})

test('a chave da cotação muda com CEP e itens e independe da ordem', () => {
  const a = chaveDaCotacao('52021030', [{ slug: 'vaso', quantidade: 1 }, { slug: 'jarra', quantidade: 2 }])
  const b = chaveDaCotacao('52021030', [{ slug: 'jarra', quantidade: 2 }, { slug: 'vaso', quantidade: 1 }])
  assert.equal(a, b)
  assert.notEqual(a, chaveDaCotacao('01310100', [{ slug: 'vaso', quantidade: 1 }, { slug: 'jarra', quantidade: 2 }]))
  assert.notEqual(a, chaveDaCotacao('52021030', [{ slug: 'vaso', quantidade: 1 }, { slug: 'jarra', quantidade: 1 }]))
  assert.deepEqual(itensDaChave(a), { cep: '52021030', itens: [{ slug: 'jarra', quantidade: 2 }, { slug: 'vaso', quantidade: 1 }] })
})

test('opção escolhida que sumiu da cotação volta para a primeira disponível', () => {
  assert.equal(opcaoEscolhida(opcoes, 'me-2')?.id, 'me-2')
  assert.equal(opcaoEscolhida(opcoes, 'padrao')?.id, 'me-1')
  assert.equal(opcaoEscolhida([], 'me-1'), undefined)
})

test('a interface diz qual provedor respondeu a cotação', () => {
  assert.match(origemDaCotacao(opcoes) ?? '', /Melhor Envio Sandbox/)
  assert.match(origemDaCotacao([{ id: 'padrao', nome: 'Fixo', prazo: '10 dias', valor: 38.9, provedor: 'fixo_demonstrativo' }]) ?? '', /demonstrativo fixo/)
  assert.equal(origemDaCotacao([]), null)
})
