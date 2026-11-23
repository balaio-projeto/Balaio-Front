import { buscar, enviar, montarQuery } from './cliente'
import type { RespostaApi } from './tipos'

export type PapelConta = 'comprador' | 'artesao' | 'organizador' | 'admin'

export type PapelProvisionavel = Extract<PapelConta, 'comprador' | 'organizador'>

export type ContaAdmin = {
  id: string
  nome: string
  email: string
  papel: PapelConta
}

export function buscarContaPorEmail(email: string): Promise<RespostaApi<ContaAdmin>> {
  return buscar<ContaAdmin>(`/admin/contas${montarQuery({ email: email.trim() })}`)
}

export function alterarPapelDaConta(id: string, papel: PapelProvisionavel): Promise<RespostaApi<null>> {
  return enviar<null>(`/admin/contas/${encodeURIComponent(id)}/papel`, { papel }, 'PATCH')
}
