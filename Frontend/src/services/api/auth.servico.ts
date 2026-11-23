import { enviar } from './cliente'
import type { RespostaApi } from './tipos'

export type Papel = 'comprador' | 'artesao' | 'admin' | 'organizador'

// Cadastro público nunca concede organizador (PI-210): o papel é atribuído por operação administrativa.
export type PapelCadastro = 'comprador' | 'artesao'

export const PAPEIS_CADASTRO: readonly PapelCadastro[] = ['comprador', 'artesao']

export type UsuarioAutenticado = {
  id: string
  nome: string
  email: string
  papel: Papel
  imagem: string
  telefone?: string
  artesao?: string
}

export type DadosCadastro = {
  nome: string
  email: string
  senha: string
  papel: PapelCadastro
  territorio?: string
  tecnica?: string
}

export function atualizarConta(
  id: string,
  dados: Partial<{ nome: string; email: string }>,
): Promise<RespostaApi<UsuarioAutenticado>> {
  return enviar<UsuarioAutenticado>(`/conta/${encodeURIComponent(id)}`, dados, 'PATCH')
}

export function alterarSenha(senhaAtual: string, novaSenha: string): Promise<RespostaApi<{ alterada: boolean }>> {
  return enviar<{ alterada: boolean }>('/auth/alterar-senha', { senhaAtual, novaSenha })
}
