export type EstadoDaBusca = 'erro' | 'vazio' | 'resultados'

/**
 * Falha de rede ou de contrato não pode ser apresentada como lista vazia (TC14):
 * o erro tem precedência sobre a ausência de itens.
 */
export function estadoDaBusca(dados: unknown[] | null | undefined, erro: unknown): EstadoDaBusca {
  if (erro) return 'erro'
  if (!dados || dados.length === 0) return 'vazio'
  return 'resultados'
}

const MAXIMO_PALAVRAS = 8
const PALAVRAS_DE_LIGACAO = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'um', 'uma', 'com', 'para', 'por',
])
const TERMINACOES_SEM_ES = ['ais', 'eis', 'ois', 'res', 'zes', 'ses']

export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
}

export function singular(palavra: string): string {
  const tamanho = palavra.length
  if (tamanho < 4 || !palavra.endsWith('s')) return palavra
  if (tamanho >= 5 && (palavra.endsWith('oes') || palavra.endsWith('aes'))) return `${palavra.slice(0, -3)}a`
  if (tamanho >= 5 && TERMINACOES_SEM_ES.some((terminacao) => palavra.endsWith(terminacao))) return palavra.slice(0, -2)
  if (palavra.endsWith('ns')) return `${palavra.slice(0, -2)}m`
  return palavra.slice(0, -1)
}

export function palavrasDaBusca(consulta: string): string[][] {
  const palavras = [...new Set(normalizarBusca(consulta).trim().split(/\s+/).filter(Boolean))]
  const relevantes = palavras.filter((palavra) => !PALAVRAS_DE_LIGACAO.has(palavra))
  return (relevantes.length > 0 ? relevantes : palavras)
    .slice(0, MAXIMO_PALAVRAS)
    .map((palavra) => [...new Set([palavra, singular(palavra)])])
}

export function casaComBusca(campos: readonly (string | null | undefined)[], consulta: string): boolean {
  const palavras = palavrasDaBusca(consulta)
  if (palavras.length === 0) return false
  const texto = normalizarBusca(campos.filter(Boolean).join(' '))
  return palavras.every((variantes) => variantes.some((variante) => texto.includes(variante)))
}
