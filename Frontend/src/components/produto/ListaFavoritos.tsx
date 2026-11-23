'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import CartaoPeca from '@/components/produto/CartaoPeca'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import { Foto } from '@/components/ui/Basicos'
import { IconeCoracao } from '@/components/ui/Icones'
import { useFavoritos } from '@/store/favoritos'
import { usePecas } from '@/hooks/usePecas'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import { obterPecaHistorico } from '@/services/api/pecas.servico'
import { classificarFavoritos, slugsSemPecaAVenda, type FavoritoListado } from '@/components/produto/favoritosListados'
import type { Peca } from '@/types/dominio'

type FavoritoIndisponivel = Extract<FavoritoListado, { disponivel: false }>

async function consultarHistorico(slug: string): Promise<[string, Peca | null]> {
  try {
    return [slug, (await obterPecaHistorico(slug)).dados ?? null]
  } catch {
    return [slug, null]
  }
}

function CartaoFavoritoIndisponivel({ favorito }: { favorito: FavoritoIndisponivel }) {
  const { alternar } = useFavoritos()

  function remover() {
    alternar(favorito.slug)
    avisar.info('Peça removida das salvas')
  }

  return (
    <article className="cartao-peca" data-indisponivel>
      <div className="cartao-peca-figura">
        <Foto nome={favorito.nome} imagem={favorito.imagem} decorativa />
      </div>
      <div className="cartao-peca-corpo">
        <span className="selo selo-neutro">
          <span className="selo-ponto" />
          Indisponível
        </span>
        <h3 className="cartao-peca-nome">{favorito.nome}</h3>
        <p className="autoria">
          {favorito.motivo === 'removida' ? 'O ateliê retirou esta peça da plataforma.' : 'Esta peça foi vendida ou saiu do catálogo.'}
        </p>
        <button type="button" className="botao-texto botao-texto-perigo acima-3" onClick={remover}
          aria-label={`Remover ${favorito.nome} das peças salvas`}>
          Remover dos favoritos
        </button>
      </div>
    </article>
  )
}

export default function ListaFavoritos() {
  const { mapaPecas, carregando, erro } = usePecas()
  const { slugs, pronto, erro: erroFavoritos, recarregar } = useFavoritos()
  const [historico, definirHistorico] = useState<ReadonlyMap<string, Peca | null>>(new Map())
  const aConsultar = useMemo(
    () => carregando || erro ? [] : slugsSemPecaAVenda(slugs, mapaPecas).filter((slug) => !historico.has(slug)),
    [carregando, erro, slugs, mapaPecas, historico],
  )
  const chaveConsulta = aConsultar.join('\n')

  useEffect(() => {
    if (!chaveConsulta) return
    let vivo = true
    void Promise.all(chaveConsulta.split('\n').map(consultarHistorico)).then((entradas) => {
      if (vivo) definirHistorico((atual) => new Map([...atual, ...entradas]))
    })
    return () => { vivo = false }
  }, [chaveConsulta])

  const favoritos = classificarFavoritos(slugs, mapaPecas, historico)
  const disponiveis = favoritos.flatMap((favorito) => favorito.disponivel ? [favorito.peca] : [])
  const indisponiveis = favoritos.filter((favorito): favorito is FavoritoIndisponivel => !favorito.disponivel)

  if (!pronto || carregando || aConsultar.length > 0) return <EstadoCarregando />
  if (erroFavoritos) return <EstadoErro mensagem={erroFavoritos} aoTentarNovamente={recarregar} />
  if (erro) return <EstadoErro mensagem={erro} />

  if (favoritos.length === 0) {
    return (
      <EstadoVazio
        icone={<IconeCoracao tamanho={34} />}
        titulo="Você ainda não salvou nenhuma peça"
        descricao="Ao navegar pelo catálogo, use o coração no canto da peça para guardá-la aqui e decidir com calma."
        acao={
          <Link href="/" className="botao botao-primario">
            Explorar o catálogo
          </Link>
        }
      />
    )
  }

  return (
    <>
      {disponiveis.length > 0 && (
        <div className="grade-pecas grade-pecas-compacta escalonado">
          {disponiveis.map((p) => (
            <CartaoPeca key={p.slug} peca={p} />
          ))}
        </div>
      )}
      {indisponiveis.length > 0 && (
        <section className="secao" aria-labelledby="favoritos-indisponiveis">
          <h2 className="secao-titulo" id="favoritos-indisponiveis">Indisponíveis</h2>
          <p className="texto-suave abaixo-4">Peças salvas que não estão mais à venda. Elas ficam aqui até você removê-las.</p>
          <div className="grade-pecas grade-pecas-compacta">
            {indisponiveis.map((favorito) => (
              <CartaoFavoritoIndisponivel key={favorito.slug} favorito={favorito} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
