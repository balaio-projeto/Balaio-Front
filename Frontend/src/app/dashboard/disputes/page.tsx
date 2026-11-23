import Link from 'next/link'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { Migalhas } from '@/components/ui/Basicos'
import { IconeAviso } from '@/components/ui/Icones'
import { situacaoDaMediacao } from '@/components/pedido/situacaoMediacao'
import { listarMediacoesDasPartes } from '@/services/api/mediacoes.servico'
import { listarVendasArtesao } from '@/services/api/pedidos.servico'
import { pecasPainelArtesao } from '@/services/api/pecas.servico'
import { exigirArtesao } from '@/services/autenticacao'

export const dynamic = 'force-dynamic'

export default async function Disputas() {
  const { artesao, token } = await exigirArtesao()
  const [{ dados: mediacoes, erro }, { dados: vendas }, { dados: pecas }] = await Promise.all([
    listarMediacoesDasPartes(token),
    listarVendasArtesao(artesao.slug, token),
    pecasPainelArtesao(artesao.slug, token),
  ])
  const nomesDasPecas = new Map((pecas ?? []).map((peca) => [peca.slug, peca.nome]))
  const pecaDoPedido = new Map((vendas ?? []).map((venda) => [venda.id, nomesDasPecas.get(venda.pecaSlug)]))

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Disputas' }]} />
      <h1 className="titulo-pagina">Disputas dos seus pedidos</h1>
      <p className="subtitulo-pagina">
        Mediações abertas por compradores sobre pedidos do seu ateliê. A plataforma analisa e decide; aqui você acompanha
        o andamento e responde pela conversa do pedido.
      </p>

      {erro || !mediacoes ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar as disputas.'} />
      ) : mediacoes.length === 0 ? (
        <EstadoVazio
          icone={<IconeAviso tamanho={34} />}
          titulo="Nenhuma disputa nos seus pedidos"
          descricao="Quando um comprador pedir mediação da plataforma para um pedido seu, ela aparece aqui com o andamento e a decisão."
        />
      ) : (
        <ul className="lista-curadoria" aria-label="Disputas dos seus pedidos">
          {mediacoes.map((mediacao) => {
            const situacao = situacaoDaMediacao(mediacao)
            return (
              <li className="cartao-curadoria" key={mediacao.id} id={`pedido-${mediacao.pedido}`}>
                <header className="cartao-curadoria-topo">
                  <span className={`selo ${situacao.encerrada ? 'selo-neutro' : 'selo-unica'}`}>
                    <span className="selo-ponto" />
                    {situacao.rotulo}
                  </span>
                  <span className="dado-rotulo">Aberta em {mediacao.aberta}</span>
                </header>
                <div className="dado">
                  <span className="dado-rotulo">Pedido</span>
                  <span className="dado-valor">
                    #{mediacao.pedido}
                    {pecaDoPedido.get(mediacao.pedido) ? ` · ${pecaDoPedido.get(mediacao.pedido)}` : ''}
                  </span>
                </div>
                <div className="dado">
                  <span className="dado-rotulo">Motivo</span>
                  <span className="dado-valor">{mediacao.assunto}</span>
                </div>
                {mediacao.relato && <p className="texto-suave acima-2" style={{ whiteSpace: 'pre-line' }}>{mediacao.relato}</p>}
                <div className="dado acima-2">
                  <span className="dado-rotulo">Decisão da plataforma</span>
                  <span className="dado-valor">{situacao.decisao ?? 'Ainda não há decisão.'}</span>
                </div>
                <Link href="/dashboard/messages" className="botao-texto acima-3">Responder pela conversa do pedido</Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
