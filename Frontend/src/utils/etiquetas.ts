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

export type MotivoRecusaEtiqueta = 'repetida' | 'formato' | 'longa' | 'limite'

export type EtiquetaRecusada = { etiqueta: string; motivo: MotivoRecusaEtiqueta }

export type InclusaoDeEtiquetas = {
  etiquetas: string[]
  recusadas: EtiquetaRecusada[]
  pendente: string
}

const MOTIVOS_QUE_FICAM_PARA_CORRIGIR: readonly MotivoRecusaEtiqueta[] = ['formato', 'longa']

function motivoDaRecusa(aceitas: readonly string[], candidata: string): MotivoRecusaEtiqueta | null {
  if (aceitas.includes(candidata)) return 'repetida'
  if ([...candidata].length > TAMANHO_MAXIMO_ETIQUETA) return 'longa'
  if (!FORMATO_ETIQUETA.test(candidata)) return 'formato'
  if (aceitas.length >= QUANTIDADE_MAXIMA_ETIQUETAS) return 'limite'
  return null
}

export function incluirEtiquetas(atuais: readonly string[], texto: string): InclusaoDeEtiquetas {
  const etiquetas = [...atuais]
  const recusadas: EtiquetaRecusada[] = []
  for (const candidata of normalizarEtiquetas(texto)) {
    const motivo = motivoDaRecusa(etiquetas, candidata)
    if (motivo) recusadas.push({ etiqueta: candidata, motivo })
    else etiquetas.push(candidata)
  }
  const pendente = recusadas
    .filter(({ motivo }) => MOTIVOS_QUE_FICAM_PARA_CORRIGIR.includes(motivo))
    .map(({ etiqueta }) => etiqueta)
    .join(' ')
  return { etiquetas, recusadas, pendente }
}

export function removerEtiqueta(atuais: readonly string[], etiqueta: string): string[] {
  return atuais.filter((atual) => atual !== etiqueta)
}

function comCerquilha(etiquetas: string[]): string {
  const marcadas = etiquetas.map((etiqueta) => `#${etiqueta}`)
  return marcadas.length > 1 ? `${marcadas.slice(0, -1).join(', ')} e ${marcadas.at(-1)}` : marcadas.join('')
}

export function descreverRecusas(recusadas: readonly EtiquetaRecusada[]): string | null {
  const por = (motivo: MotivoRecusaEtiqueta) =>
    recusadas.filter((recusada) => recusada.motivo === motivo).map(({ etiqueta }) => etiqueta)
  const repetidas = por('repetida')
  const longas = por('longa')
  const invalidas = por('formato')
  const excedentes = por('limite')
  const frases = [
    repetidas.length > 0 && `${comCerquilha(repetidas)} ${repetidas.length > 1 ? 'já estão' : 'já está'} na lista.`,
    longas.length > 0 && `Cada etiqueta pode ter até ${TAMANHO_MAXIMO_ETIQUETA} caracteres. Encurte ${comCerquilha(longas)}.`,
    invalidas.length > 0 && `Use só letras, números e hífen. Ajuste ${comCerquilha(invalidas)}.`,
    excedentes.length > 0
      && `O limite é de ${QUANTIDADE_MAXIMA_ETIQUETAS} etiquetas; ${comCerquilha(excedentes)} ${excedentes.length > 1 ? 'ficaram' : 'ficou'} de fora.`,
  ].filter(Boolean)
  return frases.length > 0 ? frases.join(' ') : null
}

export type AcaoDaTeclaNaEtiqueta = 'confirmar' | 'removerUltima' | 'nenhuma'

const TECLAS_QUE_CONFIRMAM_ETIQUETA = ['Enter', ',', ' ', '#']

export function acaoDaTeclaNaEtiqueta(tecla: string, rascunho: string, compondo = false): AcaoDaTeclaNaEtiqueta {
  if (compondo) return 'nenhuma'
  if (TECLAS_QUE_CONFIRMAM_ETIQUETA.includes(tecla)) return 'confirmar'
  if (tecla === 'Tab') return rascunho.trim() ? 'confirmar' : 'nenhuma'
  if (tecla === 'Backspace' && rascunho === '') return 'removerUltima'
  return 'nenhuma'
}

export function temSeparadorDeEtiqueta(texto: string): boolean {
  return SEPARADORES_DE_ETIQUETA.test(texto)
}

export function separarDigitacao(texto: string): { confirmar: string; restante: string } | null {
  const posicaoDoUltimoSeparador = Math.max(...[...texto].map((caractere, indice) =>
    temSeparadorDeEtiqueta(caractere) ? indice : -1))
  if (posicaoDoUltimoSeparador < 0) return null
  const caracteres = [...texto]
  return {
    confirmar: caracteres.slice(0, posicaoDoUltimoSeparador).join(''),
    restante: caracteres.slice(posicaoDoUltimoSeparador + 1).join(''),
  }
}
