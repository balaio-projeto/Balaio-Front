import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Peca } from '../../types/dominio'
import { classificarFavoritos, estaAVenda, nomeDoSlug, slugsSemPecaAVenda } from './favoritosListados'

function peca(slug: string, extras: Partial<Peca> = {}): Peca {
  return {
    slug, nome: `Peça ${slug}`, artesao: 'artesao-1', territorio: 'Mata Norte', tecnica: 'Cerâmica & Barro',
    categoria: 'Casa & Mesa', tipo: 'Jarras & Vasos', preco: 120, disponibilidade: 'unica', historia: [],
    imagem: `/fotos/${slug}.jpg`, situacao: 'publicada', ...extras,
  } as Peca
}

test('peça publicada e ativa está à venda; inativada, vendida ou rascunho não', () => {
  assert.equal(estaAVenda(peca('a')), true)
  assert.equal(estaAVenda(peca('a', { situacao: undefined })), true)
  assert.equal(estaAVenda(peca('a', { inativadoEm: '2026-11-20T10:00:00Z' })), false)
  assert.equal(estaAVenda(peca('a', { vendidaEmPedido: 'pedido-1' })), false)
  assert.equal(estaAVenda(peca('a', { situacao: 'rascunho' })), false)
})

test('só consulta o histórico das peças que não estão à venda no catálogo, sem repetir', () => {
  const catalogo = new Map([['vaso', peca('vaso')], ['jarra', peca('jarra', { inativadoEm: '2026-11-20' })]])

  assert.deepEqual(slugsSemPecaAVenda(['vaso', 'jarra', 'sumida', 'sumida'], catalogo), ['jarra', 'sumida'])
})

test('favorito fora do catálogo continua listado como indisponível com nome e foto do histórico', () => {
  const historico = new Map([['jarra', peca('jarra', { inativadoEm: '2026-11-20T10:00:00Z' })]])

  const [favorito] = classificarFavoritos(['jarra'], new Map(), historico)

  assert.deepEqual(favorito, {
    slug: 'jarra', disponivel: false, nome: 'Peça jarra', imagem: '/fotos/jarra.jpg', motivo: 'fora_do_catalogo',
  })
})

test('favorito sem histórico é indisponível por remoção e usa o slug como nome', () => {
  const [favorito] = classificarFavoritos(['vaso-de-barro'], new Map(), new Map([['vaso-de-barro', null]]))

  assert.deepEqual(favorito, { slug: 'vaso-de-barro', disponivel: false, nome: 'Vaso de barro', motivo: 'removida' })
})

test('favoritos à venda ficam disponíveis, inclusive quando só o histórico confirma', () => {
  const catalogo = new Map([['vaso', peca('vaso')]])
  const historico = new Map([['prato', peca('prato')]])

  const lista = classificarFavoritos(['vaso', 'prato', 'vaso'], catalogo, historico)

  assert.deepEqual(lista.map((item) => [item.slug, item.disponivel]), [['vaso', true], ['prato', true]])
})

test('peça vendida que ainda aparece no catálogo vira indisponível e mantém a ordem dos favoritos', () => {
  const catalogo = new Map([['unica', peca('unica', { vendidaEmPedido: 'pedido-9' })], ['vaso', peca('vaso')]])

  const lista = classificarFavoritos(['unica', 'vaso'], catalogo, new Map())

  assert.deepEqual(lista.map((item) => [item.slug, item.disponivel]), [['unica', false], ['vaso', true]])
})

test('nome derivado do slug tem reserva quando o slug é vazio', () => {
  assert.equal(nomeDoSlug(''), 'Peça salva')
})
