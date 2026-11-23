'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { imagemReal } from '@/utils/imagem'

type Props = {
  src?: string | null
  semImagem?: ReactNode
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  width?: number
  height?: number
  style?: CSSProperties
}

export default function ImagemComFallback({ src, semImagem = null, alt, ...resto }: Props) {
  const imagem = useRef<HTMLImageElement>(null)
  const fonte = imagemReal(src)
  const [fonteQueFalhou, definirFonteQueFalhou] = useState<string | null>(null)

  useEffect(() => {
    const elemento = imagem.current
    const falhouAntesDaHidratacao = elemento?.complete && elemento.naturalWidth === 0
    if (fonte && falhouAntesDaHidratacao) definirFonteQueFalhou(fonte)
  }, [fonte])

  if (!fonte || fonteQueFalhou === fonte) return <>{semImagem}</>

  return (
    <img
      ref={imagem}
      src={fonte}
      alt={alt}
      onError={() => definirFonteQueFalhou(fonte)}
      {...resto}
    />
  )
}
