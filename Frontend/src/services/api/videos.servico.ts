import type { Comentario, Video } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
import { LIMITE_MIDIA } from './rotas-proxy'
import { type RespostaApi } from './tipos'

export const TIPOS_DE_VIDEO: readonly string[] = ['video/mp4', 'video/webm']
export const TAMANHO_MAXIMO_VIDEO = LIMITE_MIDIA
const PRAZO_UPLOAD_MS = 10 * 60_000

function caminhoDoVideo(id: string): string {
  return `/videos/${encodeURIComponent(id)}`
}

export async function listarVideos(painel = false, token?: string): Promise<RespostaApi<Video[]>> {
  return buscar<Video[]>(`/videos${painel ? '?painel=true' : ''}`, comToken(token))
}

export async function registrarVisualizacao(id: string): Promise<RespostaApi<null>> {
  return buscar<null>(`${caminhoDoVideo(id)}/visualizacoes`, { method: 'POST' })
}

export type NovoVideo = Pick<Video, 'legenda' | 'etiquetas' | 'duracao'> & { peca?: string }

export function criarRascunho(video: NovoVideo): Promise<RespostaApi<Video>> {
  return enviar('/videos', { ...video, peca: video.peca || null, situacao: 'rascunho' })
}

function enviarMidia(id: string, tipo: 'arquivo' | 'capa', conteudo: Blob, query = ''): Promise<RespostaApi<Video>> {
  return buscar<Video>(`${caminhoDoVideo(id)}/${tipo}${query}`, {
    method: 'PUT',
    body: conteudo,
    headers: { 'Content-Type': conteudo.type },
    signal: AbortSignal.timeout(PRAZO_UPLOAD_MS),
  })
}

export function enviarArquivoDoVideo(id: string, arquivo: File, duracao: string): Promise<RespostaApi<Video>> {
  return enviarMidia(id, 'arquivo', arquivo, `?duracao=${encodeURIComponent(duracao)}`)
}

export function enviarCapaDoVideo(id: string, capa: Blob): Promise<RespostaApi<Video>> {
  return enviarMidia(id, 'capa', capa)
}

export type AlteracoesVideo = Partial<Pick<Video, 'legenda' | 'etiquetas' | 'peca' | 'situacao'>>

export function atualizarVideo(id: string, alteracoes: AlteracoesVideo): Promise<RespostaApi<Video>> {
  return enviar(caminhoDoVideo(id), alteracoes, 'PATCH')
}

export function removerVideo(id: string): Promise<RespostaApi<Video>> {
  return buscar<Video>(caminhoDoVideo(id), { method: 'DELETE' })
}

export function comentarVideo(id: string, texto: string): Promise<RespostaApi<Comentario>> {
  return enviar(`${caminhoDoVideo(id)}/comentarios`, { texto })
}

export async function obterVideo(id: string): Promise<RespostaApi<Video>> {
  return buscar<Video>(caminhoDoVideo(id))
}

export async function comentariosDe(id: string): Promise<RespostaApi<Comentario[]>> {
  return buscar<Comentario[]>(`${caminhoDoVideo(id)}/comentarios`)
}
