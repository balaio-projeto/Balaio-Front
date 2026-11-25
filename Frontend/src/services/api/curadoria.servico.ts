import type { EstadoSelo, SituacaoSolicitacaoSelo, SolicitacaoSeloNaFila } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import type { RespostaApi } from './tipos'


export type DecisaoSelo = 'aprovada' | 'ajuste'

export type SituacaoFiltroCuradoria = SituacaoSolicitacaoSelo | 'todas'

export type FiltrosFilaCuradoria = {
  situacao?: SituacaoFiltroCuradoria
  busca?: string
  pagina?: number
  tamanho?: number
}

export function listarFilaCuradoria(token?: string, filtros: FiltrosFilaCuradoria = {}): Promise<RespostaApi<SolicitacaoSeloNaFila[]>> {
  const query = montarQuery({
    situacao: filtros.situacao,
    busca: filtros.busca?.trim(),
    pagina: filtros.pagina,
    tamanho: filtros.tamanho,
  })
  return buscar<SolicitacaoSeloNaFila[]>(`/admin/curadoria${query}`, comToken(token))
}

export function consultarPendentesCuradoria(token?: string): Promise<RespostaApi<SolicitacaoSeloNaFila[]>> {
  return buscar<SolicitacaoSeloNaFila[]>('/admin/curadoria?situacao=pendente&tamanho=1&apenasTotal=true', comToken(token))
}

export function totalDaFila(resposta: RespostaApi<SolicitacaoSeloNaFila[]>): number | undefined {
  if (resposta.erro || !resposta.dados) return undefined
  return resposta.paginacao?.total ?? resposta.dados.length
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
