import { type Artesao } from '@/types/dominio'
import { buscar, comToken, enviar } from './cliente'
import { type RespostaApi } from './tipos'

export async function listarArtesaos(): Promise<RespostaApi<Artesao[]>> {
  return buscar<Artesao[]>('/artesaos')
}

export async function obterArtesao(slug: string): Promise<RespostaApi<Artesao>> {
  return buscar<Artesao>(`/artesaos/${encodeURIComponent(slug)}`)
}

export const obterMeuAtelie = (token?: string) => buscar<Artesao>('/artesao/me', comToken(token))
export const atualizarMeuAtelie = (alteracoes: Partial<Artesao>) => enviar<Artesao>('/artesao/me', alteracoes, 'PATCH')

export function enviarImagemPerfil(arquivo: File): Promise<RespostaApi<Artesao>> {
  const dados = new FormData()
  dados.append('arquivo', arquivo)
  return enviar<Artesao>('/artesao/me/imagem', dados, 'PUT')
}

export const removerImagemPerfil = () => buscar<Artesao>('/artesao/me/imagem', { method: 'DELETE' })

export type PerfilArtesao = Pick<Artesao, 'nome' | 'atelie' | 'historia' | 'territorio' | 'tecnica' | 'imagem'>

export function atualizarArtesao(slug: string, perfil: Partial<PerfilArtesao>): Promise<RespostaApi<Artesao>> {
  return enviar<Artesao>(`/artesaos/${encodeURIComponent(slug)}`, perfil, 'PATCH')
}

export type ConfiguracoesAtelie = {
  cepOrigem: string
  prazoPadraoDias: number
  aceitaEncomendas: boolean
  encomendasPausadas: boolean
  chavePix: string
  aceitaRetirada: boolean
  aceitaEntregaLocal: boolean
  retiradaBairro: string
  retiradaCidade: string
}

export function obterConfiguracoes(slug: string, token?: string): Promise<RespostaApi<ConfiguracoesAtelie>> {
  return buscar<ConfiguracoesAtelie>(`/artesaos/${encodeURIComponent(slug)}/configuracoes`, comToken(token))
}

export function atualizarConfiguracoes(slug: string, alteracoes: Partial<ConfiguracoesAtelie>): Promise<RespostaApi<ConfiguracoesAtelie>> {
  return enviar<ConfiguracoesAtelie>(`/artesaos/${encodeURIComponent(slug)}/configuracoes`, alteracoes, 'PATCH')
}
