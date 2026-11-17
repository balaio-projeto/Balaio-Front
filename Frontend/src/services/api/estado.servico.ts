import { buscar, enviar } from './cliente'
import type { ItemSacola } from '@/store/sacola'
import type { Colecao, ColecoesDoUsuario } from './colecoes'

export { COLECOES, type Colecao, type ColecoesDoUsuario } from './colecoes'

export type EstadoCliente = ColecoesDoUsuario & {
  id: string
}

export const obterSacola = () => buscar<ItemSacola[]>('/estado/sacola')
export const salvarSacola = (sacola: ItemSacola[]) => enviar<ItemSacola[]>('/estado/sacola', { sacola }, 'PUT')
export const obterColecao = (colecao: Colecao) => buscar<string[]>(`/estado/${colecao}`)
export const salvarColecao = (colecao: Colecao, itens: string[]) => enviar<string[]>(`/estado/${colecao}`, { [colecao]: itens }, 'PUT')
export type ItemRevalidado = ItemSacola & {
  precoAtual: number | null
  disponibilidade: 'disponivel' | 'encomenda' | 'unica' | 'indisponivel'
  situacao: 'disponivel' | 'indisponivel'
}
export type RevalidacaoSacola = { itens: ItemRevalidado[]; podeProsseguir: boolean; revalidadoEm: string }
export const revalidarSacola = () => enviar<RevalidacaoSacola>('/sacola/revalidar', {})
