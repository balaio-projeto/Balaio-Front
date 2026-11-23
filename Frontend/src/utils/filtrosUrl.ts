import { categorias, tecnicas, territorios, tipos } from '@/constants/referencias'
import { rotuloDisponibilidade, rotuloOrdenacao } from '@/constants/rotulos'
import type { Ordenacao } from '@/services/api/pecas.servico'
import type { RespostaApi } from '@/services/api/tipos'
import type { Disponibilidade } from '@/types/dominio'
import { emReais } from '@/utils/formato'

export const LIMITE_BUSCA = 80
export const ORDENACAO_PADRAO: Ordenacao = 'recentes'
export const PRECO_MAXIMO_FILTRO = 1_000_000

export type ReferenciasFiltro = {
  tipos: readonly string[]
  tecnicas: readonly string[]
  territorios: readonly string[]
  categorias: readonly string[]
}

export const referenciasDeReserva: ReferenciasFiltro = { tipos, tecnicas, territorios, categorias }

const listaDeTextos = (valor: unknown): string[] | null =>
  Array.isArray(valor) && valor.every((item) => typeof item === 'string') ? valor.filter((item) => item.trim() !== '') : null

export function referenciasParaFiltros(
  resposta: Pick<RespostaApi<Partial<Record<keyof ReferenciasFiltro, unknown>>>, 'dados' | 'erro'> | null | undefined,
): ReferenciasFiltro {
  if (!resposta || resposta.erro || !resposta.dados) return referenciasDeReserva
  const recebidas = {
    tipos: listaDeTextos(resposta.dados.tipos),
    tecnicas: listaDeTextos(resposta.dados.tecnicas),
    territorios: listaDeTextos(resposta.dados.territorios),
    categorias: listaDeTextos(resposta.dados.categorias),
  }
  if (!recebidas.tipos || !recebidas.tecnicas || !recebidas.territorios || !recebidas.categorias) return referenciasDeReserva
  return recebidas as ReferenciasFiltro
}

export type FiltrosListagem = {
  q?: string
  tipo?: string
  tecnica?: string
  territorio?: string
  categoria?: string
  disponibilidade?: Disponibilidade
  desconto?: boolean
  precoMin?: number
  precoMax?: number
  ordenar: Ordenacao
  pagina: number
}

export type ChaveFiltro = 'q' | 'tipo' | 'tecnica' | 'territorio' | 'categoria' | 'disponibilidade' | 'desconto' | 'preco'

type Parametros = Record<string, string | string[] | undefined>

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor)

function aceito<T extends string>(valor: string | undefined, permitidos: readonly T[]): T | undefined {
  return permitidos.find((permitido) => permitido === valor)
}

export const disponibilidades = Object.keys(rotuloDisponibilidade) as Disponibilidade[]
export const ordenacoes = Object.keys(rotuloOrdenacao) as Ordenacao[]

export function lerPreco(valor: string | undefined): number | undefined {
  const texto = valor?.trim().replace(',', '.')
  if (!texto || !/^\d+(\.\d{1,2})?$/.test(texto)) return undefined
  const preco = Number(texto)
  return preco > 0 && preco <= PRECO_MAXIMO_FILTRO ? preco : undefined
}

export function lerFiltros(parametros: Parametros, referencias: ReferenciasFiltro = referenciasDeReserva): FiltrosListagem {
  const q = primeiro(parametros.q)?.trim().slice(0, LIMITE_BUSCA)
  const pagina = Math.floor(Number(primeiro(parametros.pagina)))
  const precoInformadoMin = lerPreco(primeiro(parametros.precoMin))
  const precoInformadoMax = lerPreco(primeiro(parametros.precoMax))
  const invertido = precoInformadoMin !== undefined && precoInformadoMax !== undefined && precoInformadoMin > precoInformadoMax
  return {
    q: q || undefined,
    tipo: aceito(primeiro(parametros.tipo), referencias.tipos),
    tecnica: aceito(primeiro(parametros.tecnica), referencias.tecnicas),
    territorio: aceito(primeiro(parametros.territorio), referencias.territorios),
    categoria: aceito(primeiro(parametros.categoria), referencias.categorias),
    disponibilidade: aceito(primeiro(parametros.disponibilidade), disponibilidades),
    desconto: primeiro(parametros.desconto) === 'true' || undefined,
    precoMin: invertido ? precoInformadoMax : precoInformadoMin,
    precoMax: invertido ? precoInformadoMin : precoInformadoMax,
    ordenar: aceito(primeiro(parametros.ordenar), ordenacoes) ?? ORDENACAO_PADRAO,
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
  }
}

