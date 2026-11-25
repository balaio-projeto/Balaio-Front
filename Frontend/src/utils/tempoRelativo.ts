const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

export function tempoRelativo(data: string | Date, agora: Date = new Date()): string {
  const momento = typeof data === 'string' ? new Date(data) : data
  const passado = agora.getTime() - momento.getTime()
  if (Number.isNaN(passado)) return ''
  if (passado < MINUTO) return 'agora'
  if (passado < HORA) return `há ${Math.floor(passado / MINUTO)} min`
  if (passado < DIA) return `há ${Math.floor(passado / HORA)} h`
  if (passado < 2 * DIA) return 'ontem'
  if (passado < 7 * DIA) return `há ${Math.floor(passado / DIA)} dias`
  return momento.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Recife' })
}
