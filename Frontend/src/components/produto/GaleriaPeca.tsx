'use client'

import { useState, type MouseEvent, type SyntheticEvent } from 'react'
import { Maximize2 } from 'lucide-react'
import type { FotoPeca } from '@/types/dominio'
import { IconeEtiqueta } from '@/components/ui/Icones'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import VisualizadorFotos, { type FotoAmpliavel } from '@/components/produto/VisualizadorFotos'
import { imagemReal } from '@/utils/imagem'

type GaleriaPecaProps = {
  imagem: string
  fotos?: FotoPeca[]
  ordemFotos?: string[]
  nome: string
  desconto?: number
}

export default function GaleriaPeca({
  imagem,
  fotos,
  ordemFotos,
  nome,
  desconto,
}: GaleriaPecaProps) {
  const [ativa, definirAtiva] = useState<string | null>(null)
  const [visualizando, definirVisualizando] = useState<number | null>(null)
  const [fotosQueFalharam, definirFotosQueFalharam] = useState<ReadonlySet<string>>(() => new Set())

  const fotosOrdenadas: FotoPeca[] = fotos?.length
    ? [...fotos].sort((a, b) => {
        const ordemA = ordemFotos?.indexOf(a.id) ?? -1
        const ordemB = ordemFotos?.indexOf(b.id) ?? -1
        if (ordemA >= 0 && ordemB >= 0) return ordemA - ordemB
        if (ordemA >= 0) return -1
        if (ordemB >= 0) return 1
        return a.ordem - b.ordem
      })
    : [
        {
          id: 'capa',
          nome,
          url: imagem,
          ordem: 0,
        },
      ]

  const fotoAtual =
    fotosOrdenadas.find((foto) => foto.id === ativa) ??
    fotosOrdenadas[0]

  const fotosAmpliaveis: FotoAmpliavel[] = fotosOrdenadas.flatMap((foto) => {
    const url = imagemReal(foto.url)
    return url && !fotosQueFalharam.has(foto.id) ? [{ id: foto.id, url, nome: foto.nome }] : []
  })
  const indiceAmpliavel = fotosAmpliaveis.findIndex((foto) => foto.id === fotoAtual.id)

  function marcarFalha(id: string) {
    definirFotosQueFalharam((atuais) => (atuais.has(id) ? atuais : new Set(atuais).add(id)))
  }

  function aoFalharImagem(evento: SyntheticEvent<HTMLDivElement>) {
    if (evento.target instanceof HTMLImageElement) marcarFalha(fotoAtual.id)
  }

  function abrirVisualizador(evento: MouseEvent<HTMLButtonElement>) {
    const imagem = evento.currentTarget.querySelector('img')
    if (!imagem || (imagem.complete && imagem.naturalWidth === 0)) {
      marcarFalha(fotoAtual.id)
      return
    }
    definirVisualizando(indiceAmpliavel)
  }

  const imagemPrincipal = (
    <ImagemComFallback
      key={fotoAtual.id}
      src={fotoAtual?.url ?? imagem}
      semImagem={<span className="foto-rotulo">{nome}</span>}
      alt={`${nome} — ${fotoAtual?.nome ?? nome}`}
      className="galeria-principal-img"
      style={{
        transform: 'none',
        objectPosition: 'center',
      }}
    />
  )

  return (
    <div>
      <div className="figura-principal">
        {desconto ? (
          <span className="etiqueta-desconto etiqueta-desconto-sobre-foto">
            <IconeEtiqueta tamanho={13} />
            {desconto}%
            <span className="so-leitor">
              {' '}de desconto do artesão
            </span>
          </span>
        ) : null}

        <div className="foto" onError={aoFalharImagem}>
          {indiceAmpliavel >= 0 ? (
            <button
              type="button"
              className="galeria-ampliar"
              aria-haspopup="dialog"
              aria-label={`Ampliar foto em tela cheia: ${nome} — ${fotoAtual.nome}`}
              onClick={abrirVisualizador}
            >
              {imagemPrincipal}
              <span className="galeria-ampliar-indicador" aria-hidden>
                <Maximize2 size={16} focusable={false} />
              </span>
            </button>
          ) : (
            imagemPrincipal
          )}
        </div>
      </div>

      {fotosOrdenadas.length > 1 && (
        <div
          className="galeria-miniaturas"
          role="group"
          aria-label={`Fotos de ${nome}`}
        >
          {fotosOrdenadas.map((foto, i) => {
            const selecionada = foto.id === fotoAtual.id

            return (
              <button
                key={foto.id}
                type="button"
                className={`galeria-miniatura${
                  selecionada ? ' galeria-miniatura-ativa' : ''
                }`}
                aria-pressed={selecionada}
                aria-label={`Ver foto ${i + 1} de ${nome}`}
                title={`Foto ${i + 1}`}
                onClick={() => definirAtiva(foto.id)}
              >
                <ImagemComFallback
                  src={foto.url}
                  alt=""
                  loading="lazy"
                  style={{
                    transform: 'none',
                    objectPosition: 'center',
                  }}
                />
              </button>
            )
          })}
        </div>
      )}

      {visualizando !== null && fotosAmpliaveis.length > 0 && (
        <VisualizadorFotos
          fotos={fotosAmpliaveis}
          indiceInicial={visualizando}
          titulo={nome}
          aoFechar={(indiceFinal) => {
            const vista = fotosAmpliaveis[indiceFinal]
            if (vista) definirAtiva(vista.id)
            definirVisualizando(null)
          }}
        />
      )}
    </div>
  )
}