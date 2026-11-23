import type { Coletivo } from '@/types/dominio'
import { buscar, enviar } from './cliente'
import { type RespostaApi } from './tipos'

export async function listarColetivos(): Promise<RespostaApi<Coletivo[]>> {
  return buscar<Coletivo[]>('/coletivos')
}

export async function obterColetivo(slug: string): Promise<RespostaApi<Coletivo>> {
  return buscar<Coletivo>(`/coletivos/${encodeURIComponent(slug)}`)
}

export type NovoColetivo = {
  slug: string
  nome: string
  territorio: string
  fundado: string
  historia: string
  apoio: string[]
  membros: string[]
}

export function cadastrarColetivo(coletivo: NovoColetivo): Promise<RespostaApi<Coletivo>> {
  return enviar<Coletivo>('/coletivos', coletivo)
}