export function hrefListagem(filtros: Partial<FiltrosListagem>): string {
  const parametros = new URLSearchParams()
  const { ordenar, pagina, desconto, ...resto } = filtros
  for (const [chave, valor] of Object.entries(resto)) {
    if (valor) parametros.set(chave, String(valor))
  }
  if (desconto) parametros.set('desconto', 'true')
  if (ordenar && ordenar !== ORDENACAO_PADRAO) parametros.set('ordenar', ordenar)
  if (pagina && pagina > 1) parametros.set('pagina', String(pagina))
  const texto = parametros.toString()
  return texto ? `/search?${texto}` : '/search'
}

export function hrefCom(filtros: FiltrosListagem, mudanca: Partial<FiltrosListagem>): string {
  return hrefListagem({ ...filtros, pagina: 1, ...mudanca })
}

export function hrefSem(filtros: FiltrosListagem, chave: ChaveFiltro): string {
  if (chave === 'preco') return hrefListagem({ ...filtros, precoMin: undefined, precoMax: undefined, pagina: 1 })
  return hrefListagem({ ...filtros, [chave]: undefined, pagina: 1 })
}

export function parametrosPreservadosNaFaixaDePreco(filtros: FiltrosListagem): [string, string][] {
  const destino = hrefListagem({ ...filtros, precoMin: undefined, precoMax: undefined, pagina: 1 })
  return [...new URLSearchParams(destino.split('?')[1] ?? '').entries()]
}

export function rotuloFaixaDePreco(filtros: Pick<FiltrosListagem, 'precoMin' | 'precoMax'>): string | undefined {
  const { precoMin, precoMax } = filtros
  if (precoMin !== undefined && precoMax !== undefined) return `${emReais(precoMin)} a ${emReais(precoMax)}`
  if (precoMin !== undefined) return `A partir de ${emReais(precoMin)}`
  if (precoMax !== undefined) return `Até ${emReais(precoMax)}`
  return undefined
}

export type FiltroAtivo = { chave: ChaveFiltro; rotulo: string; valor: string }

export function filtrosAtivos(filtros: FiltrosListagem): FiltroAtivo[] {
  const ativos: FiltroAtivo[] = []
  if (filtros.q) ativos.push({ chave: 'q', rotulo: 'Busca', valor: `"${filtros.q}"` })
  if (filtros.tipo) ativos.push({ chave: 'tipo', rotulo: 'Tipo', valor: filtros.tipo })
  if (filtros.tecnica) ativos.push({ chave: 'tecnica', rotulo: 'Técnica', valor: filtros.tecnica })
  if (filtros.territorio) ativos.push({ chave: 'territorio', rotulo: 'Território', valor: filtros.territorio })
  if (filtros.categoria) ativos.push({ chave: 'categoria', rotulo: 'Categoria', valor: filtros.categoria })
  if (filtros.disponibilidade) {
    ativos.push({ chave: 'disponibilidade', rotulo: 'Disponibilidade', valor: rotuloDisponibilidade[filtros.disponibilidade] })
  }
  if (filtros.desconto) ativos.push({ chave: 'desconto', rotulo: 'Preço', valor: 'Com desconto' })
  const faixa = rotuloFaixaDePreco(filtros)
  if (faixa) ativos.push({ chave: 'preco', rotulo: 'Faixa de preço', valor: faixa })
  return ativos
}
