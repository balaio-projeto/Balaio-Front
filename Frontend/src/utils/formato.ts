import type { Peca } from '@/types/dominio'

export function emReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function partirReais(valor: number): { sinal: string; inteiro: string; centavos: string } {
  const totalCentavos = Math.round((Number.isFinite(valor) ? valor : 0) * 100)
  const absoluto = Math.abs(totalCentavos)
  return {
    sinal: totalCentavos < 0 ? '-' : '',
    inteiro: Math.floor(absoluto / 100).toLocaleString('pt-BR'),
    centavos: String(absoluto % 100).padStart(2, '0'),
  }
}

export function precoFinalComDesconto(preco: number, desconto: number): number {
  const centavos = Math.round(preco * 100)
  const centesimosDeDesconto = Math.round(desconto * 100)
  return Math.round((centavos * (10000 - centesimosDeDesconto)) / 10000) / 100
}

export function precoComDesconto(peca: Pick<Peca, 'preco' | 'desconto'>): number {
  if (!peca.desconto) return peca.preco
  return precoFinalComDesconto(peca.preco, peca.desconto)
}

export function emMilhares(n: number): string {
  if (n < 1000) return String(n)
  const valor = n / 1000
  return `${valor.toFixed(valor >= 10 ? 0 : 1).replace('.', ',')} mil`
}
