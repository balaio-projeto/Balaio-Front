import type { VideoEmModeracao } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import { type RespostaApi } from './tipos'

export const FILTROS_MODERACAO_VIDEO = ['todos', 'publicada', 'suspensa'] as const
export type FiltroModeracaoVideo = (typeof FILTROS_MODERACAO_VIDEO)[number]
export const TAMANHO_PAGINA_MODERACAO_VIDEOS = 20
export const TAMANHO_MINIMO_MOTIVO_SUSPENSAO = 10
export const TAMANHO_MAXIMO_MOTIVO_SUSPENSAO = 1000

export function ehFiltroModeracaoVideo(valor: unknown): valor is FiltroModeracaoVideo {
  return typeof valor === 'string' && (FILTROS_MODERACAO_VIDEO as readonly string[]).includes(valor)
}

export function validarMotivoSuspensao(motivo: string): string | null {
  const tamanho = motivo.trim().length
  if (tamanho < TAMANHO_MINIMO_MOTIVO_SUSPENSAO) {
    return `Explique o motivo com pelo menos ${TAMANHO_MINIMO_MOTIVO_SUSPENSAO} caracteres; o artesão vai receber esse texto.`
  }
  if (tamanho > TAMANHO_MAXIMO_MOTIVO_SUSPENSAO) {
    return `O motivo pode ter até ${TAMANHO_MAXIMO_MOTIVO_SUSPENSAO} caracteres.`
  }
  return null
}

export function listarVideosParaModeracao(
  filtro: FiltroModeracaoVideo, pagina: number, token?: string,
): Promise<RespostaApi<VideoEmModeracao[]>> {
  const query = montarQuery({
    estado: filtro === 'todos' ? undefined : filtro,
    pagina: pagina - 1,
    tamanho: TAMANHO_PAGINA_MODERACAO_VIDEOS,
  })
  return buscar<VideoEmModeracao[]>(`/admin/videos${query}`, comToken(token))
}

export function suspenderVideo(id: string, motivo: string): Promise<RespostaApi<VideoEmModeracao>> {
  return enviar(`/admin/videos/${encodeURIComponent(id)}/suspensao`, { motivo: motivo.trim() })
}

export function reativarVideo(id: string): Promise<RespostaApi<VideoEmModeracao>> {
  return enviar(`/admin/videos/${encodeURIComponent(id)}/reativacao`, {})
}
