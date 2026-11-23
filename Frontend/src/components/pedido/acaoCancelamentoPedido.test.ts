import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acaoCancelamentoPedido, pedidoAceitaMediacao, pedidoEncerrado, pedidoInexistente, situacaoNaLista } from './acaoCancelamentoPedido'

test('pedido antes da produção oferece cancelamento direto', () => {
  for (const estado of ['aguardando_reserva', 'aguardando_pagamento', 'confirmado'] as const) {
    assert.equal(acaoCancelamentoPedido(estado), 'direto')
  }
})

test('operações pendentes não afirmam início de produção', () => {
  for (const estado of ['confirmacao_pendente', 'cancelamento_pendente', 'reembolso_pendente', 'encerramento_pendente'] as const) {
    assert.equal(acaoCancelamentoPedido(estado), 'pendente')
  }
})

test('produção direciona à mediação; pedidos encerrados não oferecem novo cancelamento', () => {
  for (const estado of ['producao', 'enviado', 'entregue'] as const) {
    assert.equal(acaoCancelamentoPedido(estado), 'mediacao')
  }
  for (const estado of ['falha_reserva', 'falha_pagamento', 'recusado', 'cancelado', 'reembolsado'] as const) {
    assert.equal(acaoCancelamentoPedido(estado), 'encerrado')
  }
})

test('falhas de reserva e de pagamento contam como pedido encerrado', () => {
  for (const estado of ['falha_reserva', 'falha_pagamento', 'recusado', 'cancelado', 'reembolsado'] as const) {
    assert.equal(pedidoEncerrado(estado), true)
  }
  for (const estado of ['aguardando_pagamento', 'confirmado', 'producao', 'entregue', 'reembolso_pendente'] as const) {
    assert.equal(pedidoEncerrado(estado), false)
  }
})

test('mediação só é oferecida nos estados que o commerce aceita', () => {
  for (const estado of ['confirmado', 'producao', 'enviado', 'entregue'] as const) {
    assert.equal(pedidoAceitaMediacao(estado), true)
  }
  for (const estado of ['aguardando_reserva', 'aguardando_pagamento', 'confirmacao_pendente', 'falha_pagamento', 'cancelado'] as const) {
    assert.equal(pedidoAceitaMediacao(estado), false)
  }
})

test('pedido inexistente cobre 404, id inválido e códigos de não encontrado', () => {
  assert.equal(pedidoInexistente({ codigo: 'HTTP_404', mensagem: '', status: 404 }), true)
  assert.equal(pedidoInexistente({ codigo: 'HTTP_400', mensagem: '', status: 400 }), true)
  assert.equal(pedidoInexistente({ codigo: 'PEDIDO_NAO_ENCONTRADO', mensagem: '' }), true)
  assert.equal(pedidoInexistente({ codigo: 'INDISPONIVEL', mensagem: '', status: 503 }), false)
  assert.equal(pedidoInexistente(null), false)
})

test('lista de pedidos separa aguardando pagamento, andamento, entregues e encerrados', () => {
  assert.equal(situacaoNaLista('aguardando_pagamento'), 'aguardando')
  assert.equal(situacaoNaLista('confirmacao_pendente'), 'aguardando')
  assert.equal(situacaoNaLista('producao'), 'andamento')
  assert.equal(situacaoNaLista('cancelamento_pendente'), 'andamento')
  assert.equal(situacaoNaLista('entregue'), 'entregues')
  assert.equal(situacaoNaLista('cancelado'), 'encerrados')
  assert.equal(situacaoNaLista('falha_pagamento'), 'encerrados')
})
