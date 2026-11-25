import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  acaoDaTeclaNaEtiqueta, descreverRecusas, etiquetasComoTexto, incluirEtiquetas, lerCamposVideo, normalizarEtiquetas,
  removerEtiqueta, separarDigitacao, validarEtiquetas, validarLegenda,
} from './etiquetas'

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

test('Enter, vírgula, espaço e cerquilha confirmam a etiqueta; Tab só confirma quando há texto', () => {
  for (const tecla of ['Enter', ',', ' ', '#']) assert.equal(acaoDaTeclaNaEtiqueta(tecla, 'barro'), 'confirmar', tecla)
  assert.equal(acaoDaTeclaNaEtiqueta('Enter', ''), 'confirmar')
  assert.equal(acaoDaTeclaNaEtiqueta('Tab', 'barro'), 'confirmar')
  assert.equal(acaoDaTeclaNaEtiqueta('Tab', '  '), 'nenhuma')
  assert.equal(acaoDaTeclaNaEtiqueta('a', 'barr'), 'nenhuma')
  assert.equal(acaoDaTeclaNaEtiqueta('Enter', 'barro', true), 'nenhuma')
})

test('Backspace com o campo vazio remove a última etiqueta', () => {
  assert.equal(acaoDaTeclaNaEtiqueta('Backspace', ''), 'removerUltima')
  assert.equal(acaoDaTeclaNaEtiqueta('Backspace', 'b'), 'nenhuma')
  assert.deepEqual(removerEtiqueta(['barro', 'argila'], 'barro'), ['argila'])
})

test('confirmar com Enter inclui a etiqueta normalizada e esvazia o rascunho', () => {
  assert.deepEqual(incluirEtiquetas(['barro'], '#Cerâmica'), { etiquetas: ['barro', 'cerâmica'], recusadas: [], pendente: '' })
})

test('colar texto com várias etiquetas separa cada uma', () => {
  const resultado = incluirEtiquetas([], '#renda, bilro  passo-a-passo#Tracunhaém')
  assert.deepEqual(resultado.etiquetas, ['renda', 'bilro', 'passo-a-passo', 'tracunhaém'])
  assert.equal(resultado.pendente, '')
})

test('etiqueta duplicada é ignorada e avisada', () => {
  const resultado = incluirEtiquetas(['barro'], 'BARRO, argila, barro')
  assert.deepEqual(resultado.etiquetas, ['barro', 'argila'])
  assert.deepEqual(resultado.recusadas, [{ etiqueta: 'barro', motivo: 'repetida' }])
  assert.equal(resultado.pendente, '')
  assert.equal(descreverRecusas(resultado.recusadas), '#barro já está na lista.')
})

test('respeita o limite de quantidade e avisa o que ficou de fora', () => {
  const nove = Array.from({ length: 9 }, (_, i) => `tag${i}`)
  const resultado = incluirEtiquetas(nove, 'dez, onze, doze')
  assert.equal(resultado.etiquetas.length, 10)
  assert.equal(resultado.etiquetas.at(-1), 'dez')
  assert.deepEqual(resultado.recusadas.map(({ motivo }) => motivo), ['limite', 'limite'])
  assert.equal(resultado.pendente, '')
  assert.equal(descreverRecusas(resultado.recusadas), 'O limite é de 10 etiquetas; #onze e #doze ficaram de fora.')
})

test('etiqueta longa ou com caractere inválido volta para o campo para ser corrigida', () => {
  const resultado = incluirEtiquetas([], `ok v1.0 ${'a'.repeat(31)}`)
  assert.deepEqual(resultado.etiquetas, ['ok'])
  assert.equal(resultado.pendente, `v1.0 ${'a'.repeat(31)}`)
  assert.match(descreverRecusas(resultado.recusadas)!, /até 30 caracteres/)
  assert.match(descreverRecusas(resultado.recusadas)!, /Ajuste #v1\.0\./)
  assert.equal(descreverRecusas([]), null)
})

test('digitação com separador confirma o que vem antes e mantém o resto no campo', () => {
  assert.deepEqual(separarDigitacao('barro,arg'), { confirmar: 'barro', restante: 'arg' })
  assert.deepEqual(separarDigitacao('barro argila '), { confirmar: 'barro argila', restante: '' })
  assert.equal(separarDigitacao('barro'), null)
})

test('o valor enviado continua no formato de texto lido por lerCamposVideo', () => {
  const texto = etiquetasComoTexto([...incluirEtiquetas([], 'barro, argila').etiquetas, 'rascunho'])
  assert.deepEqual(lerCamposVideo('Legenda', texto).etiquetas, ['barro', 'argila', 'rascunho'])
})
