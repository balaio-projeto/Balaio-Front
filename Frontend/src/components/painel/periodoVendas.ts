const FORMATO_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export type ProblemaPeriodo = { campo: 'de' | 'ate'; mensagem: string }

export function ehDataIsoValida(texto: string): boolean {
  if (!FORMATO_DATA_ISO.test(texto)) return false
  const data = new Date(`${texto}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto
}

export function problemaDoPeriodoPersonalizado(de: string, ate: string): ProblemaPeriodo | null {
  if (!de) return { campo: 'de', mensagem: 'Informe a data inicial' }
  if (!ehDataIsoValida(de)) return { campo: 'de', mensagem: 'Use uma data válida' }
  if (!ate) return { campo: 'ate', mensagem: 'Informe a data final' }
  if (!ehDataIsoValida(ate)) return { campo: 'ate', mensagem: 'Use uma data válida' }
  if (de > ate) return { campo: 'ate', mensagem: 'A data final precisa ser igual ou posterior à inicial' }
  return null
}
