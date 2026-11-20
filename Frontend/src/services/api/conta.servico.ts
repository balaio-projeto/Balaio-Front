import { buscar, comToken, enviar } from './cliente'
import type { EnderecoUsuario, OpcaoFrete, Usuario } from '@/types/dominio'

export type Cadastro = { nome: string; email: string; senha: string; perfil: 'comprador' | 'artesao'; territorio?: string; tecnica?: string }
export type Credenciais = { email: string; senha: string }
export type AtualizacaoUsuario = Partial<Pick<Usuario, 'nome' | 'email'>>

export const enviarAutenticacao = <T>(caminho: string, corpo: unknown) => enviar<T>(caminho, corpo)

export const cadastrarUsuario = (cadastro: Cadastro) => enviarAutenticacao<Usuario>('/auth/cadastro', cadastro)
export const entrar = (credenciais: Credenciais) => enviarAutenticacao<Usuario>('/auth/login', credenciais)
export const sair = () => enviarAutenticacao<{ encerrada: boolean }>('/auth/logout', {})
export const obterUsuario = (token?: string) => buscar<Usuario>('/usuario', comToken(token))
export const atualizarUsuario = (usuario: AtualizacaoUsuario) => enviar<Usuario>('/usuario', usuario, 'PATCH')
export const criarEndereco = (endereco: Omit<EnderecoUsuario, 'id' | 'principal'>) => enviar<EnderecoUsuario>('/usuario/enderecos', endereco)
export const atualizarEndereco = (id: string, endereco: Partial<EnderecoUsuario>) => enviar<EnderecoUsuario>(`/usuario/enderecos/${encodeURIComponent(id)}`, endereco, 'PATCH')
export const excluirEndereco = (id: string) => buscar<EnderecoUsuario>(`/usuario/enderecos/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const solicitarRecuperacao = (email: string) => enviar<{ recebida: boolean }>('/auth/recuperacao', { email })
export const redefinirSenha = (token: string, novaSenha: string) => enviar<{ redefinida: boolean }>('/auth/redefinicao', { token, novaSenha })
export const listarFretes = () => buscar<OpcaoFrete[]>('/fretes')
