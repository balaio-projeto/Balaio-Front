import type { EstadoModeracaoEvento } from '@/services/api/eventos.servico'

export function resumoDaFilaDeEventos(quantidade: number, estado: EstadoModeracaoEvento): string {
  if (estado === 'PENDENTE') {
    if (quantidade === 0) return 'Nenhum evento aguardando análise'
    return quantidade === 1 ? '1 evento aguardando análise' : `${quantidade} eventos aguardando análise`
  }
  const rotulo = estado === 'APROVADO' ? 'aprovado' : 'rejeitado'
  return quantidade === 1 ? `1 evento ${rotulo}` : `${quantidade} eventos ${rotulo}s`
}
