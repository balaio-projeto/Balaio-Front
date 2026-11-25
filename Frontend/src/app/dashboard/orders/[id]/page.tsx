import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Migalhas } from '@/components/ui/Basicos'
import ConversaPedido from '@/components/pedido/ConversaPedido'
import CompradorDoPedido from '@/components/pedido/CompradorDoPedido'
import ResumoItensPedido from '@/components/pedido/ResumoItensPedido'
import { pedidoInexistente } from '@/components/pedido/acaoCancelamentoPedido'
import { IconeSetaDireita } from '@/components/ui/Icones'
import { rotuloEstadoPedido } from '@/constants/rotulos'
import { conversaDoPedido, obterPedidoDoArtesao } from '@/services/api/pedidos.servico'
import { exigirArtesao } from '@/services/autenticacao'
import type { EstadoPedido } from '@/types/dominio'
import { imagemReal } from '@/utils/imagem'
import { ANCORA_CONVERSA_PEDIDO, codigoDoPedido, nomeDoComprador } from '@/utils/pedido'
import { PROVEDOR_FRETE_LOCAL } from '@/utils/frete'

export const dynamic = 'force-dynamic'

const PROXIMO_PASSO: Partial<Record<EstadoPedido, string>> = {
  confirmado: 'Aceite ou recuse este pedido em Novos pedidos recebidos, no painel.',
  producao: 'Quando despachar, registre o envio com o código de rastreio no painel.',
  enviado: 'Quando o comprador receber, marque o pedido como entregue no painel.',
}

export default async function PedidoDoArtesao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token } = await exigirArtesao()
  const { dados: pedido, erro } = await obterPedidoDoArtesao(id, token)
  if (pedidoInexistente(erro) || erro?.status === 403) notFound()
  if (erro) throw new Error(erro.mensagem)
  if (!pedido) notFound()

  const { dados: conversa, erro: erroConversa } = await conversaDoPedido(pedido.id, token)
  const codigo = codigoDoPedido(pedido.id)
  const estado = rotuloEstadoPedido[pedido.estado]
  const proximoPasso = PROXIMO_PASSO[pedido.estado]

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: `Pedido ${codigo}` }]} />
      <h1 className="titulo-pagina">Pedido {codigo}</h1>
      <p className="subtitulo-pagina">Combine detalhes e prazos com quem comprou pela conversa deste pedido.</p>

      <section className="cartao abaixo-5" data-pedido-id={pedido.id}>
        <div className="linha-flex linha-entre">
          <div>
            <p className="territorio">Comprador</p>
            <p className="dado-valor"><CompradorDoPedido comprador={pedido.comprador} tamanho={44} /></p>
            <span className={`selo ${estado.classe} acima-2`}>
              <span className="selo-ponto" />
              {estado.texto}
            </span>
          </div>
          <div className="texto-direita">
            <p className="dado-rotulo">Data da compra</p>
            <p className="dado-valor">{pedido.data}</p>
          </div>
        </div>

        <ResumoItensPedido pedido={pedido} />

        {pedido.freteProvedor === PROVEDOR_FRETE_LOCAL ? (
          <div className="entrega-artesao acima-4">
            <p className="dado-rotulo">Entrega</p>
            <p className="dado-valor">{pedido.freteOpcao ?? 'Entrega combinada'}</p>
            <p className="texto-suave">Combine o local e o horário com quem comprou pela conversa abaixo.</p>
          </div>
        ) : pedido.enderecoEntrega?.endereco ? (
          <div className="entrega-artesao acima-4">
            <p className="dado-rotulo">Entregar em</p>
            <p className="dado-valor">{pedido.enderecoEntrega.endereco}</p>
            <p className="texto-suave">
              {[pedido.enderecoEntrega.cidade, pedido.enderecoEntrega.estado].filter(Boolean).join(' - ')}
              {pedido.enderecoEntrega.cep ? ` · CEP ${pedido.enderecoEntrega.cep}` : ''}
            </p>
            {pedido.freteOpcao && <p className="texto-suave">Frete escolhido: {pedido.freteOpcao}</p>}
          </div>
        ) : null}

        {pedido.rastreio && (
          <p className="texto-suave acima-3">
            Rastreio: <strong>{pedido.rastreio}</strong>{pedido.transportadora ? ` · ${pedido.transportadora}` : ''}
          </p>
        )}
        {pedido.motivoEncerramento && <p className="texto-suave acima-3">{pedido.motivoEncerramento}</p>}
        {proximoPasso && (
          <p className="acima-4 linha-flex linha-entre">
            <span className="texto-suave">{proximoPasso}</span>
            <Link href="/dashboard" className="botao botao-secundario">
              Ir para o painel
              <IconeSetaDireita />
            </Link>
          </p>
        )}
      </section>

      <ConversaPedido
        pedidoId={pedido.id}
        id={ANCORA_CONVERSA_PEDIDO}
        iniciais={conversa ?? []}
        erroCarregamento={erroConversa?.mensagem}
        atelie={nomeDoComprador(pedido.comprador)}
        imagem={imagemReal(pedido.comprador?.imagem)}
        minhas="artesao"
      />
    </>
  )
}
