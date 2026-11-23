import Link from 'next/link'
import EstadoErro from '@/components/feedback/EstadoErro'
import Pagina from '@/components/layout/Pagina'
import { Foto, Migalhas } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import BotaoAdicionarSacola from '@/components/carrinho/BotaoAdicionarSacola'
import { IconePacote } from '@/components/ui/Icones'
import { listarPedidos } from '@/services/api/pedidos.servico'
import { obterPecaHistorico } from '@/services/api/pecas.servico'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import { rotuloEstadoPedido } from '@/constants/rotulos'
import { exigirSessao } from '@/services/autenticacao'
import { pedidoAceitaMediacao, pedidoEncerrado, situacaoNaLista, type SituacaoListaPedidos } from '@/components/pedido/acaoCancelamentoPedido'
import Preco from '@/components/ui/Preco'

type FiltroPedidos = 'todos' | SituacaoListaPedidos

const FILTROS: { chave: FiltroPedidos; titulo: string }[] = [
  { chave: 'todos', titulo: 'Todos' },
  { chave: 'andamento', titulo: 'Em andamento' },
  { chave: 'aguardando', titulo: 'Aguardando pagamento' },
  { chave: 'entregues', titulo: 'Entregues' },
  { chave: 'encerrados', titulo: 'Cancelados e encerrados' },
]

const VAZIO_POR_FILTRO: Record<Exclude<FiltroPedidos, 'todos'>, string> = {
  andamento: 'Nenhum pedido em produção ou a caminho.',
  aguardando: 'Nenhum pedido aguardando pagamento.',
  entregues: 'Nenhum pedido entregue ainda.',
  encerrados: 'Nenhum pedido cancelado ou encerrado.',
}

function filtroDaUrl(valor: string | string[] | undefined): FiltroPedidos {
  const texto = Array.isArray(valor) ? valor[0] : valor
  return FILTROS.some((filtro) => filtro.chave === texto) ? texto as FiltroPedidos : 'todos'
}

