import type { EstadoPedido } from '@/types/dominio'

export const PROXIMO_ESTADO_DO_ARTESAO: Partial<Record<EstadoPedido, EstadoPedido>> = {
  confirmado: 'producao',
  producao: 'enviado',
  enviado: 'entregue',
}

export function validarRastreio(valor: string): string | null {
  const codigo = valor.trim()
  if (!codigo) return 'Informe o código de rastreio do envio'
  return /^[A-Za-z0-9][A-Za-z0-9-]{4,39}$/.test(codigo) ? null : 'Use de 5 a 40 letras, números ou hífens, sem espaços'
}

export function textoDaMetrica(valor: number | null | undefined, formatar: (numero: number) => string = String): string {
  return valor === null || valor === undefined ? 'Indisponível' : formatar(valor)
}

export function rotuloDoPonto(inicio: string, granularidade: 'dia' | 'mes'): string {
  const [ano, mes, dia] = inicio.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (granularidade === 'dia') return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
  return data.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
}
