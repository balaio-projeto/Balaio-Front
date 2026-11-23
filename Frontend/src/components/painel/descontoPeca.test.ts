import assert from 'node:assert/strict'
import { test } from 'node:test'
import { numeroDoDesconto, precoFinalComDesconto, textoDoDesconto, validarDesconto, validarPrecoFinal } from './descontoPeca'

test('desconto vazio ou zero significa sem desconto', () => {
  assert.equal(validarDesconto(''), null)
  assert.equal(validarDesconto('  '), null)
  assert.equal(numeroDoDesconto(''), 0)
  assert.equal(numeroDoDesconto('0'), 0)
  assert.equal(textoDoDesconto(0), '')
  assert.equal(textoDoDesconto(undefined), '')
})

test('aceita de 0 a 90% com até duas casas, com vírgula, ponto ou símbolo de porcentagem', () => {
  for (const valido of ['15', '12,5', '12.5', '90', '90,00', '33,33', '10 %', '7,10']) {
    assert.equal(validarDesconto(valido), null, valido)
  }
  assert.equal(numeroDoDesconto('12,5'), 12.5)
  assert.equal(numeroDoDesconto('15%'), 15)
  assert.equal(textoDoDesconto(12.5), '12,5')
})

test('recusa desconto negativo, acima de 90%, com três casas ou que não é número', () => {
  assert.match(validarDesconto('-1') ?? '', /entre 0 e 90%/)
  assert.match(validarDesconto('abc') ?? '', /entre 0 e 90%/)
  assert.match(validarDesconto('1,2,3') ?? '', /entre 0 e 90%/)
  assert.match(validarDesconto('90,01') ?? '', /máximo é de 90%/)
  assert.match(validarDesconto('100') ?? '', /máximo é de 90%/)
  assert.match(validarDesconto('10,555') ?? '', /2 casas decimais/)
  assert.ok(Number.isNaN(numeroDoDesconto('95')))
})

test('preço final arredonda meio centavo para cima, como a reserva no catálogo', () => {
  assert.equal(precoFinalComDesconto(100, 15), 85)
  assert.equal(precoFinalComDesconto(99.99, 15), 84.99)
  assert.equal(precoFinalComDesconto(10.1, 12.5), 8.84)
  assert.equal(precoFinalComDesconto(0.35, 10), 0.32)
  assert.equal(precoFinalComDesconto(0.29, 50), 0.15)
  assert.equal(precoFinalComDesconto(250, 0), 250)
})

test('desconto não pode levar peça publicada a menos de um centavo', () => {
  assert.equal(validarPrecoFinal(0.01, 50), null)
  assert.match(validarPrecoFinal(0.01, 60) ?? '', /abaixo de R\$ 0,01/)
  assert.equal(validarPrecoFinal(Number.NaN, 60), null)
  assert.equal(validarPrecoFinal(100, 90), null)
})