export default async function MeusPedidos({ searchParams }: { searchParams: Promise<{ situacao?: string | string[] }> }) {
  const filtro = filtroDaUrl((await searchParams).situacao)
  const { token } = await exigirSessao()
  const [{ dados: pedidos, erro }, { dados: artesaos }] = await Promise.all([
    listarPedidos(token),
    listarArtesaos(),
  ])
  if (erro) return <Pagina><EstadoErro mensagem={erro.mensagem} /></Pagina>
  const pedidosLista = pedidos ?? []
  const slugs = [...new Set(pedidosLista.flatMap((pedido) => [pedido.pecaSlug, ...(pedido.itens ?? []).map((item) => item.slug)]))]
  const pecas = await Promise.all(slugs.map((slug) => obterPecaHistorico(slug)))
  const mapaPecas = new Map(pecas.flatMap((resposta) => resposta.dados ? [[resposta.dados.slug, resposta.dados] as const] : []))
  const mapaArtesaos = new Map((artesaos ?? []).map((a) => [a.slug, a]))
  const acharPeca = (slug: string) => mapaPecas.get(slug)
  const acharArtesao = (slug: string) => mapaArtesaos.get(slug)
  const quantidadePorFiltro = (chave: FiltroPedidos) =>
    chave === 'todos' ? pedidosLista.length : pedidosLista.filter((pedido) => situacaoNaLista(pedido.estado) === chave).length
  const listaPedidos = filtro === 'todos' ? pedidosLista : pedidosLista.filter((pedido) => situacaoNaLista(pedido.estado) === filtro)
  return (
    <Pagina>
      <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: 'Meus pedidos' }]} />

      <h1 className="titulo-pagina">Meus pedidos</h1>
      <p className="subtitulo-pagina">
        Acompanhe o que está sendo produzido, o que está a caminho e o que já chegou.
      </p>

      {pedidosLista.length > 0 && (
        <nav className="painel-abas abaixo-4" aria-label="Filtrar pedidos por situação">
          {FILTROS.map(({ chave, titulo }) => (
            <Link
              key={chave}
              href={chave === 'todos' ? '/orders' : `/orders?situacao=${chave}`}
              className={`painel-aba${chave === filtro ? ' painel-aba-ativa' : ''}`}
              aria-current={chave === filtro ? 'page' : undefined}
            >
              {titulo} ({quantidadePorFiltro(chave)})
            </Link>
          ))}
        </nav>
      )}

      {pedidosLista.length > 0 && listaPedidos.length === 0 && filtro !== 'todos' ? (
        <EstadoVazio
          icone={<IconePacote tamanho={34} />}
          titulo={VAZIO_POR_FILTRO[filtro]}
          descricao="Escolha outra situação acima para ver os demais pedidos."
          acao={<Link href="/orders" className="botao botao-secundario">Ver todos os pedidos</Link>}
        />
      ) : listaPedidos.length === 0 ? (
        <EstadoVazio
          icone={<IconePacote tamanho={34} />}
          titulo="Você ainda não fez nenhum pedido"
          descricao="Quando comprar sua primeira peça, ela aparece aqui com todas as etapas da produção e do envio."
          acao={
            <Link href="/" className="botao botao-primario">
              Explorar o catálogo
            </Link>
          }
        />
      ) : (
        <div className="escalonado">
          {listaPedidos.map((pedido) => {
            const peca = acharPeca(pedido.pecaSlug)
            const artesao = peca ? acharArtesao(peca.artesao) : undefined
            const estado = rotuloEstadoPedido[pedido.estado]
            const entregue = pedido.estado === 'entregue'
            const encerrado = pedidoEncerrado(pedido.estado)
            const podePedirAjuda = pedidoAceitaMediacao(pedido.estado)

            return (
              <article className="cartao-pedido" key={pedido.id}>
                <header className="cartao-pedido-topo">
                  <span className={`selo ${estado.classe}`}>
                    <span className="selo-ponto" />
                    {estado.texto}
                  </span>
                  <span className="dado-rotulo">{pedido.data}</span>
                </header>

                <Link href={`/orders/${pedido.id}`} className="cartao-pedido-corpo">
                  <div className="cartao-pedido-figura">
                    {peca && <Foto nome={peca.nome} imagem={peca.imagem} decorativa />}
                  </div>
                  <div className="encolhivel">
                    <p className="texto-forte">{peca?.nome}{(pedido.itens?.length ?? 0) > 1 ? ` e mais ${pedido.itens!.length - 1} peça(s)` : ''}</p>
                    <p className="autoria">
                      por {artesao?.nome} · Pedido #{pedido.id}
                    </p>
                    <p className={`cartao-pedido-status${entregue ? ' status-bom' : ''}`}>
                      {encerrado
                        ? pedido.motivoEncerramento ?? 'Este pedido foi encerrado.'
                        : entregue
                          ? 'Entregue no seu endereço'
                          : (pedido.previsaoEntrega ? `Previsão de entrega: ${pedido.previsaoEntrega}` : 'Aguardando previsão de entrega')}
                    </p>
                    <p className="preco-destaque"><Preco valor={pedido.total} /></p>
                  </div>
                </Link>

                <footer className="acoes-linha acoes-empilhaveis cartao-pedido-acoes">
                  {!entregue && !encerrado && (
                    <Link href={`/orders/${pedido.id}`} className="botao botao-primario">
                      Acompanhar pedido
                    </Link>
                  )}
                  {entregue && (
                    <Link href={`/orders/${pedido.id}/review`} className="botao botao-sucesso">
                      Avaliar
                    </Link>
                  )}
                  {entregue && peca && !peca.inativadoEm && (
                    <BotaoAdicionarSacola
                      slug={peca.slug}
                      disponibilidade={peca.disponibilidade}
                      texto="Comprar de novo"
                      className="botao botao-secundario"
                    />
                  )}
                  {entregue && (
                    <Link href={`/orders/${pedido.id}`} className="botao botao-fantasma">
                      Ver detalhes
                    </Link>
                  )}
                  {podePedirAjuda ? (
                    <Link href={`/orders/${pedido.id}/mediation`} className="botao botao-fantasma">Preciso de ajuda</Link>
                  ) : encerrado && (
                    <Link href={`/orders/${pedido.id}`} className="botao botao-fantasma">Ver detalhes</Link>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </Pagina>
  )
}
