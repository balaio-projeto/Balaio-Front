import type { ConversaArtesao, Mensagem, Pedido, PedidoPendente } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
import { type RespostaApi } from './tipos'

export type Checkout = {
  itens: { slug: string; quantidade: number }[]
  freteId: string
  endereco: { cep: string; endereco: string; cidade: string; estado: string }
  meio: 'checkout_pro'
}

export async function finalizarCompra(compra: Checkout): Promise<RespostaApi<Pedido>> {
  const atual = JSON.stringify(compra)
  const armazenamento = 'balaio-checkout-pendente'
  let chave = crypto.randomUUID()
  if (typeof window !== 'undefined') {
    try {
      const anterior = JSON.parse(sessionStorage.getItem(armazenamento) ?? 'null') as { compra?: string; chave?: string } | null
      if (anterior?.compra === atual && anterior.chave) chave = anterior.chave
      else sessionStorage.setItem(armazenamento, JSON.stringify({ compra: atual, chave }))
    } catch {
      sessionStorage.setItem(armazenamento, JSON.stringify({ compra: atual, chave }))
    }
  }
  const resposta = await buscar<Pedido>('/checkout', { method: 'POST', body: atual, headers: { 'Idempotency-Key': chave } })
  return resposta
}

export function concluirCheckoutPendente() {
  if (typeof window !== 'undefined') sessionStorage.removeItem('balaio-checkout-pendente')
}

export function enviarMensagem(id: string, mensagem: Mensagem): Promise<RespostaApi<Mensagem>> {
  return enviar(`/pedidos/${encodeURIComponent(id)}/conversa`, mensagem)
}

export async function listarPedidos(token?: string): Promise<RespostaApi<Pedido[]>> {
  return buscar<Pedido[]>('/pedidos', comToken(token))
}

export async function obterPedido(id: string, token?: string): Promise<RespostaApi<Pedido>> {
  return buscar<Pedido>(`/pedidos/${encodeURIComponent(id)}`, comToken(token))
}

export async function conversaDoPedido(id: string): Promise<RespostaApi<Mensagem[]>> {
  return buscar<Mensagem[]>(`/pedidos/${encodeURIComponent(id)}/conversa`)
}

export async function confirmarLeituraDaConversa(id: string): Promise<RespostaApi<null>> {
  return buscar<null>(`/pedidos/${encodeURIComponent(id)}/conversa/leitura`, { method: 'POST' })
}

export async function listarConversasArtesao(artesao?: string): Promise<RespostaApi<ConversaArtesao[]>> {
  return buscar<ConversaArtesao[]>(`/artesao/conversas${artesao ? `?artesao=${encodeURIComponent(artesao)}` : ''}`)
}

export async function listarPedidosPendentes(token?: string): Promise<RespostaApi<PedidoPendente[]>> {
  return buscar<PedidoPendente[]>('/artesao/pedidos-pendentes', comToken(token))
}

export async function listarVendasArtesao(artesao?: string, token?: string): Promise<RespostaApi<Pedido[]>> {
  return buscar<Pedido[]>(`/artesao/vendas${artesao ? `?artesao=${encodeURIComponent(artesao)}` : ''}`,
    comToken(token))
}

export const atualizarEstadoPedido = (id: string, estado: Pedido['estado']) => enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/estado`, { estado }, 'PATCH')

export const recusarPedido = (id: string, motivo: string) =>
  enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/recusar`, { motivo }, 'PATCH')

export const cancelarPedido = (id: string) =>
  enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/cancelar`, {}, 'PATCH')
