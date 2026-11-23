import type { Evento } from '@/types/dominio'
import { coordenadasValidas } from '@/utils/eventos'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import { type RespostaApi } from './tipos'

export type FiltrosEvento = { lat?: number; lng?: number }

export function filtrosDeProximidade(filtros: FiltrosEvento): FiltrosEvento {
  const { lat, lng } = filtros
  if (lat === undefined || lng === undefined) return {}
  return coordenadasValidas({ lat, lng }) ? { lat, lng } : {}
}

export async function listarEventos(filtros: FiltrosEvento = {}): Promise<RespostaApi<Evento[]>> {
  return buscar<Evento[]>(`/eventos${montarQuery(filtrosDeProximidade(filtros))}`)
}

export async function obterEvento(slug: string): Promise<RespostaApi<Evento>> {
  return buscar<Evento>(`/eventos/${encodeURIComponent(slug)}`)
}

/** Dados enviados pelo organizador. O estado de publicação é decidido pelo administrador (PI-205). */
export type DatasEstruturadasEvento = {
  dataInicio?: string | null
  dataFim?: string | null
  horarioInicio?: string | null
  horarioFim?: string | null
}

export type SubmissaoEvento = Evento & DatasEstruturadasEvento

/** Confirmação de recebimento: o evento fica pendente e não é público até aprovação. */
export type EventoPendente = { slug: string; status: 'PENDENTE' }

export function criarEvento(submissao: SubmissaoEvento): Promise<RespostaApi<EventoPendente>> {
  return enviar<EventoPendente>('/eventos', submissao)
}

export type EstadoModeracaoEvento = 'PENDENTE' | 'APROVADO' | 'REJEITADO'

export const ESTADOS_MODERACAO_EVENTO: readonly EstadoModeracaoEvento[] = ['PENDENTE', 'APROVADO', 'REJEITADO']

export type DecisaoEvento = 'aprovar' | 'rejeitar'

export type EventoEmModeracao = {
  evento: Evento
  status: EstadoModeracaoEvento
  publicado: boolean
  organizadorId: string | null
  submetidoEm: string
  decididoPor: string | null
  decididoEm: string | null
  motivo: string | null
}

export function ehEstadoModeracaoEvento(valor: unknown): valor is EstadoModeracaoEvento {
  return typeof valor === 'string' && (ESTADOS_MODERACAO_EVENTO as readonly string[]).includes(valor)
}

export function listarEventosEmModeracao(
  token?: string,
  estado: EstadoModeracaoEvento = 'PENDENTE',
): Promise<RespostaApi<EventoEmModeracao[]>> {
  return buscar<EventoEmModeracao[]>(`/admin/eventos${montarQuery({ estado })}`, comToken(token))
}

export function obterEventoEmModeracao(slug: string, token?: string): Promise<RespostaApi<EventoEmModeracao>> {
  return buscar<EventoEmModeracao>(`/admin/eventos/${encodeURIComponent(slug)}`, comToken(token))
}

export function decidirEvento(slug: string, decisao: DecisaoEvento, motivo = ''): Promise<RespostaApi<EventoEmModeracao>> {
  const corpo = decisao === 'rejeitar' ? { decisao, motivo: motivo.trim() } : { decisao }
  return enviar<EventoEmModeracao>(`/admin/eventos/${encodeURIComponent(slug)}/decisao`, corpo)
}
