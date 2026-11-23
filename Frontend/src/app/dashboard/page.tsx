import Link from 'next/link'
import { Migalhas } from '@/components/ui/Basicos'
import PedidosPendentes from '@/components/pedido/PedidosPendentes'
import PedidosEmAndamento from '@/components/pedido/PedidosEmAndamento'
import { IconeSetaDireita } from '@/components/ui/Icones'
import { listarVendasArtesao, listarPedidosPendentes, listarConversasArtesao, resumoPainel } from '@/services/api/pedidos.servico'
import { pecasPainelArtesao } from '@/services/api/pecas.servico'
import { listarMediacoesDasPartes } from '@/services/api/mediacoes.servico'
import { exigirArtesao } from '@/services/autenticacao'

export default async function Painel() {
  const { artesao, token } = await exigirArtesao()
  const [{ dados: pend, erro: erroPendentes }, { dados: conversas }, { dados: pecas }, { dados: pedidos }, { dados: resumo }, { dados: mediacoes }] = await Promise.all([
    listarPedidosPendentes(token),
    listarConversasArtesao(artesao.slug),
    pecasPainelArtesao(artesao.slug, token),
    listarVendasArtesao(artesao.slug, token),
    resumoPainel(token),
    listarMediacoesDasPartes(token),
  ])
  const mapaPecas = new Map((pecas ?? []).map((p) => [p.slug, p]))
  const conversasArtesao = conversas ?? []

  const pendentes = (pend ?? []).map((pedido) => {
    const peca = mapaPecas.get(pedido.pecaSlug)
    return {
      id: pedido.id,
      comprador: pedido.comprador,
      quando: pedido.quando,
      valor: pedido.valor,
      pecaNome: peca?.nome,
      pecaTecnica: peca?.tecnica,
      pecaImagem: peca?.imagem,
    }
  })

  const naoLidas = conversasArtesao.filter((c) => c.naoLida).length
  const pedidosDoArtesao = pedidos ?? []
  const pedidosEmDisputa = new Set((mediacoes ?? []).map((mediacao) => mediacao.pedido))
  const emAndamento = pedidosDoArtesao.flatMap((pedido) => pedido.estado === 'producao' || pedido.estado === 'enviado'
    ? [{ id: pedido.id, estado: pedido.estado, pecaNome: mapaPecas.get(pedido.pecaSlug)?.nome, quando: pedido.data,
        valor: pedido.total, rastreio: pedido.rastreio, emDisputa: pedidosEmDisputa.has(pedido.id) }]
    : [])

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Pedidos pendentes' }]} />
      <h1 className="titulo-pagina">Gerenciamento de pedidos</h1>
      <p className="subtitulo-pagina">
        Aceite os pedidos novos para começar a produzir. Quem comprou é avisado a cada etapa que você marcar.
      </p>

      <PedidosPendentes
        iniciais={pendentes}
        erroCarregamento={erroPendentes?.mensagem}
        emProducao={resumo?.emProducao ?? pedidosDoArtesao.filter((pedido) => pedido.estado === 'producao').length}
        pecasAtivas={resumo?.pecasAtivas ?? null}
        avisosPecas={resumo?.avisos ?? null}
        faturamentoMes={resumo?.faturamentoMes ?? null}
      />

      <PedidosEmAndamento pedidos={emAndamento} />

      <section className="secao">
        <h2 className="secao-titulo">Conversas</h2>
        <div className="cartao linha-flex linha-entre">
          <p>
            {conversasArtesao.length} conversas em andamento
            {naoLidas > 0 ? ` · ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}` : ''}
          </p>
          <Link href="/dashboard/messages" className="botao botao-primario">
            Ver central de mensagens
            <IconeSetaDireita />
          </Link>
        </div>
      </section>
    </>
  )
}

