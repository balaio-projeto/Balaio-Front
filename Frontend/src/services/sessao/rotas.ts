export const CABECALHO_CAMINHO_ATUAL = 'x-balaio-caminho'
const dentro = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(`${prefixo}/`)
export const rotaProtegida = (caminho: string) =>
  ['/account', '/orders', '/checkout', '/confirmation', '/dashboard', '/admin'].some((prefixo) => dentro(caminho, prefixo))
const ROTAS_DO_COMPRADOR = ['/orders', '/checkout', '/confirmation', '/account/addresses']
export const papelDaRota = (caminho: string) => dentro(caminho, '/admin') ? 'admin'
  : dentro(caminho, '/dashboard') ? 'artesao'
    : ROTAS_DO_COMPRADOR.some((prefixo) => dentro(caminho, prefixo)) ? 'comprador' : undefined
