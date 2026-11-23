'use client'

import Link from 'next/link'
import { Foto, Retrato } from '@/components/ui/Basicos'
import BotaoFavoritar from '@/components/produto/BotaoFavoritar'
import { IconeEstrela } from '@/components/ui/Icones'
import { useDados } from '@/store/dados'
import { type Peca } from '@/types/dominio'
import PrecoPeca from '@/components/produto/PrecoPeca'

export default function CartaoPeca({ peca }: { peca: Peca }) {
  const { artesaos, carregando } = useDados()
  const artesao = artesaos.find((a) => a.slug === peca.artesao)

  return (
    <article className="cartao-peca">
      <div className="cartao-peca-figura">
        <Foto nome={peca.nome} imagem={peca.imagem} decorativa />
      </div>
      <div className="cartao-peca-corpo">
        <span className="territorio">{peca.territorio}</span>
        <h3 className="cartao-peca-nome">
          <Link href={`/pieces/${peca.slug}`} className="cartao-peca-link">
            {peca.nome}
          </Link>
        </h3>
        <span className="autoria autoria-com-retrato" data-carregando={carregando || undefined}>
          <Retrato imagem={artesao?.imagem} tamanho={20} />
          por {artesao?.nome ?? 'Artesão parceiro'}
        </span>

        {!!peca.avaliacao && (
          <span className="avaliacao-compacta">
            <IconeEstrela tamanho={14} />
            <strong>{peca.avaliacao.toFixed(1)}</strong>
            <span className="texto-suave">
              · {peca.totalAvaliacoes} {peca.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </span>
        )}

        <div className="cartao-peca-precos">
          <PrecoPeca peca={peca} />
        </div>
      </div>
      <BotaoFavoritar slug={peca.slug} nome={peca.nome} />
    </article>
  )
}
