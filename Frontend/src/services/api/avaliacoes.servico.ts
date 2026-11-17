import type { Reputacao } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
import { falha, sucesso, type RespostaApi } from './tipos'

export type NovaAvaliacao = { nota: number; comentario: string; aspectos: string[] }
export type AvaliacaoRegistrada = NovaAvaliacao & { id: string; pedidoId: string; criadaEm: string }

export const AVALIACAO_NAO_ENCONTRADA = 'AVALIACAO_NAO_ENCONTRADA'

function caminhoDaAvaliacao(pedidoId: string): string {
  return `/pedidos/${encodeURIComponent(pedidoId)}/avaliacao`
}

export function avaliarPedido(pedidoId: string, avaliacao: NovaAvaliacao): Promise<RespostaApi<AvaliacaoRegistrada>> {
  return enviar(caminhoDaAvaliacao(pedidoId), avaliacao)
}

export function obterAvaliacao(pedidoId: string, token?: string): Promise<RespostaApi<AvaliacaoRegistrada>> {
  return buscar(caminhoDaAvaliacao(pedidoId), comToken(token))
}

export async function consultarAvaliado(pedidoId: string, token?: string): Promise<RespostaApi<boolean>> {
  const { dados, erro } = await obterAvaliacao(pedidoId, token)
  if (dados) return sucesso(true)
  if (erro?.codigo === AVALIACAO_NAO_ENCONTRADA) return sucesso(false)
  return falha(erro?.codigo ?? 'RESPOSTA_INVALIDA', erro?.mensagem ?? 'Não foi possível consultar a avaliação do pedido.')
}

export function obterReputacao(artesaoSlug: string): Promise<RespostaApi<Reputacao>> {
  return buscar(`/artesaos/${encodeURIComponent(artesaoSlug)}/reputacao`)
}
