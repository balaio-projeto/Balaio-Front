import type { Evento } from '@/types/dominio'
import { buscar, enviar, montarQuery } from './cliente'
import { type RespostaApi } from './tipos'

export type FiltrosEvento = { lat?: number; lng?: number }

export async function listarEventos(filtros: FiltrosEvento = {}): Promise<RespostaApi<Evento[]>> {
  return buscar<Evento[]>(`/eventos${montarQuery({ ...filtros })}`)
}

export async function obterEvento(slug: string): Promise<RespostaApi<Evento>> {
  return buscar<Evento>(`/eventos/${encodeURIComponent(slug)}`)
}

/** Dados enviados pelo organizador. O estado de publicação é decidido pelo administrador (PI-205). */
export type SubmissaoEvento = Omit<Evento, 'criadoPorVoce'>

/** Confirmação de recebimento: o evento fica pendente e não é público até aprovação. */
export type EventoPendente = { slug: string; status: 'PENDENTE' }

export function criarEvento(submissao: SubmissaoEvento): Promise<RespostaApi<EventoPendente>> {
  return enviar<EventoPendente>('/eventos', submissao)
}
