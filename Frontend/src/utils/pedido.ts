import type { CompradorDoPedido } from '@/types/dominio'

const TAMANHO_DO_CODIGO = 8
export const NOME_PADRAO_DO_COMPRADOR = 'Comprador'

export function codigoDoPedido(id: string | null | undefined): string {
  const limpo = (id ?? '').trim().replace(/^#/, '')
  return limpo ? `#${limpo.slice(0, TAMANHO_DO_CODIGO).toUpperCase()}` : ''
}

export function nomeDoComprador(comprador?: Pick<CompradorDoPedido, 'nome'> | null): string {
  return comprador?.nome?.trim() || NOME_PADRAO_DO_COMPRADOR
}

export const ANCORA_CONVERSA_PEDIDO = 'conversa-pedido'

export function rotaPedidoDoArtesao(id: string, comConversa = false): string {
  return `/dashboard/orders/${encodeURIComponent(id)}${comConversa ? `#${ANCORA_CONVERSA_PEDIDO}` : ''}`
}

export function rotaPedidoDoComprador(id: string, comConversa = false): string {
  return `/orders/${encodeURIComponent(id)}${comConversa ? `#${ANCORA_CONVERSA_PEDIDO}` : ''}`
}
