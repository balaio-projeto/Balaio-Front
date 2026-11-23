const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

type DataSimples = { ano: number; mes: number; dia: number }

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

function lerData(valor: string): DataSimples | null {
  const partes = FORMATO_DATA.exec(valor)
  if (!partes) return null
  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const conferida = new Date(Date.UTC(ano, mes - 1, dia))
  if (conferida.getUTCFullYear() !== ano || conferida.getUTCMonth() !== mes - 1 || conferida.getUTCDate() !== dia) return null
  return { ano, mes, dia }
}

export function dataValida(valor: string): boolean {
  return lerData(valor) !== null
}

export function horaValida(valor: string): boolean {
  return FORMATO_HORA.test(valor)
}

export function hojeNoFusoDoEvento(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

export function montarPeriodo(dataInicio: string, dataFim: string): string {
  const inicio = lerData(dataInicio)
  const fim = lerData(dataFim) ?? inicio
  if (!inicio || !fim) return ''
  const mesInicio = MESES[inicio.mes - 1]
  const mesFim = MESES[fim.mes - 1]
  if (inicio.ano === fim.ano && inicio.mes === fim.mes && inicio.dia === fim.dia) return `${inicio.dia} de ${mesInicio} de ${inicio.ano}`
  if (inicio.ano === fim.ano && inicio.mes === fim.mes) return `${inicio.dia} a ${fim.dia} de ${mesInicio} de ${inicio.ano}`
  if (inicio.ano === fim.ano) return `${inicio.dia} de ${mesInicio} a ${fim.dia} de ${mesFim} de ${inicio.ano}`
  return `${inicio.dia} de ${mesInicio} de ${inicio.ano} a ${fim.dia} de ${mesFim} de ${fim.ano}`
}

function horaLegivel(valor: string): string {
  const partes = FORMATO_HORA.exec(valor)
  if (!partes) return ''
  const horas = Number(partes[1])
  return partes[2] === '00' ? `${horas}h` : `${horas}h${partes[2]}`
}

export function montarHorario(horarioInicio: string, horarioFim: string): string {
  const inicio = horaLegivel(horarioInicio)
  const fim = horaLegivel(horarioFim)
  if (inicio && fim) return `${inicio} às ${fim}`
  if (inicio) return `A partir das ${inicio}`
  if (fim) return `Até as ${fim}`
  return ''
}

export type DatasDoEvento = { dataInicio: string; dataFim: string; horarioInicio: string; horarioFim: string }

export function problemasDasDatas(datas: DatasDoEvento, hoje = hojeNoFusoDoEvento()): Record<string, string> {
  const problemas: Record<string, string> = {}
  const { dataInicio, dataFim, horarioInicio, horarioFim } = datas
  if (!dataInicio) problemas.dataInicio = 'Informe o dia em que o evento começa'
  else if (!dataValida(dataInicio)) problemas.dataInicio = 'Use uma data válida para o início'
  if (!dataFim) problemas.dataFim = 'Informe o dia em que o evento termina'
  else if (!dataValida(dataFim)) problemas.dataFim = 'Use uma data válida para o término'
  else if (dataValida(dataInicio) && dataFim < dataInicio) problemas.dataFim = 'O término não pode ser antes do início'
  else if (dataFim < hoje) problemas.dataFim = 'Este evento já terminou. Informe datas de hoje em diante'
  if (horarioInicio && !horaValida(horarioInicio)) problemas.horarioInicio = 'Use um horário válido, como 09:00'
  if (horarioFim && !horaValida(horarioFim)) problemas.horarioFim = 'Use um horário válido, como 18:00'
  const mesmoDia = dataInicio !== '' && dataInicio === dataFim
  if (mesmoDia && horaValida(horarioInicio) && horaValida(horarioFim) && horarioFim <= horarioInicio) {
    problemas.horarioFim = 'Em evento de um dia só, o término precisa ser depois do início'
  }
  return problemas
}
