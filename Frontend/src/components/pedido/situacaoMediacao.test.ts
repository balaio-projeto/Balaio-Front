import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mediacaoDoPedido, situacaoDaMediacao } from './situacaoMediacao'

test('mediação aberta e em análise ainda não têm decisão para as partes', () => {
  assert.deepEqual(situacaoDaMediacao({ estado: 'aberta' }), { rotulo: 'Aguardando análise da plataforma', encerrada: false, decisao: null })
  assert.equal(situacaoDaMediacao({ estado: 'emAnalise' }).rotulo, 'Em análise pela plataforma')
  assert.equal(situacaoDaMediacao({ emAnalise: true }).rotulo, 'Em análise pela plataforma')
})

test('decisão pendente ou com falha técnica aparece às partes sem expor o erro interno', () => {
  for (const estado of ['decisao_pendente', 'falha_entrega'] as const) {
    assert.deepEqual(situacaoDaMediacao({ estado, decisao: 'negar' }), {
      rotulo: 'Decisão registrada, aplicando ao pedido', encerrada: false, decisao: 'Solicitação negada pela plataforma',
    })
  }
})

test('mediação decidida mostra a decisão em linguagem das partes', () => {
  assert.deepEqual(situacaoDaMediacao({ estado: 'decidida', decisao: 'cancelar_reembolsar' }), {
    rotulo: 'Decidida', encerrada: true, decisao: 'Pedido cancelado com reembolso ao comprador',
  })
})

test('encontra a mediação do pedido sem confundir com outros pedidos', () => {
  const mediacoes = [{ pedido: 'p1', id: 'm1' }, { pedido: 'p2', id: 'm2' }]
  assert.equal(mediacaoDoPedido(mediacoes, 'p2')?.id, 'm2')
  assert.equal(mediacaoDoPedido(mediacoes, 'p3'), null)
})
