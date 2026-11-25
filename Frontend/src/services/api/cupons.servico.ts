import type { CupomAdmin, DadosCupom, PreviaCupom } from '@/utils/cupom'
import { buscar, comToken, enviar } from './cliente'
import type { RespostaApi } from './tipos'

export function listarCuponsAdmin(token?: string): Promise<RespostaApi<CupomAdmin[]>> {
  return buscar<CupomAdmin[]>('/admin/cupons', comToken(token))
}

export function criarCupom(dados: DadosCupom): Promise<RespostaApi<CupomAdmin>> {
  return enviar<CupomAdmin>('/admin/cupons', dados)
}

export function editarCupom(id: string, dados: DadosCupom): Promise<RespostaApi<CupomAdmin>> {
  return enviar<CupomAdmin>(`/admin/cupons/${encodeURIComponent(id)}`, dados, 'PUT')
}

export function definirCupomAtivo(id: string, ativo: boolean): Promise<RespostaApi<CupomAdmin>> {
  return enviar<CupomAdmin>(`/admin/cupons/${encodeURIComponent(id)}/situacao`, { ativo }, 'PATCH')
}

export type SimulacaoCupom = {
  itens: { slug: string; quantidade: number }[]
  cupom?: string
  frete?: number
}

export function simularCupom(simulacao: SimulacaoCupom, sinal?: AbortSignal): Promise<RespostaApi<PreviaCupom>> {
  return buscar<PreviaCupom>('/checkout/cupom', {
    method: 'POST', body: JSON.stringify(simulacao), ...(sinal ? { signal: sinal } : {}),
  })
}
