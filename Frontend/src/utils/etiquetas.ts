export const TAMANHO_MAXIMO_LEGENDA = 500
export const QUANTIDADE_MAXIMA_ETIQUETAS = 10
export const TAMANHO_MAXIMO_ETIQUETA = 30

const FORMATO_ETIQUETA = new RegExp(`^[\\p{L}0-9-]{1,${TAMANHO_MAXIMO_ETIQUETA}}$`, 'u')
const SEPARADORES_DE_ETIQUETA = /[\s,#]+/u

export function normalizarEtiquetas(texto: string): string[] {
  const etiquetas = texto
    .normalize('NFC')
    .split(SEPARADORES_DE_ETIQUETA)
    .map((etiqueta) => etiqueta.toLowerCase())
    .filter(Boolean)
  return [...new Set(etiquetas)]
}

export function etiquetasComoTexto(etiquetas: readonly string[]): string {
  return etiquetas.join(' ')
}

function citar(etiquetas: string[]): string {
  return etiquetas.map((etiqueta) => `"${etiqueta}"`).join(', ')
}

export function validarEtiquetas(etiquetas: readonly string[]): string | null {
  if (etiquetas.length > QUANTIDADE_MAXIMA_ETIQUETAS) {
    return `Use até ${QUANTIDADE_MAXIMA_ETIQUETAS} etiquetas. Agora são ${etiquetas.length}.`
  }
  const longas = etiquetas.filter((etiqueta) => [...etiqueta].length > TAMANHO_MAXIMO_ETIQUETA)
  if (longas.length > 0) {
    return `Cada etiqueta pode ter até ${TAMANHO_MAXIMO_ETIQUETA} caracteres. Encurte ${citar(longas)}.`
  }
  const invalidas = etiquetas.filter((etiqueta) => !FORMATO_ETIQUETA.test(etiqueta))
  if (invalidas.length > 0) {
    return `Use só letras, números e hífen nas etiquetas. Ajuste ${citar(invalidas)}.`
  }
  return null
}

export function validarLegenda(legenda: string): string | null {
  const texto = legenda.trim()
  if (!texto) return 'Escreva uma legenda contando o que aparece na cena'
  if (texto.length > TAMANHO_MAXIMO_LEGENDA) return `A legenda pode ter até ${TAMANHO_MAXIMO_LEGENDA} caracteres.`
  return null
}

export type ErrosCamposVideo = { legenda: string | null; etiquetas: string | null }

export type CamposVideoLidos = {
  legenda: string
  etiquetas: string[]
  erros: ErrosCamposVideo
  valido: boolean
}

export function lerCamposVideo(legenda: string, etiquetasDigitadas: string): CamposVideoLidos {
  const etiquetas = normalizarEtiquetas(etiquetasDigitadas)
  const erros = { legenda: validarLegenda(legenda), etiquetas: validarEtiquetas(etiquetas) }
  return { legenda: legenda.trim(), etiquetas, erros, valido: !erros.legenda && !erros.etiquetas }
}
