import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarPecas } from '@/services/api/pecas.servico'
import { obterReferencias } from '@/services/api/referencias.servico'

export type SugestaoBusca = {
  texto: string
  href: string
  perfilDeArtesao: boolean
}

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
    href: `/artisans/${encodeURIComponent(artesao.slug)}`,
    perfilDeArtesao: true,
  }))
  return [...sugestoesDeTermo, ...sugestoesDeArtesao]
}
