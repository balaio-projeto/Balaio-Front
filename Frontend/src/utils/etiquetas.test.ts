import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerCamposVideo, normalizarEtiquetas, validarEtiquetas, validarLegenda } from './etiquetas'

test('normaliza etiquetas separadas por espaço, vírgula ou cerquilha', () => {
  assert.deepEqual(normalizarEtiquetas('#Cerâmica, barro  #Tracunhaém'), ['cerâmica', 'barro', 'tracunhaém'])
  assert.deepEqual(normalizarEtiquetas('#renda#bilro,passo-a-passo'), ['renda', 'bilro', 'passo-a-passo'])
  assert.deepEqual(normalizarEtiquetas('  ,, # '), [])
})

test('remove etiquetas repetidas depois de passar para minúsculas', () => {
  assert.deepEqual(normalizarEtiquetas('Barro barro #BARRO argila'), ['barro', 'argila'])
})

test('junta acentos decompostos para casar com o formato do servidor', () => {
  const decomposta = 'ceràmica'.normalize('NFD')
  assert.deepEqual(normalizarEtiquetas(decomposta), ['ceràmica'])
  assert.equal(validarEtiquetas(normalizarEtiquetas(decomposta)), null)
})

test('aceita letras com acento, números e hífen', () => {
  assert.equal(validarEtiquetas(['xilogravura', 'são-joão', 'cordel2024']), null)
  assert.equal(validarEtiquetas([]), null)
})

test('recusa caracteres fora do formato da etiqueta', () => {
  assert.match(validarEtiquetas(['ok', 'passo_a_passo', 'v1.0'])!, /"passo_a_passo", "v1\.0"/)
})

test('recusa etiqueta com mais de 30 caracteres', () => {
  assert.equal(validarEtiquetas(['a'.repeat(30)]), null)
  assert.match(validarEtiquetas(['a'.repeat(31)])!, /até 30 caracteres/)
})

test('recusa mais de 10 etiquetas', () => {
  const dez = Array.from({ length: 10 }, (_, i) => `tag${i}`)
  assert.equal(validarEtiquetas(dez), null)
  assert.match(validarEtiquetas([...dez, 'extra'])!, /até 10 etiquetas/)
})

test('valida a legenda obrigatória com até 500 caracteres', () => {
  assert.match(validarLegenda('   ')!, /Escreva uma legenda/)
  assert.equal(validarLegenda(` ${'a'.repeat(500)} `), null)
  assert.match(validarLegenda('a'.repeat(501))!, /até 500 caracteres/)
})

test('lê os campos do vídeo já normalizados e com erro por campo', () => {
  assert.deepEqual(lerCamposVideo('  Juba do leão  ', '#Barro, barro'), {
    legenda: 'Juba do leão',
    etiquetas: ['barro'],
    erros: { legenda: null, etiquetas: null },
    valido: true,
  })
  const invalido = lerCamposVideo('', 'ok fim.')
  assert.equal(invalido.valido, false)
  assert.ok(invalido.erros.legenda)
  assert.ok(invalido.erros.etiquetas)
})
