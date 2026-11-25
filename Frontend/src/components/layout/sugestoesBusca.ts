import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarPecas } from '@/services/api/pecas.servico'
import { obterReferencias } from '@/services/api/referencias.servico'
import { casaComBusca } from '@/utils/busca'

export type SugestaoBusca = {
  texto: string
  detalhe?: string
  href: string
  perfilDeArtesao: boolean
}

const LIMITE_PERFIS = 3

const hrefDaBusca = (termo: string) => `/search?q=${encodeURIComponent(termo)}`

export async function carregarSugestoesDeBusca(): Promise<SugestaoBusca[]> {
  const [pecas, referencias, artesaos] = await Promise.all([listarPecas(), obterReferencias(), listarArtesaos()])
  const termosDoCatalogo = [
    ...(pecas.dados ?? []).map((peca) => peca.nome),
    ...(referencias.dados
      ? [...referencias.dados.tipos, ...referencias.dados.tecnicas, ...referencias.dados.territorios, ...referencias.dados.categorias]
      : []),
  ]
  const sugestoesDeTermo = Array.from(new Set(termosDoCatalogo)).map((termo) => ({
    texto: termo,
    href: hrefDaBusca(termo),
    perfilDeArtesao: false,
  }))
  const sugestoesDeArtesao = (artesaos.dados ?? []).map((artesao) => ({
    texto: artesao.nome,
    detalhe: artesao.atelie || undefined,
    href: `/artisans/${encodeURIComponent(artesao.slug)}`,
    perfilDeArtesao: true,
  }))
  return [...sugestoesDeTermo, ...sugestoesDeArtesao]
}

export function filtrarSugestoes(todas: readonly SugestaoBusca[], consulta: string, limite: number): SugestaoBusca[] {
  const encontradas = todas.filter((sugestao) => casaComBusca([sugestao.texto, sugestao.detalhe], consulta))
  const perfis = encontradas.filter((sugestao) => sugestao.perfilDeArtesao).slice(0, LIMITE_PERFIS)
  const termos = encontradas.filter((sugestao) => !sugestao.perfilDeArtesao)
  return [...termos.slice(0, Math.max(0, limite - perfis.length)), ...perfis]
}
