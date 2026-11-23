import type { Peca } from '@/types/dominio'

export type MotivoIndisponivel = 'fora_do_catalogo' | 'removida'

export type FavoritoListado =
  | { slug: string; disponivel: true; peca: Peca }
  | { slug: string; disponivel: false; nome: string; imagem?: string; motivo: MotivoIndisponivel }

export function estaAVenda(peca: Peca): boolean {
  return !peca.inativadoEm && !peca.vendidaEmPedido && (!peca.situacao || peca.situacao === 'publicada')
}

export function nomeDoSlug(slug: string): string {
  const texto = slug.replace(/-/g, ' ').trim()
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Peça salva'
}

export function slugsSemPecaAVenda(slugs: string[], catalogo: ReadonlyMap<string, Peca>): string[] {
  return [...new Set(slugs)].filter((slug) => {
    const peca = catalogo.get(slug)
    return !peca || !estaAVenda(peca)
  })
}

export function classificarFavoritos(
  slugs: string[],
  catalogo: ReadonlyMap<string, Peca>,
  historico: ReadonlyMap<string, Peca | null>,
): FavoritoListado[] {
  return [...new Set(slugs)].map((slug): FavoritoListado => {
    const doCatalogo = catalogo.get(slug)
    if (doCatalogo && estaAVenda(doCatalogo)) return { slug, disponivel: true, peca: doCatalogo }
    const registro = historico.get(slug) ?? doCatalogo ?? null
    if (registro && estaAVenda(registro)) return { slug, disponivel: true, peca: registro }
    return registro
      ? { slug, disponivel: false, nome: registro.nome, imagem: registro.imagem, motivo: 'fora_do_catalogo' }
      : { slug, disponivel: false, nome: nomeDoSlug(slug), motivo: 'removida' }
  })
}
