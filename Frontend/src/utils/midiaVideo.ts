import { TAMANHO_MAXIMO_VIDEO, TIPOS_DE_VIDEO } from '@/services/api/videos.servico'

export type MetadadosVideo = { duracao: string; capa: Blob | null }

const PRAZO_LEITURA_MS = 15_000
const LARGURA_MAXIMA_CAPA = 720
const QUALIDADE_CAPA = 0.82
const INSTANTE_CAPA_SEGUNDOS = 1
const BYTES_POR_MB = 1024 * 1024
const DURACAO_DESCONHECIDA = '0:00'

export const DESCRICAO_LIMITE_VIDEO = `MP4 ou WebM, até ${TAMANHO_MAXIMO_VIDEO / BYTES_POR_MB} MB.`

export function problemaDoArquivoDeVideo(arquivo: File | null | undefined): string | null {
  if (!arquivo) return 'Escolha o arquivo do vídeo'
  if (!TIPOS_DE_VIDEO.includes(arquivo.type)) return 'Use um vídeo MP4 ou WebM'
  if (arquivo.size > TAMANHO_MAXIMO_VIDEO) return `O vídeo precisa ter até ${TAMANHO_MAXIMO_VIDEO / BYTES_POR_MB} MB`
  return null
}

export function formatarDuracao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return DURACAO_DESCONHECIDA
  const total = Math.round(segundos)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function capturarQuadro(video: HTMLVideoElement): Promise<Blob | null> {
  const escala = Math.min(1, LARGURA_MAXIMA_CAPA / (video.videoWidth || LARGURA_MAXIMA_CAPA))
  const tela = document.createElement('canvas')
  tela.width = Math.round(video.videoWidth * escala)
  tela.height = Math.round(video.videoHeight * escala)
  const contexto = tela.getContext('2d')
  if (!contexto || !tela.width || !tela.height) return Promise.resolve(null)
  contexto.drawImage(video, 0, 0, tela.width, tela.height)
  return new Promise((resolver) => tela.toBlob(resolver, 'image/jpeg', QUALIDADE_CAPA))
}

function instanteDaCapa(duracao: number): number {
  return Number.isFinite(duracao) ? Math.min(INSTANTE_CAPA_SEGUNDOS, duracao / 2) : 0
}

export function lerMetadadosDoVideo(arquivo: File): Promise<MetadadosVideo> {
  const endereco = URL.createObjectURL(arquivo)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  let temporizador: ReturnType<typeof setTimeout> | undefined

  const leitura = new Promise<MetadadosVideo>((resolver, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new Error('O vídeo demorou demais para ser lido.')), PRAZO_LEITURA_MS)
    video.onerror = () => rejeitar(new Error('Não foi possível ler o vídeo escolhido.'))
    video.onloadedmetadata = () => {
      video.currentTime = instanteDaCapa(video.duration)
    }
    video.onseeked = async () => {
      const capa = await capturarQuadro(video).catch(() => null)
      resolver({ duracao: formatarDuracao(video.duration), capa })
    }
  })

  video.src = endereco
  return leitura.finally(() => {
    clearTimeout(temporizador)
    video.onerror = null
    video.onloadedmetadata = null
    video.onseeked = null
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(endereco)
  })
}
