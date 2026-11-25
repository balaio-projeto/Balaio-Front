import { redirect } from 'next/navigation'
import { Migalhas } from '@/components/ui/Basicos'
import CaixaConversas from '@/components/pedido/CaixaConversas'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeEnviar } from '@/components/ui/Icones'
import { listarConversasArtesao } from '@/services/api/pedidos.servico'
import { exigirArtesao } from '@/services/autenticacao'
import { rotaPedidoDoArtesao } from '@/utils/pedido'

type Props = { searchParams: Promise<{ pedido?: string | string[] }> }

export default async function Conversas({ searchParams }: Props) {
  const [{ token }, { pedido }] = await Promise.all([exigirArtesao(), searchParams])
  const pedidoSolicitado = Array.isArray(pedido) ? pedido[0] : pedido
  if (pedidoSolicitado) redirect(rotaPedidoDoArtesao(pedidoSolicitado, true))
  const { dados: fios, erro } = await listarConversasArtesao(token)

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Conversas' }]} />
      <h1 className="titulo-pagina">Central de mensagens</h1>

      {erro || !fios ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar as conversas.'} />
      ) : fios.length === 0 ? (
        <EstadoVazio
          icone={<IconeEnviar tamanho={34} />}
          titulo="Nenhuma conversa ainda"
        />
      ) : (
        <CaixaConversas fios={fios} />
      )}
    </>
  )
}
