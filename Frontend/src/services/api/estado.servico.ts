import { buscar, enviar } from './cliente'
import type { ItemSacola } from '@/store/sacola'
import type { Colecao, ColecoesDoUsuario } from './colecoes'

export { COLECOES, type Colecao, type ColecoesDoUsuario } from './colecoes'

export type EstadoCliente = ColecoesDoUsuario & {
  id: string
  sacola: ItemSacola[]
}

export const obterEstado = () => buscar<EstadoCliente>('/estado')
export const obterSacola = () => buscar<ItemSacola[]>('/estado/sacola')
export const salvarSacola = (sacola: ItemSacola[]) => enviar<ItemSacola[]>('/estado/sacola', { sacola }, 'PUT')
export const obterColecao = (colecao: Colecao) => buscar<string[]>(`/estado/${colecao}`)
export const salvarColecao = (colecao: Colecao, itens: string[]) => enviar<string[]>(`/estado/${colecao}`, { [colecao]: itens }, 'PUT')
