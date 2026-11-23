import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import CartaoVideo from '@/components/produto/CartaoVideo'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { Migalhas } from '@/components/ui/Basicos'
import { IconePincel, IconePlay } from '@/components/ui/Icones'
import { listarVideosPublicados } from '@/services/api/videos.servico'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarPecas, obterPeca } from '@/services/api/pecas.servico'
import { lerSessao } from '@/services/sessao/servidor'
import type { Peca, Video } from '@/types/dominio'

export const metadata = {
  title: 'Ateliê ao vivo | Balaio',
  description: 'Vídeos curtos em que os artesãos mostram o processo por trás de cada peça.',
}

const PECAS_BUSCADAS_POR_VEZ = 10

async function pecasQueFaltam(videos: Video[], conhecidas: Map<string, Peca>): Promise<Peca[]> {
  const faltantes = [...new Set(videos.flatMap((video) => video.peca && !conhecidas.has(video.peca) ? [video.peca] : []))]
  const encontradas: Peca[] = []
  for (let inicio = 0; inicio < faltantes.length; inicio += PECAS_BUSCADAS_POR_VEZ) {
    const lote = faltantes.slice(inicio, inicio + PECAS_BUSCADAS_POR_VEZ)
    const respostas = await Promise.all(lote.map((slug) => obterPeca(slug)))
    for (const resposta of respostas) if (resposta.dados) encontradas.push(resposta.dados)
  }
  return encontradas
}

export default async function Videos() {
  const [videos, artesaos, pecas, sessao] = await Promise.all([
    listarVideosPublicados(),
    listarArtesaos(),
    listarPecas(),
    lerSessao(),
  ])
  const podePublicar = sessao?.papel === 'artesao'
  const botaoPublicar = podePublicar && (
    <Link href="/dashboard/videos" className="botao botao-primario">
      <IconePincel />
      Publicar vídeo
    </Link>
  )
  const falhou = Boolean(videos.erro || artesaos.erro || pecas.erro || !videos.dados || !artesaos.dados || !pecas.dados)
  const listaVideos = videos.dados ?? []
  const mapaArtesaos = new Map((artesaos.dados ?? []).map((a) => [a.slug, a]))
  const mapaPecas = new Map((pecas.dados ?? []).map((p) => [p.slug, p]))
  if (!falhou) for (const peca of await pecasQueFaltam(listaVideos, mapaPecas)) mapaPecas.set(peca.slug, peca)
  const listaIncompleta = videos.cortadoPor !== null

  return (
    <Pagina>
      <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: 'Ateliê ao vivo' }]} />

      <h1 className="so-leitor">Ateliê ao vivo</h1>

      {falhou ? (
        <EstadoErro mensagem={videos.erro?.mensagem ?? artesaos.erro?.mensagem ?? pecas.erro?.mensagem} />
      ) : listaVideos.length === 0 ? (
        <EstadoVazio
          icone={<IconePlay tamanho={34} />}
          titulo="Nenhum vídeo publicado ainda"
          descricao={
            podePublicar
              ? 'Mostre o processo por trás das suas peças e seja o primeiro a aparecer aqui.'
              : 'Em breve os artesãos vão mostrar aqui o processo por trás de cada peça.'
          }
          acao={botaoPublicar || (
            <Link href="/search" className="botao botao-primario">
              Explorar o catálogo
            </Link>
          )}
        />
      ) : (
        <div className="feed-videos feed-imersivo">
          {listaVideos.map((video) => {
            const artesao = mapaArtesaos.get(video.artesao)
            const peca = video.peca ? mapaPecas.get(video.peca) : undefined

            return (
              <CartaoVideo
                key={video.id}
                video={video}
                artesao={
                  artesao && {
                    slug: artesao.slug,
                    nome: artesao.nome,
                    imagem: artesao.imagem,
                    territorio: artesao.territorio,
                  }
                }
                peca={peca && { slug: peca.slug, nome: peca.nome, preco: peca.preco, imagem: peca.imagem }}
              />
            )
          })}

          <div className="video-fim">
            {listaIncompleta ? (
              <>
                <p className="texto-forte">Esses são os {listaVideos.length} vídeos mais recentes</p>
                <p>
                  {videos.cortadoPor === 'falha'
                    ? 'Não foi possível carregar os vídeos mais antigos agora. Tente recarregar a página.'
                    : 'Por enquanto o feed mostra só os mais recentes.'}
                </p>
              </>
            ) : (
              <>
                <p className="texto-forte">Você chegou ao fim por enquanto</p>
                <p>Novos vídeos entram toda semana.</p>
              </>
            )}
            {botaoPublicar}
            {listaVideos[0] && (
              <Link href={`#${listaVideos[0].id}`} className="botao botao-fantasma">
                Voltar ao início
              </Link>
            )}
          </div>
        </div>
      )}
    </Pagina>
  )
}
