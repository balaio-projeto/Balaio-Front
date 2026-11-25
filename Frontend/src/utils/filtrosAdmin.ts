import type { SituacaoFiltroCuradoria } from '@/services/api/curadoria.servico'
import type { FiltroPapelConta } from '@/services/api/contasAdmin.servico'

export const TAMANHO_PAGINA_ADMIN = 10
export const LIMITE_BUSCA_ADMIN = 100

type ParametrosUrl = Record<string, string | string[] | undefined>

const SITUACOES_CURADORIA: SituacaoFiltroCuradoria[] = ['pendente', 'ajuste', 'aprovada', 'todas']
const PAPEIS_FILTRO: FiltroPapelConta[] = ['todos', 'comprador', 'organizador']

export type FiltrosCuradoriaUrl = { situacao: SituacaoFiltroCuradoria; busca: string; pagina: number }
export type FiltrosContasUrl = { papel: FiltroPapelConta; busca: string; pagina: number }

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

export function lerPagina(valor: string | string[] | undefined): number {
  const texto = primeiro(valor)?.trim() ?? ''
  const numero = /^\d{1,6}$/.test(texto) ? Number(texto) : 1
  return numero >= 1 ? numero : 1
}

export function lerBusca(valor: string | string[] | undefined): string {
  return Array.from((primeiro(valor) ?? '').trim()).slice(0, LIMITE_BUSCA_ADMIN).join('')
}

function lerOpcao<T extends string>(valor: string | string[] | undefined, opcoes: T[], padrao: T): T {
  const texto = primeiro(valor)?.trim().toLowerCase()
  return opcoes.find((opcao) => opcao === texto) ?? padrao
}

export function lerFiltrosCuradoria(parametros: ParametrosUrl): FiltrosCuradoriaUrl {
  return {
    situacao: lerOpcao(parametros.situacao, SITUACOES_CURADORIA, 'pendente'),
    busca: lerBusca(parametros.busca),
    pagina: lerPagina(parametros.pagina),
  }
}

export function lerFiltrosContas(parametros: ParametrosUrl): FiltrosContasUrl {
  return {
    papel: lerOpcao(parametros.papel, PAPEIS_FILTRO, 'todos'),
    busca: lerBusca(parametros.busca),
    pagina: lerPagina(parametros.pagina),
  }
}

export function hrefAdmin(caminho: string, parametros: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === '') continue
    if (chave === 'pagina' && Number(valor) <= 1) continue
    query.set(chave, String(valor))
  }
  const texto = query.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

export function parametrosCuradoria({ situacao, busca }: Pick<FiltrosCuradoriaUrl, 'situacao' | 'busca'>) {
  return { situacao: situacao === 'pendente' ? undefined : situacao, busca }
}

export function parametrosContas({ papel, busca }: Pick<FiltrosContasUrl, 'papel' | 'busca'>) {
  return { papel: papel === 'todos' ? undefined : papel, busca }
}
