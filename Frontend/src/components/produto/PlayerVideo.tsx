'use client'

import { useEffect, useRef, useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'

type Props = { url: string; capa?: string; ativo: boolean; aoIniciar?: () => void }

export default function PlayerVideo({ url, capa, ativo, aoIniciar }: Props) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const jaIniciou = useRef(false)
  const refProgresso = useRef<HTMLSpanElement>(null)
  const [tocando, definirTocando] = useState(false)

  useEffect(() => {
    const elemento = refVideo.current
    if (!elemento) return
    if (ativo) elemento.play().catch(() => definirTocando(false))
    else elemento.pause()
  }, [ativo])

  function alternarReproducao() {
    const elemento = refVideo.current
    if (!elemento) return
    if (elemento.paused) elemento.play().catch(() => avisar.erro('Não foi possível reproduzir o vídeo', 'Tente novamente.'))
    else elemento.pause()
  }

  function atualizarProgresso(elemento: HTMLVideoElement) {
    const proporcao = elemento.duration ? elemento.currentTime / elemento.duration : 0
    if (refProgresso.current) refProgresso.current.style.width = `${proporcao * 100}%`
  }

  return (
    <>
      <video
        ref={refVideo}
        className="video-midia"
        src={url}
        poster={capa}
        preload="metadata"
        muted
        playsInline
        loop
        onClick={alternarReproducao}
        onPlay={() => {
          definirTocando(true)
          if (jaIniciou.current) return
          jaIniciou.current = true
          aoIniciar?.()
        }}
        onPause={() => definirTocando(false)}
        onTimeUpdate={(evento) => atualizarProgresso(evento.currentTarget)}
      />

      <span className="video-progresso" aria-hidden>
        <span ref={refProgresso} className="video-progresso-preenchido" style={{ width: 0 }} />
      </span>

      {!tocando && (
        <button type="button" className="video-play" aria-label="Reproduzir vídeo" onClick={alternarReproducao}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </button>
      )}
    </>
  )
}
