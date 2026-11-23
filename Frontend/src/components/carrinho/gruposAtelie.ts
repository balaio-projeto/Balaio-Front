export type GrupoAtelie<T> = { artesao: string; nome: string; entradas: T[] }

type ArtesaoConhecido = { slug: string; nome: string }

export function nomeDoAtelie(slug: string, artesaos: readonly ArtesaoConhecido[]): string {
  const nome = artesaos.find((artesao) => artesao.slug === slug)?.nome?.trim()
  if (nome) return nome
  return slug ? slug.replace(/-/g, ' ') : 'Ateliê não identificado'
}

export function agruparPorAtelie<T extends { peca: { artesao: string } }>(
  entradas: readonly T[],
  artesaos: readonly ArtesaoConhecido[],
): GrupoAtelie<T>[] {
  const grupos = new Map<string, T[]>()
  for (const entrada of entradas) {
    const lista = grupos.get(entrada.peca.artesao)
    if (lista) lista.push(entrada)
    else grupos.set(entrada.peca.artesao, [entrada])
  }
  return [...grupos].map(([artesao, lista]) => ({ artesao, nome: nomeDoAtelie(artesao, artesaos), entradas: lista }))
}

export function grupoEscolhido<T>(grupos: readonly GrupoAtelie<T>[], artesao: string | null): GrupoAtelie<T> | undefined {
  return grupos.find((grupo) => grupo.artesao === artesao) ?? grupos[0]
}
