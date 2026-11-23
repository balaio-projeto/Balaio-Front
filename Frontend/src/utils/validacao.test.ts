import assert from 'node:assert/strict'
import { test } from 'node:test'
import { numeroDoPreco, validarComprimento, validarPreco } from './validacao'

test('validarPreco aceita até R$ 1.000.000,00 com no máximo 2 casas decimais', () => {
  assert.equal(validarPreco('180,00'), null)
  assert.equal(validarPreco('1.000.000,00'), null)
  assert.equal(validarPreco('1000000'), null)
  assert.equal(validarPreco('10,500'), null)
  assert.equal(validarPreco('99.90'), null)
  assert.notEqual(validarPreco('1.000.000,01'), null)
  assert.notEqual(validarPreco('2000000'), null)
  assert.notEqual(validarPreco('10,555'), null)
  assert.notEqual(validarPreco('0,001'), null)
  assert.notEqual(validarPreco('0'), null)
  assert.notEqual(validarPreco(''), null)
})

test('numeroDoPreco mantém a leitura de milhar e vírgula decimal', () => {
  assert.equal(numeroDoPreco('1.234,56'), 1234.56)
  assert.equal(numeroDoPreco('1.234'), 1234)
  assert.equal(numeroDoPreco('R$ 99,9'), 99.9)
  assert.ok(Number.isNaN(numeroDoPreco('abc')))
})

test('validarComprimento considera o texto sem espaços nas pontas', () => {
  assert.equal(validarComprimento(` ${'a'.repeat(200)} `, 200, 'longo'), null)
  assert.equal(validarComprimento('a'.repeat(201), 200, 'longo'), 'longo')
})
