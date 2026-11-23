import type { ConversaArtesao, Mensagem, OpcaoFrete, Pedido, PedidoPendente } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import { type RespostaApi } from './tipos'

export type Checkout = {
  itens: { slug: string; quantidade: number }[]
  freteId: string
  endereco: { cep: string; endereco: string; cidade: string; estado: string }
    enderecoId?: string
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

export function enviarMensagem(id: string, mensagem: Pick<Mensagem, 'texto'>, chave = crypto.randomUUID()): Promise<RespostaApi<Mensagem>> {
  return buscar<Mensagem>(`/pedidos/${encodeURIComponent(id)}/conversa`, {
    method: 'POST', body: JSON.stringify({ texto: mensagem.texto }), headers: { 'Idempotency-Key': chave },
  })
}

export async function listarPedidos(token?: string): Promise<RespostaApi<Pedido[]>> {
  return buscar<Pedido[]>('/pedidos', comToken(token))
}

export async function obterPedido(id: string, token?: string): Promise<RespostaApi<Pedido>> {
  return buscar<Pedido>(`/pedidos/${encodeURIComponent(id)}`, comToken(token))
}

export async function conversaDoPedido(id: string, token?: string): Promise<RespostaApi<Mensagem[]>> {
  return buscar<Mensagem[]>(`/pedidos/${encodeURIComponent(id)}/conversa`, comToken(token))
}

export async function confirmarLeituraDaConversa(id: string): Promise<RespostaApi<null>> {
  return buscar<null>(`/pedidos/${encodeURIComponent(id)}/conversa/leitura`, { method: 'POST' })
}

export async function listarConversasArtesao(token?: string): Promise<RespostaApi<ConversaArtesao[]>> {
  return buscar<ConversaArtesao[]>('/artesao/conversas', comToken(token))
}

export async function listarPedidosPendentes(token?: string): Promise<RespostaApi<PedidoPendente[]>> {
  return buscar<PedidoPendente[]>('/artesao/pedidos-pendentes', comToken(token))
}

export async function listarVendasArtesao(token?: string): Promise<RespostaApi<Pedido[]>> {
  return buscar<Pedido[]>('/artesao/vendas', comToken(token))
}

export type DadosEnvio = { rastreio: string; transportadora?: string }

export const atualizarEstadoPedido = (id: string, estado: Pedido['estado'], envio?: DadosEnvio) =>
  enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/estado`, { estado, ...envio }, 'PATCH')

export type PeriodoVendas = '7d' | '30d' | '90d' | 'mes'

export type RelatorioVendas = {
  periodo: { de: string; ate: string; preset: PeriodoVendas | 'personalizado'; fusoHorario: string }
  receita: number
  frete: number
  quantidadePedidos: number
  unidadesVendidas: number
  ticketMedio: number
  estadosConsiderados: string[]
  formulaReceita: string
  ranking: { slug: string; unidades: number; pedidos: number; receita: number; participacao: number }[]
  serie: { granularidade: 'dia' | 'mes'; pontos: { inicio: string; receita: number }[] }
}

export type IntervaloVendas = { de: string; ate: string }

export function relatorioVendas(periodo: PeriodoVendas | IntervaloVendas, token?: string): Promise<RespostaApi<RelatorioVendas>> {
  const consulta = typeof periodo === 'string' ? montarQuery({ periodo }) : montarQuery({ de: periodo.de, ate: periodo.ate })
  return buscar<RelatorioVendas>(`/artesao/vendas/relatorio${consulta}`, comToken(token))
}

export type ResumoPainel = {
  versaoContrato: string
  faturamentoMes: number
  pedidosAAceitar: number
  emProducao: number
  enviados: number
  pecasAtivas: number | null
  avisos: { slug: string; nome: string; motivo: string }[] | null
  parcial: boolean
  fontesIndisponiveis: string[]
}

export function resumoPainel(token?: string): Promise<RespostaApi<ResumoPainel>> {
  return buscar<ResumoPainel>('/artesao/painel/resumo', comToken(token))
}

export function cotarFretes(cep: string, itens: { slug: string; quantidade: number }[], sinal?: AbortSignal): Promise<RespostaApi<OpcaoFrete[]>> {
  const consulta = montarQuery({ cep, itens: itens.map((item) => `${item.slug}:${item.quantidade}`).join(',') })
  return buscar<OpcaoFrete[]>(`/fretes${consulta}`, sinal ? { signal: sinal } : undefined)
}

export const recusarPedido = (id: string, motivo: string) =>
  enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/recusar`, { motivo }, 'PATCH')

export const cancelarPedido = (id: string) =>
  enviar<Pedido>(`/pedidos/${encodeURIComponent(id)}/cancelar`, {}, 'PATCH')
