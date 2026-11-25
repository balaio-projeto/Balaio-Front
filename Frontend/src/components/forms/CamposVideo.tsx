import { useState } from 'react'
import { Campo } from '@/components/ui/Basicos'
import Seletor from '@/components/ui/Seletor'
import type { Video } from '@/types/dominio'
import CampoEtiquetas from '@/components/forms/CampoEtiquetas'
import { TAMANHO_MAXIMO_LEGENDA } from '@/utils/etiquetas'

export type PecaVinculavel = { slug: string; nome: string }

export default function CamposVideo({
  pecas,
  erroLegenda,
  erroEtiquetas,
  video,
}: {
  pecas: PecaVinculavel[]
  erroLegenda: string | null
  erroEtiquetas: string | null
  video?: Video
}) {
  const [tamanhoLegenda, definirTamanhoLegenda] = useState(video?.legenda.length ?? 0)

  return (
    <>
      <Campo
        rotulo="Legenda"
        ajuda={`${tamanhoLegenda} de ${TAMANHO_MAXIMO_LEGENDA} caracteres.`}
        erro={erroLegenda ?? undefined}
        id="video-legenda"
      >
        <textarea
          id="video-legenda"
          name="legenda"
          maxLength={TAMANHO_MAXIMO_LEGENDA}
          defaultValue={video?.legenda}
          onChange={(evento) => definirTamanhoLegenda(evento.target.value.length)}
          placeholder="A juba do leão é feita cacho por cacho, com faca de ponta fina..."
        />
      </Campo>

      <CampoEtiquetas
        id="video-etiquetas"
        nome="etiquetas"
        rotulo="Etiquetas"
        iniciais={video?.etiquetas}
        erro={erroEtiquetas ?? undefined}
      />

      <Campo rotulo="Vincular a uma peça" id="video-peca">
        <Seletor
          id="video-peca"
          name="peca"
          defaultValue={video?.peca ?? ''}
          opcoes={[
            { valor: '', rotulo: 'Nenhuma peça vinculada' },
            ...pecas.map((peca) => ({ valor: peca.slug, rotulo: peca.nome })),
          ]}
        />
      </Campo>
    </>
  )
}
