import { buscar } from './cliente'

export type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  link: string | null
  lida: boolean
  criadaEm: string
}

export type CaixaNotificacoes = { itens: Notificacao[]; naoLidas: number }

export const listarNotificacoes = () => buscar<CaixaNotificacoes>('/notificacoes')
export const marcarTodasLidas = () => buscar<CaixaNotificacoes>('/notificacoes/leitura', { method: 'POST' })
export const marcarNotificacaoLida = (id: string) =>
  buscar<CaixaNotificacoes>(`/notificacoes/${encodeURIComponent(id)}/leitura`, { method: 'PATCH' })
