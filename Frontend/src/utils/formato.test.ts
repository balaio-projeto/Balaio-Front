import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partirReais, precoComDesconto } from './formato'

test('partirReais sempre devolve dois dígitos de centavos, inclusive em valor redondo', () => {
  assert.deepEqual(partirReais(130), { sinal: '', inteiro: '130', centavos: '00' })
  assert.deepEqual(partirReais(0), { sinal: '', inteiro: '0', centavos: '00' })
  assert.deepEqual(partirReais(0.1), { sinal: '', inteiro: '0', centavos: '10' })
  assert.deepEqual(partirReais(19.9), { sinal: '', inteiro: '19', centavos: '90' })
  assert.deepEqual(partirReais(7.05), { sinal: '', inteiro: '7', centavos: '05' })
})

test('partirReais arredonda sem erro de ponto flutuante e separa milhares', () => {
  assert.deepEqual(partirReais(0.1 + 0.2), { sinal: '', inteiro: '0', centavos: '30' })
  assert.deepEqual(partirReais(129.999), { sinal: '', inteiro: '130', centavos: '00' })
  assert.deepEqual(partirReais(1234567.89), { sinal: '', inteiro: '1.234.567', centavos: '89' })
})

test('partirReais trata negativo e valor inválido', () => {
  assert.deepEqual(partirReais(-12.5), { sinal: '-', inteiro: '12', centavos: '50' })
  assert.deepEqual(partirReais(Number.NaN), { sinal: '', inteiro: '0', centavos: '00' })
})

test('partirReais combina com o preço com desconto', () => {
  assert.deepEqual(partirReais(precoComDesconto({ preco: 150, desconto: 10 })), { sinal: '', inteiro: '135', centavos: '00' })
  assert.deepEqual(partirReais(precoComDesconto({ preco: 99.9, desconto: 15 })), { sinal: '', inteiro: '84', centavos: '92' })
})

test('preço com desconto arredonda igual à cobrança do catálogo', () => {
  assert.equal(precoComDesconto({ preco: 0.35, desconto: 10 }), 0.32)
  assert.equal(precoComDesconto({ preco: 0.7, desconto: 15 }), 0.6)
  assert.equal(precoComDesconto({ preco: 99.99, desconto: 15 }), 84.99)
  assert.equal(precoComDesconto({ preco: 10.1, desconto: 12.5 }), 8.84)
  assert.equal(precoComDesconto({ preco: 130, desconto: 0 }), 130)
})
