import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MENSAGEM_PECA_DO_PROPRIO_ATELIE, PAPEIS_QUE_COMPRAM, pecaDoProprioAtelie, podeComprar } from './papeis'

test('comprador e artesão compram; organizador, admin e visitante não', () => {
  assert.deepEqual(PAPEIS_QUE_COMPRAM, ['comprador', 'artesao'])
  assert.equal(podeComprar('comprador'), true)
  assert.equal(podeComprar('artesao'), true)
  for (const papel of ['organizador', 'admin', '', 'Comprador', null, undefined]) assert.equal(podeComprar(papel), false, String(papel))
})

test('peça do próprio ateliê só vale para o artesão dono', () => {
  const artesao = { papel: 'artesao', artesao: 'artesao-1' }
  assert.equal(pecaDoProprioAtelie(artesao, 'artesao-1'), true)
  assert.equal(pecaDoProprioAtelie(artesao, 'artesao-2'), false)
  assert.equal(pecaDoProprioAtelie({ papel: 'artesao' }, undefined), false)
  assert.equal(pecaDoProprioAtelie({ papel: 'comprador', artesao: 'artesao-1' }, 'artesao-1'), false)
  assert.equal(pecaDoProprioAtelie(null, 'artesao-1'), false)
  assert.equal(MENSAGEM_PECA_DO_PROPRIO_ATELIE, 'Esta peça é do seu ateliê')
})
