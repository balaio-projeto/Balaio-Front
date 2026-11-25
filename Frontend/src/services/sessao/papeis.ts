import type { Papel } from '@/services/api/auth.servico'

export const PAPEIS_QUE_COMPRAM: readonly Papel[] = ['comprador', 'artesao']

export const MENSAGEM_PECA_DO_PROPRIO_ATELIE = 'Esta peça é do seu ateliê'

export function rotuloDasCompras(papel: string | null | undefined): string {
  return papel === 'artesao' ? 'Minhas compras' : 'Meus pedidos'
}

export function podeComprar(papel: string | null | undefined): boolean {
  return PAPEIS_QUE_COMPRAM.some((papelQueCompra) => papelQueCompra === papel)
}

export function pecaDoProprioAtelie(
  sessao: { papel: string; artesao?: string } | null | undefined,
  artesaoDaPeca: string | null | undefined,
): boolean {
  return sessao?.papel === 'artesao' && Boolean(sessao.artesao) && sessao.artesao === artesaoDaPeca
}
