import type { ReactNode } from 'react'
import { IconeAviso, IconeCheck, IconeEditar } from '@/components/ui/Icones'
import type { EstadoModeracaoVideo } from '@/types/dominio'

const APARENCIA: Record<EstadoModeracaoVideo, { classe: string; texto: string; icone: ReactNode }> = {
  publicada: { classe: 'selo-video-publicado', texto: 'Publicado', icone: <IconeCheck tamanho={13} /> },
  suspensa: { classe: 'selo-video-suspenso', texto: 'Suspenso', icone: <IconeAviso tamanho={13} /> },
  rascunho: { classe: 'selo-video-rascunho', texto: 'Rascunho', icone: <IconeEditar tamanho={13} /> },
}

export default function SeloVideo({ estado }: { estado: EstadoModeracaoVideo }) {
  const { classe, texto, icone } = APARENCIA[estado]
  return (
    <span className={`selo ${classe}`}>
      <span className="selo-icone" aria-hidden="true">{icone}</span>
      {texto}
    </span>
  )
}
