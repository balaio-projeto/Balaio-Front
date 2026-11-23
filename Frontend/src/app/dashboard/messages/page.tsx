import { Migalhas } from '@/components/ui/Basicos'
import CaixaConversas from '@/components/pedido/CaixaConversas'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeEnviar } from '@/components/ui/Icones'
import { listarConversasArtesao, conversaDoPedido } from '@/services/api/pedidos.servico'
import { exigirArtesao } from '@/services/autenticacao'

type Props = { searchParams: Promise<{ pedido?: string | string[] }> }

export default async function Conversas({ searchParams }: Props) {
  const [{ token }, { pedido }] = await Promise.all([exigirArtesao(), searchParams])
  const pedidoSolicitado = Array.isArray(pedido) ? pedido[0] : pedido
  const { dados: fios, erro } = await listarConversasArtesao(token)
  const fioDoPedido = (fios ?? []).find((fio) => fio.id === pedidoSolicitado)?.id
  const fioInicial = fioDoPedido ?? (fios ?? [])[0]?.id
  const { dados: conversa } = fioInicial ? await conversaDoPedido(fioInicial, token) : { dados: [] }

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Conversas' }]} />
      <h1 className="titulo-pagina">Central de mensagens</h1>
      <p className="subtitulo-pagina">
        Perguntas sobre peças e conversas de pedidos ficam todas aqui. Responder rápido é o que mais aumenta a
        chance de venda.
      </p>

      {erro || !fios ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar as conversas.'} />
      ) : fios.length === 0 ? (
        <EstadoVazio
          icone={<IconeEnviar tamanho={34} />}
          titulo="Nenhuma conversa ainda"
          descricao="Quando um comprador escrever sobre um pedido seu, a conversa aparece aqui."
        />
      ) : (
        <CaixaConversas key={fioInicial} fios={fios} conversaInicial={conversa ?? []} fioSolicitado={fioDoPedido} />
      )}
    </>
  )
}
