import { precoFinalComDesconto } from '@/utils/formato'

export { precoFinalComDesconto }

export const DESCONTO_MAXIMO = 90
export const MENOR_PRECO_FINAL = 0.01

const DESCONTO_DIGITADO = /^\d+(\.\d+)?$/

function textoNormalizado(valor: string): string {
  return valor.trim().replace(/%$/, '').trim().replace(',', '.')
}

export function textoDoDesconto(desconto?: number | null): string {
  return desconto ? String(desconto).replace('.', ',') : ''
}

export function validarDesconto(valor: string): string | null {
  const texto = textoNormalizado(valor)
  if (!texto) return null
  if (!DESCONTO_DIGITADO.test(texto)) return `Digite um desconto entre 0 e ${DESCONTO_MAXIMO}%, como 15 ou 12,5`
  if (Number(texto) > DESCONTO_MAXIMO) return `O desconto máximo é de ${DESCONTO_MAXIMO}%`
  if ((texto.split('.')[1] ?? '').replace(/0+$/, '').length > 2) return 'Use no máximo 2 casas decimais, como 12,5'
  return null
}

export function numeroDoDesconto(valor: string): number {
  if (validarDesconto(valor)) return Number.NaN
  const texto = textoNormalizado(valor)
  return texto ? Number(texto) : 0
}


export function validarPrecoFinal(preco: number, desconto: number): string | null {
  if (!Number.isFinite(preco) || preco <= 0 || !Number.isFinite(desconto)) return null
  return precoFinalComDesconto(preco, desconto) < MENOR_PRECO_FINAL
    ? 'Com esse desconto o preço final fica abaixo de R$ 0,01'
    : null
}
