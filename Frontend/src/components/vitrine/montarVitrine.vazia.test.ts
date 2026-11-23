import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Peca } from '@/types/dominio'
import { montarDestaques } from './montarVitrine'

const peca = (slug: string, extras: Partial<Peca> = {}): Peca =>
  ({ slug, nome: `Peça ${slug}`, territorio: 'Caruaru', historia: ['Feita à mão.'], imagem: `/api/v1/arquivos/pecas/${slug}.webp`, ...extras }) as Peca

// TC42 (TS24): sem peças elegíveis, a faixa de destaques fica vazia e nenhuma peça é inventada.
test('sem peças publicadas, a lista de destaques é vazia', () => {
  assert.deepEqual(montarDestaques([], () => 0.5), [])
})

test('peças inativadas não entram nos destaques', () => {
  const soInativas = [peca('a', { inativadoEm: '2026-11-01T00:00:00Z' }), peca('b', { inativadoEm: '2026-11-02T00:00:00Z' })]
  assert.deepEqual(montarDestaques(soInativas, () => 0.5), [])
})
