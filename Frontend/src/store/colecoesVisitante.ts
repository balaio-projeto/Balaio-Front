import { COLECOES, type Colecao, type ColecoesDoUsuario } from '@/services/api/estado.servico'

const CHAVE = 'balaio:colecoes:visitante:v1'
export const LIMITE_HISTORICO_BUSCA = 8

export function colecoesVazias(): ColecoesDoUsuario {
  return { favoritos: [], historicoBusca: [], videosCurtidos: [], videosSalvos: [] }
}

export function normalizarColecoes(valor: unknown): ColecoesDoUsuario {
  const colecoes = colecoesVazias()
  if (!valor || typeof valor !== 'object') return colecoes
  for (const colecao of COLECOES) {
    const itens = (valor as Record<string, unknown>)[colecao]
    if (Array.isArray(itens)) colecoes[colecao] = [...new Set(itens.filter((item): item is string => typeof item === 'string'))]
  }
  return colecoes
}

export function lerColecoesVisitante(): ColecoesDoUsuario | null {
  try {
    const texto = localStorage.getItem(CHAVE)
    return texto === null ? null : normalizarColecoes(JSON.parse(texto))
  } catch {
    return null
  }
}

export function gravarColecaoVisitante(colecao: Colecao, itens: string[]): boolean {
  try {
    const atuais = lerColecoesVisitante() ?? colecoesVazias()
    localStorage.setItem(CHAVE, JSON.stringify({ ...atuais, [colecao]: itens }))
    return true
  } catch {
    return false
  }
}

export function esquecerColecoesVisitante(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    return
  }
}

export function mesclarColecao(colecao: Colecao, remotos: string[], locais: string[]): string[] {
  return colecao === 'historicoBusca'
    ? [...new Set([...locais, ...remotos])].slice(0, LIMITE_HISTORICO_BUSCA)
    : [...new Set([...remotos, ...locais])]
}
