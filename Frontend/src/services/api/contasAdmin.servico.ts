import { buscar, comToken, enviar, montarQuery } from './cliente'
import type { RespostaApi } from './tipos'

export type PapelConta = 'comprador' | 'artesao' | 'organizador' | 'admin'

export type PapelProvisionavel = Extract<PapelConta, 'comprador' | 'organizador'>

export type FiltroPapelConta = PapelProvisionavel | 'todos'

export type ContaAdmin = {
  id: string
  nome: string
  email: string
  papel: PapelConta
  imagem?: string | null
}

export type FiltrosContasAdmin = {
  busca?: string
  papel?: FiltroPapelConta
  pagina?: number
  tamanho?: number
}

export function buscarContaPorEmail(email: string): Promise<RespostaApi<ContaAdmin>> {
  return buscar<ContaAdmin>(`/admin/contas${montarQuery({ email: email.trim() })}`)
}

export function listarContasAdmin(filtros: FiltrosContasAdmin = {}, token?: string): Promise<RespostaApi<ContaAdmin[]>> {
  const query = montarQuery({
    busca: filtros.busca?.trim(),
    papel: filtros.papel,
    pagina: filtros.pagina,
    tamanho: filtros.tamanho,
  })
  return buscar<ContaAdmin[]>(`/admin/contas${query}`, comToken(token))
}

export function alterarPapelDaConta(id: string, papel: PapelProvisionavel): Promise<RespostaApi<null>> {
  return enviar<null>(`/admin/contas/${encodeURIComponent(id)}/papel`, { papel }, 'PATCH')
}
