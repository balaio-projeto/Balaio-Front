import assert from 'node:assert/strict'
import { test } from 'node:test'
import { imagemReal } from './imagem'

test('imagens de demonstração e a antiga imagem padrão contam como sem foto', () => {
  for (const imagem of ['/fotos/ImagemBase.webp', '/fotos/leao-imperial.svg', 'https://balaio.torreszx.space/fotos/ImagemBase.webp']) {
    assert.equal(imagemReal(imagem), undefined)
  }
})

test('vazio e ausente contam como sem foto', () => {
  for (const imagem of [undefined, null, '', '   ']) assert.equal(imagemReal(imagem), undefined)
})

test('fotos enviadas de verdade são mantidas', () => {
  assert.equal(imagemReal('/api/v1/arquivos/pecas/4171029f-3bbd-4650-9c1a-1a2b3c4d5e6f.webp'),
    '/api/v1/arquivos/pecas/4171029f-3bbd-4650-9c1a-1a2b3c4d5e6f.webp')
  assert.equal(imagemReal('/api/v1/arquivos/perfis/abc'), '/api/v1/arquivos/perfis/abc')
})
