import type { Comentario, Video } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import { LIMITE_MIDIA } from './rotas-proxy'
import { type RespostaApi } from './tipos'

export const TIPOS_DE_VIDEO: readonly string[] = ['video/mp4', 'video/webm']
export const TAMANHO_MAXIMO_VIDEO = LIMITE_MIDIA
const PRAZO_UPLOAD_MS = 10 * 60_000

function caminhoDoVideo(id: string): string {
  return `/videos/${encodeURIComponent(id)}`
}

const TAMANHO_PAGINA_VIDEOS = 100
const LIMITE_PAGINAS_VIDEOS_PAINEL = 10
const LIMITE_PAGINAS_VIDEOS_PUBLICOS = 5

export type VideosPaginados = RespostaApi<Video[]> & { cortadoPor: 'limite' | 'falha' | null }

async function listarVideosEmPaginas(
  painel: boolean, limitePaginas: number, token?: string,
): Promise<VideosPaginados> {
  const porId = new Map<string, Video>()
  for (let pagina = 0; pagina < limitePaginas; pagina++) {
    const query = montarQuery({ painel: painel ? 'true' : undefined, pagina, tamanho: TAMANHO_PAGINA_VIDEOS })
    const resposta = await buscar<Video[]>(`/videos${query}`, comToken(token))
    if (resposta.erro || !resposta.dados) {
      if (pagina === 0) return { dados: null, erro: resposta.erro, cortadoPor: null }
      return { dados: [...porId.values()], erro: null, cortadoPor: 'falha' }
    }
    for (const video of resposta.dados) if (!porId.has(video.id)) porId.set(video.id, video)
    if (resposta.dados.length < TAMANHO_PAGINA_VIDEOS) {
      return { dados: [...porId.values()], erro: null, cortadoPor: null }
    }
  }
  return { dados: [...porId.values()], erro: null, cortadoPor: 'limite' }
}

export function listarTodosVideosDoPainel(token?: string): Promise<VideosPaginados> {
  return listarVideosEmPaginas(true, LIMITE_PAGINAS_VIDEOS_PAINEL, token)
}

export function listarVideosPublicados(): Promise<VideosPaginados> {
  return listarVideosEmPaginas(false, LIMITE_PAGINAS_VIDEOS_PUBLICOS)
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

export async function obterVideo(id: string, token?: string): Promise<RespostaApi<Video>> {
  return buscar<Video>(caminhoDoVideo(id), comToken(token))
}

export async function comentariosDe(id: string): Promise<RespostaApi<Comentario[]>> {
  return buscar<Comentario[]>(`${caminhoDoVideo(id)}/comentarios`)
}
