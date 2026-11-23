import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROXIMO_ESTADO_DO_ARTESAO, rotuloDoPonto, textoDaMetrica, validarRastreio } from './painel'

test('o artesão avança confirmado, produção, enviado e entregue nessa ordem', () => {
  assert.equal(PROXIMO_ESTADO_DO_ARTESAO.confirmado, 'producao')
  assert.equal(PROXIMO_ESTADO_DO_ARTESAO.producao, 'enviado')
  assert.equal(PROXIMO_ESTADO_DO_ARTESAO.enviado, 'entregue')
  assert.equal(PROXIMO_ESTADO_DO_ARTESAO.entregue, undefined)
})

test('rastreio exige código sem espaços entre 5 e 40 caracteres', () => {
  assert.equal(validarRastreio(' BR123456789BR '), null)
  assert.equal(validarRastreio('ME-1234'), null)
  assert.ok(validarRastreio(''))
  assert.ok(validarRastreio('BR 12'))
  assert.ok(validarRastreio('A'.repeat(41)))
})

test('métrica sem fonte aparece como indisponível, nunca como zero', () => {
  assert.equal(textoDaMetrica(null), 'Indisponível')
  assert.equal(textoDaMetrica(undefined), 'Indisponível')
  assert.equal(textoDaMetrica(0), '0')
  assert.equal(textoDaMetrica(12.5, (valor) => `R$ ${valor}`), 'R$ 12.5')
})

test('rótulos da série seguem a granularidade do servidor', () => {
  assert.equal(rotuloDoPonto('2026-11-05', 'dia'), '05/11')
  assert.equal(rotuloDoPonto('2026-11-01', 'mes'), 'nov')
})
