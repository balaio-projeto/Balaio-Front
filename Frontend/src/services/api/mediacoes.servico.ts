import type { Mediacao } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
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

export async function listarMediacoes(token?: string): Promise<RespostaApi<Mediacao[]>> {
  return buscar<Mediacao[]>('/admin/mediacoes', comToken(token))
}

export function iniciarAnaliseDaMediacao(id: string): Promise<RespostaApi<Mediacao>> {
  return enviar(`/admin/mediacoes/${encodeURIComponent(id)}`, { estado: 'emAnalise' }, 'PATCH')
}

export function decidirMediacao(id: string, decisao: DecisaoMediacao): Promise<RespostaApi<Mediacao>> {
  return enviar(`/admin/mediacoes/${encodeURIComponent(id)}/decisao`, { decisao })
}
