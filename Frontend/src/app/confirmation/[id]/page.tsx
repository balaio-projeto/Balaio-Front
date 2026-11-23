import Link from 'next/link'
import { notFound } from 'next/navigation'
import Pagina from '@/components/layout/Pagina'
import ResumoItensPedido from '@/components/pedido/ResumoItensPedido'
import { Migalhas } from '@/components/ui/Basicos'
import { IconeAviso, IconeCheck, IconeConversa, IconeRelogio, IconeSetaDireita } from '@/components/ui/Icones'
import { obterPedido } from '@/services/api/pedidos.servico'
import { exigirSessao } from '@/services/autenticacao'
import EstadoPagamento from '@/components/pedido/EstadoPagamento'
import { pagamentoConfirmado, pedidoEncerrado, pedidoInexistente } from '@/components/pedido/acaoCancelamentoPedido'
import type { Pedido } from '@/types/dominio'

export const dynamic = 'force-dynamic'

function cabecalhoDoPedido(pedido: Pedido) {
  if (pagamentoConfirmado(pedido.estado))
    return { titulo: 'Pagamento confirmado', icone: <IconeCheck tamanho={38} />, fundo: 'var(--verde)' }
  if (pedidoEncerrado(pedido.estado))
    return { titulo: 'O pedido foi encerrado', icone: <IconeAviso tamanho={38} />, fundo: 'var(--vermelho)' }
  return { titulo: 'Acompanhe a confirmação do pedido', icone: <IconeRelogio tamanho={38} />, fundo: 'var(--tinta-suave)' }
}

export default async function Confirmacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { usuario, token } = await exigirSessao()
  const { dados: pedido, erro } = await obterPedido(id, token)
  if (pedidoInexistente(erro)) notFound()
  if (erro) throw new Error(erro.mensagem)
  if (!pedido || (pedido.compradorId ?? pedido.usuarioId) !== usuario.id) notFound()
  const cabecalho = cabecalhoDoPedido(pedido)

  return (
    <Pagina>
      <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: 'Pedido registrado' }]} />

      <div className="cartao estado-vazio">
        <span className="estado-vazio-icone" style={{ background: cabecalho.fundo, color: 'var(--branco)' }}>
          {cabecalho.icone}
        </span>
        <h1 className="titulo-pagina">{cabecalho.titulo}</h1>
        <p className="subtitulo-pagina" style={{ margin: '0 auto 24px' }}>
          Seu pedido <strong>#{pedido.id}</strong> está registrado e pode ser acompanhado pela plataforma.
        </p>
        <EstadoPagamento inicial={pedido} />
      </div>

      <div className="duas-colunas secao">
        <section className="cartao">
          <h2 className="secao-titulo">O que você comprou</h2>
          <ResumoItensPedido pedido={pedido} />

          <p className="nota-fiscal acima-4">
            Os dados da compra estão disponíveis na página do pedido.
          </p>
        </section>

        <section className="cartao">
          <h2 className="secao-titulo">E agora, o que acontece</h2>
          <ol style={{ paddingLeft: 18, display: 'grid', gap: 14, color: 'var(--tinta-suave)', margin: 0 }}>
            <li>
              <strong style={{ color: 'var(--tinta)' }}>O pedido aparece em Meus pedidos</strong> com o estado atual da compra.
            </li>
            <li>
              <strong style={{ color: 'var(--tinta)' }}>Você acompanha cada etapa</strong> pela página do pedido e conversa com o artesão por lá.
            </li>
            <li>
              <strong style={{ color: 'var(--tinta)' }}>O rastreio aparece no pedido</strong> quando o envio for registrado.
            </li>
            <li>
              <strong style={{ color: 'var(--tinta)' }}>Após a entrega</strong>, você poderá avaliar a compra.
            </li>
          </ol>

          <div className="acoes-linha acoes-empilhaveis acima-5">
            <Link href={`/orders/${pedido.id}`} className="botao botao-primario">
              Acompanhar pedido
              <IconeSetaDireita />
            </Link>
            <Link href={`/orders/${pedido.id}#conversa-pedido`} className="botao botao-secundario">
              <IconeConversa />
              Falar com o artesão
            </Link>
          </div>
        </section>
      </div>
    </Pagina>
  )
}
