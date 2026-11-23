import type { FotoPeca, Peca } from '@/types/dominio'
import { buscar, comToken, enviar, montarQuery } from './cliente'
import type { RespostaApi } from './tipos'

export type Ordenacao = 'recentes' | 'preco-asc' | 'preco-desc' | 'avaliacao'

export type FiltrosPeca = {
  tecnica?: string; territorio?: string; categoria?: string; tipo?: string; q?: string; disponibilidade?: string
  desconto?: boolean
  precoMin?: number; precoMax?: number
  ordenar?: Ordenacao
  pagina?: number; tamanho?: number
}
export function listarPecas(filtros: FiltrosPeca = {}): Promise<RespostaApi<Peca[]>> {
  return buscar('/pecas' + montarQuery({ ...filtros, desconto: filtros.desconto ? 'true' : undefined }))
}
export function obterPeca(slug: string, token?: string): Promise<RespostaApi<Peca>> {
  return buscar('/pecas/' + encodeURIComponent(slug), comToken(token))
}
export function obterPecaHistorico(slug: string): Promise<RespostaApi<Peca>> {
  return buscar('/pecas/' + encodeURIComponent(slug) + '/historico')
}
export function pecasRelacionadas(slug: string, limite = 3): Promise<RespostaApi<Peca[]>> {
  return buscar('/pecas/' + encodeURIComponent(slug) + '/relacionadas' + montarQuery({ limite }))
}
export async function pecasPorTipo(
  tipo: string,
  { excluir, limite = 12 }: { excluir?: string; limite?: number } = {},
): Promise<RespostaApi<Peca[]>> {
  const resposta = await listarPecas({ tipo, tamanho: limite + 1 })
  if (!resposta.dados) return resposta
  return { ...resposta, dados: resposta.dados.filter((peca) => peca.slug !== excluir).slice(0, limite) }
}
export function pecasPorArtesao(slug: string): Promise<RespostaApi<Peca[]>> {
  return buscar('/artesaos/' + encodeURIComponent(slug) + '/pecas')
}
export function pecasPainelArtesao(slug: string, token: string): Promise<RespostaApi<Peca[]>> {
  return buscar('/artesaos/' + encodeURIComponent(slug) + '/pecas/painel', comToken(token))
}
export type FotoParaEnviar = Pick<FotoPeca, 'id' | 'nome' | 'url'>
export type DadosPeca = Pick<Peca, 'nome' | 'tecnica' | 'territorio' | 'categoria' | 'tipo' | 'historia' | 'preco' | 'disponibilidade'> & {
  situacao: NonNullable<Peca['situacao']>
  prazoProducaoDias?: number | null
  fotos: FotoParaEnviar[]
}
export type AlteracoesPeca = Partial<DadosPeca>

const PRAZO_ESCRITA_DE_PECA_MS = 60_000
const AVISO_ESCRITA_INCERTA = 'O envio demorou demais e não sabemos se a peça foi salva. Confira a lista de peças antes de tentar de novo.'

async function escreverPeca(caminho: string, corpo: unknown, metodo: 'POST' | 'PATCH'): Promise<RespostaApi<Peca>> {
  const resposta = await buscar<Peca>(caminho, {
    method: metodo, body: JSON.stringify(corpo), signal: AbortSignal.timeout(PRAZO_ESCRITA_DE_PECA_MS),
  })
  if (resposta.erro?.codigo === 'ERRO_REDE') return { dados: null, erro: { ...resposta.erro, mensagem: AVISO_ESCRITA_INCERTA } }
  return resposta
}

export function criarPeca(dados: DadosPeca): Promise<RespostaApi<Peca>> {
  return escreverPeca('/pecas', dados, 'POST')
}
export function atualizarPeca(slug: string, alteracoes: AlteracoesPeca): Promise<RespostaApi<Peca>> {
  return escreverPeca(`/pecas/${encodeURIComponent(slug)}`, alteracoes, 'PATCH')
}
export function excluirPeca(slug: string): Promise<RespostaApi<Peca>> {
  return buscar(`/pecas/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}
export function reativarPeca(slug: string): Promise<RespostaApi<Peca>> {
  return enviar(`/pecas/${encodeURIComponent(slug)}/reativacao`, {})
}
