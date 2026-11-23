'use client'

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { LoaderCircle, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { avisar } from '@/components/feedback/Avisos'
import { definirPreferenciaSom, lerPreferenciaSom, usePreferenciaSom } from '@/components/produto/preferenciaSomVideo'

type Props = { url: string; capa?: string; ativo: boolean; carregar: boolean; aoIniciar?: () => void }
type EstadoSom = { mudo: boolean; volume: number }

const ESPERA_ANTES_DE_DESTRAVAR_MS = 3500
const TENTATIVAS_DE_DESTRAVAR_COM_BUSCA = 1

function pausarOutrosVideos(atual: HTMLVideoElement) {
  for (const outro of document.querySelectorAll<HTMLVideoElement>('video.video-midia')) {
    if (outro !== atual && !outro.paused) outro.pause()
  }
}

function erroDeNome(erro: unknown, nome: string) {
  return erro instanceof DOMException && erro.name === nome
}

function tocarVideo(elemento: HTMLVideoElement, aoFalhar: () => void) {
  elemento.play().catch((erro: unknown) => {
    if (erroDeNome(erro, 'AbortError')) return
    if (erroDeNome(erro, 'NotAllowedError') && !elemento.muted) {
      elemento.muted = true
      elemento.play().catch((novoErro: unknown) => {
        if (!erroDeNome(novoErro, 'AbortError')) aoFalhar()
      })
      return
    }
    aoFalhar()
  })
}

export default function PlayerVideo({ url, capa, ativo, carregar, aoIniciar }: Props) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const refProgresso = useRef<HTMLSpanElement>(null)
  const jaIniciou = useRef(false)
  const posicaoGuardada = useRef<{ url: string; tempo: number } | null>(null)
  const vigiaTravamento = useRef<number | null>(null)
  const tentativasDeDestravar = useRef(0)
  const preferencia = usePreferenciaSom()
  const [tocando, definirTocando] = useState(false)
  const [esperando, definirEsperando] = useState(false)
  const [som, definirSom] = useState<EstadoSom>({ mudo: true, volume: 1 })

  function sincronizarSom(elemento: HTMLVideoElement) {
    definirSom({ mudo: elemento.muted || elemento.volume === 0, volume: elemento.volume })
  }

  function pararVigia() {
    if (vigiaTravamento.current !== null) window.clearTimeout(vigiaTravamento.current)
    vigiaTravamento.current = null
  }

  function destravar(elemento: HTMLVideoElement) {
    const tempo = elemento.currentTime
    if (tentativasDeDestravar.current < TENTATIVAS_DE_DESTRAVAR_COM_BUSCA) {
      tentativasDeDestravar.current += 1
      elemento.currentTime = tempo
      return
    }
    tentativasDeDestravar.current = 0
    elemento.load()
    elemento.currentTime = tempo
    tocar(elemento, false)
  }

  function vigiarTravamento() {
    pararVigia()
    vigiaTravamento.current = window.setTimeout(() => {
      vigiaTravamento.current = null
      const elemento = refVideo.current
      if (!elemento || elemento.paused || elemento.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return
      destravar(elemento)
      vigiarTravamento()
    }, ESPERA_ANTES_DE_DESTRAVAR_MS)
  }

  function tocar(elemento: HTMLVideoElement, pedidoPeloUsuario: boolean) {
    tocarVideo(elemento, () => {
      definirTocando(!elemento.paused)
      if (pedidoPeloUsuario) avisar.erro('Não foi possível reproduzir o vídeo', 'Tente novamente.')
    })
  }

  useEffect(() => {
    const elemento = refVideo.current
    if (!elemento) return
    if (carregar) {
      if (elemento.getAttribute('src') === url) return
      elemento.src = url
      const guardada = posicaoGuardada.current
      if (guardada?.url === url && guardada.tempo > 0) elemento.currentTime = guardada.tempo
      return
    }
    if (!elemento.hasAttribute('src')) return
    posicaoGuardada.current = { url: elemento.getAttribute('src') ?? url, tempo: elemento.currentTime }
    pararVigia()
    elemento.pause()
    elemento.removeAttribute('src')
    elemento.load()
  }, [carregar, url])

  useEffect(() => {
    const elemento = refVideo.current
    if (!elemento) return
    elemento.volume = preferencia.volume
    elemento.muted = preferencia.mudo
    sincronizarSom(elemento)
  }, [preferencia])

  useEffect(() => {
    const elemento = refVideo.current
    if (!elemento) return
    if (ativo) tocarVideo(elemento, () => definirTocando(!elemento.paused))
    else elemento.pause()
  }, [ativo])

  useEffect(() => {
    const elemento = refVideo.current
    if (elemento) definirTocando(!elemento.paused)
    return () => pararVigia()
  }, [])

  function alternarReproducao() {
    const elemento = refVideo.current
    if (!elemento) return
    if (elemento.paused) tocar(elemento, true)
    else elemento.pause()
  }

  function alternarSom() {
    const elemento = refVideo.current
    if (!elemento) return
    if (elemento.muted || elemento.volume === 0) {
      const volume = elemento.volume > 0 ? elemento.volume : lerPreferenciaSom().volume
      elemento.volume = volume
      elemento.muted = false
      definirPreferenciaSom({ mudo: false, volume })
    } else {
      elemento.muted = true
      definirPreferenciaSom({ mudo: true })
    }
    sincronizarSom(elemento)
  }

  function mudarVolume(evento: ChangeEvent<HTMLInputElement>) {
    const elemento = refVideo.current
    if (!elemento) return
    const volume = Math.min(1, Math.max(0, Number(evento.target.value)))
    elemento.volume = volume
    elemento.muted = volume === 0
    definirPreferenciaSom(volume === 0 ? { mudo: true } : { mudo: false, volume })
    sincronizarSom(elemento)
  }

  function atualizarProgresso(elemento: HTMLVideoElement) {
    const proporcao = elemento.duration ? elemento.currentTime / elemento.duration : 0
    if (refProgresso.current) refProgresso.current.style.width = `${proporcao * 100}%`
  }

  const volumeExibido = som.mudo ? 0 : som.volume
  const IconeSom = som.mudo ? VolumeX : som.volume < 0.5 ? Volume1 : Volume2

  return (
    <>
      <video
        ref={refVideo}
        className="video-midia"
        poster={capa}
        preload={ativo ? 'auto' : 'metadata'}
        muted
        playsInline
        loop
        onClick={alternarReproducao}
        onPlay={(evento) => {
          definirTocando(true)
          pausarOutrosVideos(evento.currentTarget)
          if (jaIniciou.current) return
          jaIniciou.current = true
          aoIniciar?.()
        }}
        onPause={() => {
          definirTocando(false)
          definirEsperando(false)
          pararVigia()
        }}
        onPlaying={() => {
          definirTocando(true)
          definirEsperando(false)
          tentativasDeDestravar.current = 0
          pararVigia()
        }}
        onWaiting={(evento) => {
          if (evento.currentTarget.paused) return
          definirEsperando(true)
          vigiarTravamento()
        }}
        onStalled={(evento) => {
          const elemento = evento.currentTarget
          if (elemento.paused || elemento.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return
          vigiarTravamento()
        }}
        onEmptied={() => definirEsperando(false)}
        onError={(evento) => {
          const elemento = evento.currentTarget
          if (!elemento.error) return
          pararVigia()
          definirEsperando(false)
          if (!elemento.paused) elemento.pause()
          definirTocando(false)
        }}
        onVolumeChange={(evento) => sincronizarSom(evento.currentTarget)}
        onTimeUpdate={(evento) => atualizarProgresso(evento.currentTarget)}
      />

      <span className="video-progresso" aria-hidden>
        <span ref={refProgresso} className="video-progresso-preenchido" style={{ width: 0 }} />
      </span>

      <div className="video-controles">
        <button
          type="button"
          className="video-controle"
          aria-label={tocando ? 'Pausar vídeo' : 'Reproduzir vídeo'}
          onClick={alternarReproducao}
        >
          {tocando ? <Pause size={18} aria-hidden focusable={false} /> : <Play size={18} aria-hidden focusable={false} />}
        </button>
        <div className="video-som">
          <button
            type="button"
            className="video-controle"
            aria-label={som.mudo ? 'Ativar som' : 'Silenciar vídeo'}
            onClick={alternarSom}
          >
            <IconeSom size={18} aria-hidden focusable={false} />
          </button>
          <input
            type="range"
            className="video-volume"
            min={0}
            max={1}
            step={0.05}
            value={volumeExibido}
            onChange={mudarVolume}
            aria-label="Volume do vídeo"
            aria-valuetext={`${Math.round(volumeExibido * 100)}%`}
            style={{ '--volume-preenchido': `${volumeExibido * 100}%` } as CSSProperties}
          />
        </div>
      </div>

      {tocando && esperando && (
        <span className="video-carregando" role="status">
          <LoaderCircle size={34} aria-hidden focusable={false} />
          <span className="so-leitor">Carregando vídeo</span>
        </span>
      )}

      {!tocando && (
        <button type="button" className="video-play" aria-hidden tabIndex={-1} onClick={alternarReproducao}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </button>
      )}
    </>
  )
}
