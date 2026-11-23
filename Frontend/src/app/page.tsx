import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import EstadoErro from '@/components/feedback/EstadoErro'
import CarrosselDestaques from '@/components/produto/CarrosselDestaques'
import CartaoPeca from '@/components/produto/CartaoPeca'
import Prateleira from '@/components/ui/Prateleira'
import { IconeJoia, IconeOferta, IconeRelogio, IconeSetaDireita } from '@/components/ui/Icones'
import Atalho from '@/components/vitrine/Atalho'
import CartaoArtesao from '@/components/vitrine/CartaoArtesao'
import ContagemOfertas from '@/components/vitrine/ContagemOfertas'
import CartaoEventoMini from '@/components/vitrine/CartaoEventoMini'
import MapaEventosVitrine from '@/components/vitrine/MapaEventosVitrine'
import { montarDestaques, montarVitrine } from '@/components/vitrine/montarVitrine'
import { tipos } from '@/constants/referencias'
import { iconePorTipo } from '@/constants/vitrine'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarEventos } from '@/services/api/eventos.servico'
import { listarVideosPublicados } from '@/services/api/videos.servico'
import { imagemReal } from '@/utils/imagem'
import { listarPecas } from '@/services/api/pecas.servico'
import { hrefListagem } from '@/utils/filtrosUrl'
import type { RespostaApi } from '@/services/api/tipos'
import type { Peca } from '@/types/dominio'

const TAMANHO_PAGINA_PECAS = 100
const LIMITE_PAGINAS_PECAS = 5

async function listarPecasDaVitrine(): Promise<RespostaApi<Peca[]>> {
  const porSlug = new Map<string, Peca>()
  let totalPaginas = 1
  for (let pagina = 1; pagina <= Math.min(totalPaginas, LIMITE_PAGINAS_PECAS); pagina++) {
    const resposta = await listarPecas({ pagina, tamanho: TAMANHO_PAGINA_PECAS })
    if (resposta.erro || !resposta.dados) {
      if (pagina === 1) return resposta
      break
    }
    for (const peca of resposta.dados) if (!porSlug.has(peca.slug)) porSlug.set(peca.slug, peca)
    totalPaginas = resposta.paginacao?.totalPaginas ?? 1
  }
  return { dados: [...porSlug.values()], erro: null }
}

export default async function Home() {
  const [pecasResposta, artesaosResposta, eventosResposta, videosResposta] = await Promise.all([
    listarPecasDaVitrine(),
    listarArtesaos(),
    listarEventos(),
    listarVideosPublicados(),
  ])

  if (pecasResposta.erro) {
    return (
      <Pagina>
        <EstadoErro mensagem={pecasResposta.erro.mensagem} />
      </Pagina>
    )
  }

  const pecas = pecasResposta.dados ?? []
  const totalPorArtesao = (slug: string) => pecas.filter((peca) => peca.artesao === slug).length
  const artesaos = (artesaosResposta.dados ?? []).filter((artesao) => totalPorArtesao(artesao.slug) > 0)
  const vitrine = montarVitrine(pecas)
  const eventos = eventosResposta.dados ?? []
  const listaVideos = videosResposta.dados ?? []
  const capasDosVideos = listaVideos.flatMap((video) => imagemReal(video.capa) ?? [])
  const videosDestaque = listaVideos.length > 0 ? { capas: capasDosVideos, total: listaVideos.length } : undefined
  const pontos = eventos.map(({ slug, nome, cidade, periodo, lat, lng }) => ({ slug, nome, cidade, periodo, lat, lng }))

  return (
    <Pagina>
      <CarrosselDestaques destaques={montarDestaques(pecas)} comEventos videos={videosDestaque} tituloPrincipal />

      <Prateleira titulo="Navegue por tipo" variante="atalhos" tituloVisivel={false}>
        {tipos.map((tipo) => (
          <Atalho key={tipo} texto={tipo} href={hrefListagem({ tipo })} icone={iconePorTipo[tipo]} />
        ))}
        <Atalho texto="Ofertas" href={hrefListagem({ desconto: true })} icone={<IconeOferta tamanho={26} />} />
        <Atalho texto="Peças únicas" href={hrefListagem({ disponibilidade: 'unica' })} icone={<IconeJoia tamanho={26} />} />
        <Atalho
          texto="Sob encomenda"
          href={hrefListagem({ disponibilidade: 'encomenda' })}
          icone={<IconeRelogio tamanho={26} />}
        />
      </Prateleira>

      {vitrine.ofertas.length > 0 && (
        <div className="faixa-secao">
          <Prateleira
            titulo="Ofertas do ateliê"
            subtitulo="Descontos definidos pelos próprios artesãos"
            extra={<ContagemOfertas />}
            verTodos={{ href: hrefListagem({ desconto: true }), texto: 'Ver todas' }}
          >
            {vitrine.ofertas.map((peca) => (
              <CartaoPeca key={peca.slug} peca={peca} />
            ))}
          </Prateleira>
        </div>
      )}

      <div className="faixa-secao">
        <Prateleira
          titulo="Mais bem avaliadas"
          subtitulo="As notas mais altas de quem já recebeu em casa"
          verTodos={{ href: hrefListagem({ ordenar: 'avaliacao' }) }}
        >
          {vitrine.maisAvaliadas.map((peca) => (
            <CartaoPeca key={peca.slug} peca={peca} />
          ))}
        </Prateleira>
      </div>

      {artesaos.length > 0 && (
        <div className="faixa-secao">
          <Prateleira
            titulo="Artesãos em destaque"
            subtitulo="Conheça quem está por trás de cada peça"
            variante="cartoes"
          >
            {artesaos.map((artesao) => (
              <CartaoArtesao key={artesao.slug} artesao={artesao} totalPecas={totalPorArtesao(artesao.slug)} />
            ))}
          </Prateleira>
        </div>
      )}

      {eventos.length > 0 && (
        <section className="faixa-secao eventos-vitrine" aria-labelledby="eventos-vitrine-titulo">
          <div className="prateleira-topo">
            <div className="prateleira-titulos">
              <h2 className="prateleira-titulo" id="eventos-vitrine-titulo">
                Eventos e feiras
              </h2>
              <p className="prateleira-subtitulo">Encontre os artesãos pessoalmente, perto de você</p>
            </div>
            <Link href="/events" className="prateleira-ver-todos">
              Ver agenda completa
              <IconeSetaDireita tamanho={14} />
            </Link>
          </div>
          <MapaEventosVitrine pontos={pontos} />
          <Prateleira titulo="Próximos eventos" variante="cartoes" tituloVisivel={false}>
            {eventos.map((evento) => (
              <CartaoEventoMini key={evento.slug} evento={evento} />
            ))}
          </Prateleira>
        </section>
      )}
    </Pagina>
  )
}
