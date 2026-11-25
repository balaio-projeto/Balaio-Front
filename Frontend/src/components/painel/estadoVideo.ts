import type { EstadoModeracaoVideo, Video } from '@/types/dominio'

const FORMATO_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
})

export function estadoDoVideo(video: Pick<Video, 'situacao' | 'suspensao'>): EstadoModeracaoVideo {
  if (video.suspensao) return 'suspensa'
  return video.situacao === 'rascunho' ? 'rascunho' : 'publicada'
}

export function dataCurta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? null : FORMATO_DATA.format(data)
}
