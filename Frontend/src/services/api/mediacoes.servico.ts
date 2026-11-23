import type { Mediacao } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import { type RespostaApi } from './tipos'

export type AberturaMediacao = { pedido: string; assunto: string; relato: string }
export const DECISOES_DE_MEDIACAO = {
  cancelar_reembolsar: 'Cancelar e reembolsar (simulado)',
  negar: 'Negar solicitação',
  manter_conversa: 'Manter conversa',
} as const
export type DecisaoMediacao = keyof typeof DECISOES_DE_MEDIACAO

export function ehDecisaoDeMediacao(valor: unknown): valor is DecisaoMediacao {
  return typeof valor === 'string' && Object.hasOwn(DECISOES_DE_MEDIACAO, valor)
}

export function criarMediacao(abertura: AberturaMediacao): Promise<RespostaApi<Mediacao>> {
  return enviar('/admin/mediacoes', abertura)
}

export const MAXIMO_MEDIACOES_POR_PAGINA = 100
export const LIMITE_DE_PAGINAS_DE_MEDIACOES = 20

export async function listarMediacoes(token?: string): Promise<RespostaApi<Mediacao[]>> {
  const porId = new Map<string, Mediacao>()
  for (let pagina = 0; pagina < LIMITE_DE_PAGINAS_DE_MEDIACOES; pagina++) {
    const consulta = montarQuery({ pagina, tamanho: MAXIMO_MEDIACOES_POR_PAGINA })
    const resposta = await buscar<Mediacao[]>('/admin/mediacoes' + consulta, comToken(token))
    if (resposta.erro) return resposta
    const paginaAtual = resposta.dados ?? []
    for (const mediacao of paginaAtual) porId.set(mediacao.id, mediacao)
    if (paginaAtual.length < MAXIMO_MEDIACOES_POR_PAGINA) break
  }
  return { dados: [...porId.values()], erro: null }
}

export function contarMediacoesEmAberto(mediacoes: Mediacao[]): number {
  return mediacoes.filter((mediacao) => mediacao.estado !== 'decidida').length
}

export function listarMediacoesDasPartes(token?: string): Promise<RespostaApi<Mediacao[]>> {
  return buscar<Mediacao[]>('/admin/mediacoes' + montarQuery({ tamanho: MAXIMO_MEDIACOES_POR_PAGINA }), comToken(token))
}

export function iniciarAnaliseDaMediacao(id: string): Promise<RespostaApi<Mediacao>> {
  return enviar(`/admin/mediacoes/${encodeURIComponent(id)}`, { estado: 'emAnalise' }, 'PATCH')
}

export function decidirMediacao(id: string, decisao: DecisaoMediacao): Promise<RespostaApi<Mediacao>> {
  return enviar(`/admin/mediacoes/${encodeURIComponent(id)}/decisao`, { decisao })
}

export function reprocessarEntregaDaMediacao(id: string): Promise<RespostaApi<Mediacao>> {
  return enviar(`/admin/mediacoes/${encodeURIComponent(id)}/reprocessar-entrega`, {})
}
