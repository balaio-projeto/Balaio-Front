import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CLASSE_DO_SELO_DA_MEDIACAO, mediacaoAceitaCancelamento, mediacaoDoPedido, situacaoDaMediacao,
} from './situacaoMediacao'

test('mediação aberta e em análise ainda não têm decisão para as partes', () => {
  assert.deepEqual(situacaoDaMediacao({ estado: 'aberta' }), {
    rotulo: 'Aguardando análise da plataforma', encerrada: false, decisao: null, tom: 'aguardando',
  })
  assert.equal(situacaoDaMediacao({ estado: 'emAnalise' }).rotulo, 'Em análise pela plataforma')
  assert.equal(situacaoDaMediacao({ estado: 'emAnalise' }).tom, 'analise')
  assert.equal(situacaoDaMediacao({ emAnalise: true }).rotulo, 'Em análise pela plataforma')
})

test('decisão pendente aparece às partes como aplicando, com selo informativo', () => {
  const situacao = situacaoDaMediacao({ estado: 'decisao_pendente', decisao: 'negar' })
  assert.deepEqual(situacao, {
    rotulo: 'Decisão registrada, aplicando ao pedido', encerrada: false, decisao: 'Solicitação negada pela plataforma', tom: 'aplicando',
  })
  assert.equal(CLASSE_DO_SELO_DA_MEDIACAO[situacao.tom], 'selo-encomenda')
})

test('falha ao aplicar a decisão aparece clara às partes sem expor o erro interno', () => {
  const situacao = situacaoDaMediacao({ estado: 'falha_entrega', decisao: 'negar' })
  assert.deepEqual(situacao, {
    rotulo: 'Não foi possível aplicar a decisão ao pedido', encerrada: false, decisao: 'Solicitação negada pela plataforma', tom: 'falha',
  })
  assert.equal(CLASSE_DO_SELO_DA_MEDIACAO[situacao.tom], 'selo-unica')
})

test('mediação decidida mostra a decisão em linguagem das partes', () => {
  assert.deepEqual(situacaoDaMediacao({ estado: 'decidida', decisao: 'cancelar_reembolsar' }), {
    rotulo: 'Decidida', encerrada: true, decisao: 'Pedido cancelado com reembolso ao comprador', tom: 'decidida',
  })
  assert.equal(CLASSE_DO_SELO_DA_MEDIACAO.decidida, 'selo-disponivel')
})

test('encontra a mediação do pedido sem confundir com outros pedidos', () => {
  const mediacoes = [{ pedido: 'p1', id: 'm1' }, { pedido: 'p2', id: 'm2' }]
  assert.equal(mediacaoDoPedido(mediacoes, 'p2')?.id, 'm2')
  assert.equal(mediacaoDoPedido(mediacoes, 'p3'), null)
})

test('mediação cancelada aparece encerrada, sem decisão e com selo neutro', () => {
  const situacao = situacaoDaMediacao({ estado: 'cancelada', emAnalise: false, decisao: null })
  assert.deepEqual(situacao, { rotulo: 'Mediação cancelada', encerrada: true, decisao: null, tom: 'cancelada' })
  assert.equal(CLASSE_DO_SELO_DA_MEDIACAO[situacao.tom], 'selo-neutro')
})

test('mediação do pedido ignora as canceladas e escolhe a ativa', () => {
  const mediacoes = [
    { pedido: 'p1', id: 'antiga', estado: 'cancelada' as const },
    { pedido: 'p1', id: 'atual', estado: 'aberta' as const },
    { pedido: 'p2', id: 'so-cancelada', estado: 'cancelada' as const },
  ]
  assert.equal(mediacaoDoPedido(mediacoes, 'p1')?.id, 'atual')
  assert.equal(mediacaoDoPedido(mediacoes, 'p2'), null)
})

test('só mediação aberta ou em análise aceita desistência ou encerramento sem decisão', () => {
  assert.equal(mediacaoAceitaCancelamento({ estado: 'aberta' }), true)
  assert.equal(mediacaoAceitaCancelamento({ estado: 'emAnalise' }), true)
  assert.equal(mediacaoAceitaCancelamento({ emAnalise: true }), true)
  assert.equal(mediacaoAceitaCancelamento({}), true)
  for (const estado of ['decisao_pendente', 'decidida', 'falha_entrega', 'cancelada'] as const) {
    assert.equal(mediacaoAceitaCancelamento({ estado }), false, estado)
  }
  assert.equal(mediacaoAceitaCancelamento({ estado: 'emAnalise', decisao: 'negar' }), false)
})
