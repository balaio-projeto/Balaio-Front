import type { Mediacao } from '@/types/dominio'

const DECISOES_PARA_AS_PARTES: Record<NonNullable<Mediacao['decisao']>, string> = {
  cancelar_reembolsar: 'Pedido cancelado com reembolso ao comprador',
  negar: 'Solicitação negada pela plataforma',
  manter_conversa: 'Seguir a conversa entre comprador e ateliê',
}

export type TomMediacao = 'aguardando' | 'analise' | 'aplicando' | 'falha' | 'decidida' | 'cancelada'

export type SituacaoMediacao = { rotulo: string; encerrada: boolean; decisao: string | null; tom: TomMediacao }

export const CLASSE_DO_SELO_DA_MEDIACAO: Record<TomMediacao, string> = {
  aguardando: 'selo-neutro',
  analise: 'selo-neutro',
  aplicando: 'selo-encomenda',
  falha: 'selo-unica',
  decidida: 'selo-disponivel',
  cancelada: 'selo-neutro',
}

export function situacaoDaMediacao(mediacao: Pick<Mediacao, 'estado' | 'emAnalise' | 'decisao'>): SituacaoMediacao {
  if (mediacao.estado === 'cancelada') {
    return { rotulo: 'Mediação cancelada', encerrada: true, decisao: null, tom: 'cancelada' }
  }
  const decisao = mediacao.decisao ? DECISOES_PARA_AS_PARTES[mediacao.decisao] ?? null : null
  if (mediacao.estado === 'decidida') return { rotulo: 'Decidida', encerrada: true, decisao, tom: 'decidida' }
  if (mediacao.estado === 'falha_entrega') {
    return { rotulo: 'Não foi possível aplicar a decisão ao pedido', encerrada: false, decisao, tom: 'falha' }
  }
  if (mediacao.estado === 'decisao_pendente' || decisao) {
    return { rotulo: 'Decisão registrada, aplicando ao pedido', encerrada: false, decisao, tom: 'aplicando' }
  }
  if (mediacao.estado === 'emAnalise' || mediacao.emAnalise) {
    return { rotulo: 'Em análise pela plataforma', encerrada: false, decisao: null, tom: 'analise' }
  }
  return { rotulo: 'Aguardando análise da plataforma', encerrada: false, decisao: null, tom: 'aguardando' }
}

export function mediacaoAceitaCancelamento(mediacao: Pick<Mediacao, 'estado' | 'emAnalise' | 'decisao'>): boolean {
  if (mediacao.decisao) return false
  const estado = mediacao.estado ?? (mediacao.emAnalise ? 'emAnalise' : 'aberta')
  return estado === 'aberta' || estado === 'emAnalise'
}

export function mediacaoDoPedido<T extends Pick<Mediacao, 'pedido' | 'estado'>>(mediacoes: T[], pedidoId: string): T | null {
  return mediacoes.find((mediacao) => mediacao.pedido === pedidoId && mediacao.estado !== 'cancelada') ?? null
}
