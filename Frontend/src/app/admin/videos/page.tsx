import Link from 'next/link'
import LayoutAdmin from '@/components/admin/LayoutAdmin'
import ListaModeracaoVideos from '@/components/admin/ListaModeracaoVideos'
import EstadoErro from '@/components/feedback/EstadoErro'
import { Migalhas } from '@/components/ui/Basicos'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import {
  TAMANHO_PAGINA_MODERACAO_VIDEOS, ehFiltroModeracaoVideo, listarVideosParaModeracao,
  type FiltroModeracaoVideo,
} from '@/services/api/moderacaoVideos.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { exigirAdmin } from '@/services/sessao/servidor'
import { hrefAdmin, lerPagina } from '@/utils/filtrosAdmin'

export const metadata = { title: 'Moderação de vídeos | Balaio' }

type Props = { searchParams: Promise<{ estado?: string | string[]; pagina?: string | string[] }> }

const CAMINHO = '/admin/videos'

const FILTROS: { filtro: FiltroModeracaoVideo; rotulo: string }[] = [
  { filtro: 'todos', rotulo: 'Todos' },
  { filtro: 'publicada', rotulo: 'Publicados' },
  { filtro: 'suspensa', rotulo: 'Suspensos' },
]

export default async function ModeracaoVideos({ searchParams }: Props) {
  await exigirAdmin(CAMINHO)
  const parametros = await searchParams
  const pedido = Array.isArray(parametros.estado) ? parametros.estado[0] : parametros.estado
  const filtro: FiltroModeracaoVideo = ehFiltroModeracaoVideo(pedido) ? pedido : 'todos'
  const pagina = lerPagina(parametros.pagina)
  const token = await tokenDaSessao()
  const [{ dados: videos, erro }, { dados: artesaos }] = await Promise.all([
    listarVideosParaModeracao(filtro, pagina, token),
    listarArtesaos(),
  ])
  const nomesDosArtesaos = Object.fromEntries((artesaos ?? []).map((artesao) => [artesao.slug, artesao.nome]))
  const estadoNaUrl = filtro === 'todos' ? undefined : filtro
  const haProxima = (videos?.length ?? 0) >= TAMANHO_PAGINA_MODERACAO_VIDEOS

  return (
    <LayoutAdmin ativo="videos">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Vídeos' }]} />

      <h1 className="titulo-pagina">Moderação de vídeos</h1>
      <p className="subtitulo-pagina">
        Suspenda vídeos que infringem as regras de publicação. Vídeos suspensos saem do Ateliê ao vivo e da página do
        ateliê; o artesão é avisado com o motivo e continua vendo o vídeo no painel.
      </p>

      <nav className="chips-filtro abaixo-4" aria-label="Filtrar vídeos por estado">
        {FILTROS.map((opcao) => (
          <Link
            key={opcao.filtro}
            href={hrefAdmin(CAMINHO, { estado: opcao.filtro === 'todos' ? undefined : opcao.filtro })}
            className={`chip-filtro${opcao.filtro === filtro ? ' chip-filtro-ativo' : ''}`}
            aria-current={opcao.filtro === filtro ? 'page' : undefined}
          >
            {opcao.rotulo}
          </Link>
        ))}
      </nav>

      {erro || !videos ? (
        <EstadoErro mensagem={erro?.mensagem} />
      ) : (
        <>
          <ListaModeracaoVideos
            key={`${filtro}-${pagina}`}
            iniciais={videos}
            filtro={filtro}
            nomesDosArtesaos={nomesDosArtesaos}
          />
          {(pagina > 1 || haProxima) && (
            <nav className="paginacao-admin acima-4" aria-label="Páginas de vídeos">
              {pagina > 1 ? (
                <Link href={hrefAdmin(CAMINHO, { estado: estadoNaUrl, pagina: pagina - 1 })} className="botao botao-fantasma">
                  ← Anterior
                </Link>
              ) : (
                <span className="botao botao-fantasma" aria-disabled="true">← Anterior</span>
              )}
              <span className="paginacao-admin-posicao" aria-current="page">Página {pagina}</span>
              {haProxima ? (
                <Link href={hrefAdmin(CAMINHO, { estado: estadoNaUrl, pagina: pagina + 1 })} className="botao botao-fantasma">
                  Próxima →
                </Link>
              ) : (
                <span className="botao botao-fantasma" aria-disabled="true">Próxima →</span>
              )}
            </nav>
          )}
        </>
      )}
    </LayoutAdmin>
  )
}
