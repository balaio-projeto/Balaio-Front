import type { EstadoSelo, SolicitacaoSeloNaFila } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
import type { RespostaApi } from './tipos'


export type DecisaoSelo = 'aprovada' | 'ajuste'

export function listarFilaCuradoria(token?: string): Promise<RespostaApi<SolicitacaoSeloNaFila[]>> {
  return buscar<SolicitacaoSeloNaFila[]>('/admin/curadoria', comToken(token))
}

export function decidirSolicitacaoSelo(id: string, decisao: DecisaoSelo, motivo = ''): Promise<RespostaApi<SolicitacaoSeloNaFila>> {
  return enviar<SolicitacaoSeloNaFila>(`/admin/curadoria/${encodeURIComponent(id)}/decisao`, { decisao, motivo })
}

export function obterMeuSelo(token?: string): Promise<RespostaApi<EstadoSelo>> {
  return buscar<EstadoSelo>('/artesao/selo', comToken(token))
}

export function solicitarSelo(mensagem: string): Promise<RespostaApi<EstadoSelo>> {
  return enviar<EstadoSelo>('/artesao/selo', { mensagem })
}
