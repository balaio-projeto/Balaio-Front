import type { Destaque } from '@/components/produto/CarrosselDestaques'
import { destaquesEditoriais } from '@/constants/vitrine'
import type { Peca } from '@/types/dominio'
import { imagemReal } from '@/utils/imagem'

export const MAXIMO_POR_PRATELEIRA = 12

export type Vitrine = {
  ofertas: Peca[]
  maisAvaliadas: Peca[]
}

const limitar = (pecas: Peca[]) => pecas.slice(0, MAXIMO_POR_PRATELEIRA)

export function montarVitrine(pecas: Peca[]): Vitrine {
  const ofertas = pecas.filter((p) => (p.desconto ?? 0) > 0).sort((a, b) => (b.desconto ?? 0) - (a.desconto ?? 0))
  const maisAvaliadas = [...pecas].sort(
    (a, b) => (b.avaliacao ?? 0) - (a.avaliacao ?? 0) || (b.totalAvaliacoes ?? 0) - (a.totalAvaliacoes ?? 0),
  )
  return { ofertas: limitar(ofertas), maisAvaliadas: limitar(maisAvaliadas) }
}

export const QUANTIDADE_DE_DESTAQUES = 5

const titulosEditoriais = new Map(destaquesEditoriais.map(({ slug, titulo }) => [slug, titulo]))

function embaralhar<T>(itens: T[], sortear: () => number): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

export function montarDestaques(pecas: Peca[], sortear: () => number = Math.random): Destaque[] {
  const disponiveis = pecas.filter((peca) => !peca.inativadoEm)
  const comFoto = embaralhar(disponiveis.filter((peca) => imagemReal(peca.imagem)), sortear)
  const semFoto = embaralhar(disponiveis.filter((peca) => !imagemReal(peca.imagem)), sortear)
  return [...comFoto, ...semFoto].slice(0, QUANTIDADE_DE_DESTAQUES).map((peca) => ({
    slug: peca.slug,
    titulo: titulosEditoriais.get(peca.slug) ?? peca.nome,
    nome: peca.nome,
    territorio: peca.territorio,
    resumo: peca.historia[0] ?? '',
    imagem: peca.imagem,
  }))
}
