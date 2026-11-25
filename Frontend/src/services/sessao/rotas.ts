import type { Papel } from '@/services/api/auth.servico'
import { PAPEIS_QUE_COMPRAM } from './papeis'

export const CABECALHO_CAMINHO_ATUAL = 'x-balaio-caminho'
const dentro = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(`${prefixo}/`)
export const rotaProtegida = (caminho: string) =>
  ['/account', '/orders', '/checkout', '/confirmation', '/dashboard', '/admin'].some((prefixo) => dentro(caminho, prefixo))
const ROTAS_DE_COMPRA = ['/orders', '/checkout', '/confirmation', '/account/addresses']
export const papeisDaRota = (caminho: string): readonly Papel[] | undefined => dentro(caminho, '/admin') ? ['admin']
  : dentro(caminho, '/dashboard') ? ['artesao']
    : ROTAS_DE_COMPRA.some((prefixo) => dentro(caminho, prefixo)) ? PAPEIS_QUE_COMPRAM : undefined
export const rotaPermitida = (caminho: string, papel: Papel) => papeisDaRota(caminho)?.includes(papel) ?? true
