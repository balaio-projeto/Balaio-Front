import Link from 'next/link'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { Migalhas } from '@/components/ui/Basicos'
import { IconeAviso } from '@/components/ui/Icones'
import { CLASSE_DO_SELO_DA_MEDIACAO, situacaoDaMediacao } from '@/components/pedido/situacaoMediacao'
import { listarMediacoesDasPartes } from '@/services/api/mediacoes.servico'
import { listarVendasArtesao } from '@/services/api/pedidos.servico'
import { pecasPainelArtesao } from '@/services/api/pecas.servico'
import { exigirArtesao } from '@/services/autenticacao'
import { codigoDoPedido, rotaPedidoDoArtesao } from '@/utils/pedido'

export const dynamic = 'force-dynamic'

export default async function Disputas() {
  const { usuario, artesao, token } = await exigirArtesao()
  const [{ dados: todasAsMediacoes, erro }, { dados: vendas }, { dados: pecas }] = await Promise.all([
    listarMediacoesDasPartes(token),
    listarVendasArtesao(token),
    pecasPainelArtesao(artesao.slug, token),
  ])
  const mediacoes = todasAsMediacoes?.filter((mediacao) => mediacao.compradorId !== usuario.id)
  const nomesDasPecas = new Map((pecas ?? []).map((peca) => [peca.slug, peca.nome]))
  const pecaDoPedido = new Map((vendas ?? []).map((venda) => [venda.id, nomesDasPecas.get(venda.pecaSlug)]))

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Disputas' }]} />
      <h1 className="titulo-pagina">Disputas dos seus pedidos</h1>
      <p className="subtitulo-pagina">
        Responda às mediações pela conversa do pedido.
      </p>

      {erro || !mediacoes ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar as disputas.'} />
      ) : mediacoes.length === 0 ? (
        <EstadoVazio
          icone={<IconeAviso tamanho={34} />}
          titulo="Nenhuma disputa nos seus pedidos"
        />
      ) : (
        <ul className="lista-curadoria" aria-label="Disputas dos seus pedidos">
          {mediacoes.map((mediacao) => {
            const situacao = situacaoDaMediacao(mediacao)
            const nomeDaPeca = pecaDoPedido.get(mediacao.pedido)
            return (
              <li className="cartao-curadoria cartao-disputa" key={mediacao.id} id={`pedido-${mediacao.pedido}`}>
                <header className="cartao-curadoria-topo">
                  <span className={`selo ${CLASSE_DO_SELO_DA_MEDIACAO[situacao.tom]} cartao-disputa-selo`}>
                    <span className="selo-ponto" />
                    {situacao.rotulo}
                  </span>
                  <span className="dado-rotulo">Aberta em {mediacao.aberta}</span>
                </header>
                <div className="cartao-curadoria-corpo cartao-disputa-corpo">
                  <dl className="cartao-disputa-dados">
                    <div className="cartao-disputa-dado">
                      <dt className="dado-rotulo">Pedido</dt>
                      <dd className="dado-valor cartao-disputa-pedido">
                        <Link href={rotaPedidoDoArtesao(mediacao.pedido)}>{codigoDoPedido(mediacao.pedido)}</Link>
                      </dd>
                      {nomeDaPeca && <dd className="autoria">{nomeDaPeca}</dd>}
                    </div>
                    <div className="cartao-disputa-dado">
                      <dt className="dado-rotulo">Motivo</dt>
                      <dd className="dado-valor">{mediacao.assunto}</dd>
                    </div>
                  </dl>
                  {mediacao.relato && <p className="cartao-disputa-relato">{mediacao.relato}</p>}
                  <div className="cartao-disputa-dado cartao-disputa-decisao" data-tom={situacao.tom}>
                    <span className="dado-rotulo">Decisão da plataforma</span>
                    <span className="dado-valor">{situacao.decisao ?? 'Ainda não há decisão.'}</span>
                  </div>
                </div>
                <footer className="cartao-curadoria-acoes">
                  <Link href={rotaPedidoDoArtesao(mediacao.pedido, true)} className="botao-texto">Responder pela conversa do pedido</Link>
                </footer>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
