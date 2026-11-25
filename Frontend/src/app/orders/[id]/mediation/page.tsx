import Link from 'next/link'
import { notFound } from 'next/navigation'
import Pagina from '@/components/layout/Pagina'
import { Migalhas } from '@/components/ui/Basicos'
import FormMediacao from '@/components/forms/FormMediacao'
import { obterPedido } from '@/services/api/pedidos.servico'
import { obterPecaHistorico } from '@/services/api/pecas.servico'
import { exigirSessao } from '@/services/autenticacao'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeAviso } from '@/components/ui/Icones'
import { pedidoAceitaMediacao, pedidoInexistente } from '@/components/pedido/acaoCancelamentoPedido'
import { codigoDoPedido } from '@/utils/pedido'

export const dynamic = 'force-dynamic'

export default async function Mediacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { usuario, token } = await exigirSessao()
  const { dados: pedido, erro } = await obterPedido(id, token)
  if (pedidoInexistente(erro)) notFound()
  if (erro) throw new Error(erro.mensagem)
  if (!pedido || (pedido.compradorId ?? pedido.usuarioId) !== usuario.id) notFound()

  const { dados: peca } = await obterPecaHistorico(pedido.pecaSlug)

  return (
    <Pagina>
      <Migalhas
        trilha={[
          { texto: 'Início', href: '/' },
          { texto: 'Meus pedidos', href: '/orders' },
          { texto: `Pedido ${codigoDoPedido(pedido.id)}`, href: `/orders/${pedido.id}` },
          { texto: 'Mediação' },
        ]}
      />

      <h1 className="titulo-pagina">Pedir mediação da plataforma</h1>

      {!pedidoAceitaMediacao(pedido.estado) ? (
        <EstadoVazio
          icone={<IconeAviso tamanho={34} />}
          titulo="Este pedido ainda não pode ir para mediação"
          descricao="A mediação fica disponível depois que o pagamento é confirmado. Antes disso, acompanhe ou cancele o pedido pela página dele."
          acao={<Link href={`/orders/${pedido.id}`} className="botao botao-primario">Voltar ao pedido</Link>}
        />
      ) : <div className="duas-colunas">
        <FormMediacao
          pedidoId={pedido.id}
          pecaNome={peca?.nome}
          pecaImagem={peca?.imagem}
        />

        <aside className="cartao">
          <h2 className="secao-titulo">Como funciona a mediação</h2>
          <ol className="lista-passos-evento abaixo-4">
            <li>Você conta o que aconteceu e o que resolveria.</li>
            <li>O artesão é notificado e as duas partes têm 48h para responder.</li>
            <li>Se houver decisão de reembolso, o pedido aguardará a confirmação do provedor de teste.</li>
            <li>Sem acordo, a equipe da plataforma decide com base no histórico do pedido.</li>
          </ol>
          <p className="texto-suave">
            Antes de abrir, vale tentar mais uma vez pela{' '}
            <Link href={`/orders/${pedido.id}#conversa-pedido`}>conversa com o artesão</Link>. A maioria dos casos se
            resolve por lá.
          </p>
        </aside>
      </div>}
    </Pagina>
  )
}
