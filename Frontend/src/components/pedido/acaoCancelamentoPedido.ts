import type { EstadoPedido } from '@/types/dominio'
import type { ErroApi } from '@/services/api/tipos'

export const ESTADOS_PEDIDO_ENCERRADO: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  'falha_reserva', 'falha_pagamento', 'recusado', 'cancelado', 'reembolsado',
])
const ESTADOS_QUE_ACEITAM_MEDIACAO: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  'confirmado', 'producao', 'enviado', 'entregue',
])
const ESTADOS_COM_PAGAMENTO_CONFIRMADO: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  'confirmado', 'producao', 'enviado', 'entregue',
])
const CODIGOS_DE_PEDIDO_INEXISTENTE = new Set(['RECURSO_NAO_ENCONTRADO', 'PEDIDO_NAO_ENCONTRADO'])

export function acaoCancelamentoPedido(estado: EstadoPedido): 'direto' | 'mediacao' | 'pendente' | 'encerrado' {
  if (['aguardando_reserva', 'aguardando_pagamento', 'confirmado'].includes(estado)) return 'direto'
  if (['confirmacao_pendente', 'cancelamento_pendente', 'reembolso_pendente', 'encerramento_pendente'].includes(estado)) return 'pendente'
  if (['producao', 'enviado', 'entregue'].includes(estado)) return 'mediacao'
  return 'encerrado'
}

export function pedidoEncerrado(estado: EstadoPedido): boolean {
  return ESTADOS_PEDIDO_ENCERRADO.has(estado)
}

export function pedidoAceitaMediacao(estado: EstadoPedido): boolean {
  return ESTADOS_QUE_ACEITAM_MEDIACAO.has(estado)
}

export function pagamentoConfirmado(estado: EstadoPedido): boolean {
  return ESTADOS_COM_PAGAMENTO_CONFIRMADO.has(estado)
}

export function pedidoInexistente(erro: ErroApi | null | undefined): boolean {
  if (!erro) return false
  return erro.status === 404 || erro.status === 400 || CODIGOS_DE_PEDIDO_INEXISTENTE.has(erro.codigo)
}

export type SituacaoListaPedidos = 'aguardando' | 'andamento' | 'entregues' | 'encerrados'

const ESTADOS_AGUARDANDO_PAGAMENTO: ReadonlySet<EstadoPedido> = new Set<EstadoPedido>([
  'aguardando_reserva', 'aguardando_pagamento', 'confirmacao_pendente',
])

export function situacaoNaLista(estado: EstadoPedido): SituacaoListaPedidos {
  if (ESTADOS_AGUARDANDO_PAGAMENTO.has(estado)) return 'aguardando'
  if (estado === 'entregue') return 'entregues'
  if (pedidoEncerrado(estado)) return 'encerrados'
  return 'andamento'
}
