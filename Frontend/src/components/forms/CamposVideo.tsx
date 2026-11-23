import { useState } from 'react'
import { Campo } from '@/components/ui/Basicos'
import Seletor from '@/components/ui/Seletor'
import type { Video } from '@/types/dominio'
import {
  QUANTIDADE_MAXIMA_ETIQUETAS, TAMANHO_MAXIMO_ETIQUETA, TAMANHO_MAXIMO_LEGENDA, etiquetasComoTexto, normalizarEtiquetas,
} from '@/utils/etiquetas'

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
        ajuda={`Conte o que está acontecendo na cena. Fale como falaria na feira. ${tamanhoLegenda} de ${TAMANHO_MAXIMO_LEGENDA} caracteres.`}
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

      <Campo
        rotulo="Etiquetas"
        ajuda={`Separe por espaço ou vírgula, até ${QUANTIDADE_MAXIMA_ETIQUETAS} etiquetas de ${TAMANHO_MAXIMO_ETIQUETA} caracteres, só com letras, números e hífen. Ajudam quem procura pela técnica.`}
        erro={erroEtiquetas ?? undefined}
        id="video-etiquetas"
      >
        <input
          id="video-etiquetas"
          name="etiquetas"
          defaultValue={video ? etiquetasComoTexto(video.etiquetas) : undefined}
          onBlur={(evento) => {
            evento.currentTarget.value = etiquetasComoTexto(normalizarEtiquetas(evento.currentTarget.value))
          }}
          placeholder="ceramica tracunhaem passo-a-passo"
        />
      </Campo>

      <Campo rotulo="Vincular a uma peça" ajuda="Quem assistir pode ir direto para a peça e comprar." id="video-peca">
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
