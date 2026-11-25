import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codigoDoPedido, nomeDoComprador, rotaPedidoDoArtesao, rotaPedidoDoComprador } from './pedido'

test('codigoDoPedido mostra # e os 8 primeiros caracteres do UUID em maiúsculas, como nos e-mails', () => {
  assert.equal(codigoDoPedido('54789ff6-4b76-40fe-a515-9935204d9e93'), '#54789FF6')
  assert.equal(codigoDoPedido('  bb761e83-0b13-405f-a004-2ae2f42e57ae '), '#BB761E83')
})

test('codigoDoPedido é estável quando recebe um código já curto e não inventa código vazio', () => {
  assert.equal(codigoDoPedido('#54789FF6'), '#54789FF6')
  assert.equal(codigoDoPedido(''), '')
  assert.equal(codigoDoPedido(undefined), '')
})

test('nomeDoComprador cai para "Comprador" quando o perfil não respondeu', () => {
  assert.equal(nomeDoComprador({ nome: 'Ana Souza' }), 'Ana Souza')
  assert.equal(nomeDoComprador({ nome: null }), 'Comprador')
  assert.equal(nomeDoComprador({ nome: '   ' }), 'Comprador')
  assert.equal(nomeDoComprador(undefined), 'Comprador')
})

test('rotas do pedido levam à conversa pela mesma âncora para artesão e comprador', () => {
  const id = '54789ff6-4b76-40fe-a515-9935204d9e93'
  assert.equal(rotaPedidoDoArtesao(id), `/dashboard/orders/${id}`)
  assert.equal(rotaPedidoDoArtesao(id, true), `/dashboard/orders/${id}#conversa-pedido`)
  assert.equal(rotaPedidoDoComprador(id, true), `/orders/${id}#conversa-pedido`)
})
