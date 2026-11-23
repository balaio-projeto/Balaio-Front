import type { Mediacao } from '@/types/dominio'

const DECISOES_PARA_AS_PARTES: Record<NonNullable<Mediacao['decisao']>, string> = {
  cancelar_reembolsar: 'Pedido cancelado com reembolso ao comprador',
  negar: 'Solicitação negada pela plataforma',
  manter_conversa: 'Seguir a conversa entre comprador e ateliê',
}

export type SituacaoMediacao = { rotulo: string; encerrada: boolean; decisao: string | null }

export function situacaoDaMediacao(mediacao: Pick<Mediacao, 'estado' | 'emAnalise' | 'decisao'>): SituacaoMediacao {
  const decisao = mediacao.decisao ? DECISOES_PARA_AS_PARTES[mediacao.decisao] ?? null : null
  if (mediacao.estado === 'decidida') return { rotulo: 'Decidida', encerrada: true, decisao }
  if (mediacao.estado === 'decisao_pendente' || mediacao.estado === 'falha_entrega' || decisao) {
    return { rotulo: 'Decisão registrada, aplicando ao pedido', encerrada: false, decisao }
  }
  if (mediacao.estado === 'emAnalise' || mediacao.emAnalise) return { rotulo: 'Em análise pela plataforma', encerrada: false, decisao: null }
  return { rotulo: 'Aguardando análise da plataforma', encerrada: false, decisao: null }
}

export function mediacaoDoPedido<T extends Pick<Mediacao, 'pedido'>>(mediacoes: T[], pedidoId: string): T | null {
  return mediacoes.find((mediacao) => mediacao.pedido === pedidoId) ?? null
}
