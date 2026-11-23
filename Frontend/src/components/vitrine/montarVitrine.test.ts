import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarDestaques, QUANTIDADE_DE_DESTAQUES } from './montarVitrine'
import type { Peca } from '@/types/dominio'

function peca(slug: string, extras: Partial<Peca> = {}): Peca {
  return { slug, nome: `Peça ${slug}`, territorio: 'Caruaru', historia: ['Feita à mão.'], imagem: `/api/v1/arquivos/pecas/${slug}.webp`, ...extras } as Peca
}

test('destaques sorteiam até o limite e mudam conforme o sorteio', () => {
  const catalogo = Array.from({ length: 12 }, (_, i) => peca(`p${i}`))
  const primeiro = montarDestaques(catalogo, () => 0.1).map((d) => d.slug)
  const segundo = montarDestaques(catalogo, () => 0.9).map((d) => d.slug)
  assert.equal(primeiro.length, QUANTIDADE_DE_DESTAQUES)
  assert.equal(new Set(primeiro).size, QUANTIDADE_DE_DESTAQUES)
  assert.notDeepEqual(primeiro, segundo)
})

test('destaques preferem peças com foto e ignoram peças inativadas', () => {
  const catalogo = [
    peca('sem-foto', { imagem: '' }),
    peca('inativa', { inativadoEm: '2026-11-01T00:00:00Z' }),
    peca('com-foto'),
  ]
  const slugs = montarDestaques(catalogo, () => 0.5).map((d) => d.slug)
  assert.deepEqual(slugs, ['com-foto', 'sem-foto'])
})

test('destaque usa o título editorial quando existe e o nome da peça nos demais', () => {
  const [editorial] = montarDestaques([peca('o-casamento-de-barro')], () => 0)
  const [comum] = montarDestaques([peca('jarro')], () => 0)
  assert.notEqual(editorial.titulo, editorial.nome)
  assert.equal(comum.titulo, 'Peça jarro')
})
