'use client'

import { useSyncExternalStore } from 'react'

export const PROPORCAO_PARA_ENTRAR_EM_FOCO = 0.6
export const PROPORCAO_PARA_SAIR_DE_FOCO = 0.25
const VANTAGEM_PARA_TROCAR_DE_FOCO = 0.15

export const LIMIARES_DE_VISIBILIDADE = Array.from({ length: 21 }, (_, i) => i / 20)

const proporcoes = new Map<string, number>()
let videoEmFoco: string | null = null
const ouvintes = new Set<() => void>()

function avisarOuvintes() {
  for (const ouvinte of ouvintes) ouvinte()
}

export function escolherFoco(atual: string | null, visiveis: ReadonlyMap<string, number>): string | null {
  const proporcaoAtual = atual ? visiveis.get(atual) ?? 0 : 0
  let candidato: string | null = null
  let proporcaoCandidato = 0
  for (const [id, proporcao] of visiveis) {
    if (proporcao > proporcaoCandidato) {
      candidato = id
      proporcaoCandidato = proporcao
    }
  }
  const manterAtual = atual !== null && proporcaoAtual >= PROPORCAO_PARA_SAIR_DE_FOCO
  if (!candidato || proporcaoCandidato < PROPORCAO_PARA_ENTRAR_EM_FOCO) return manterAtual ? atual : null
  if (!manterAtual || candidato === atual) return candidato
  return proporcaoCandidato >= proporcaoAtual + VANTAGEM_PARA_TROCAR_DE_FOCO ? candidato : atual
}

function recalcular() {
  const proximo = escolherFoco(videoEmFoco, proporcoes)
  if (proximo === videoEmFoco) return
  videoEmFoco = proximo
  avisarOuvintes()
}

export function informarProporcaoVisivel(id: string, proporcao: number) {
  if (proporcao <= 0) proporcoes.delete(id)
  else proporcoes.set(id, proporcao)
  recalcular()
}

export function esquecerVideo(id: string) {
  proporcoes.delete(id)
  recalcular()
}

export function proporcaoVisivel(entrada: IntersectionObserverEntry): number {
  if (!entrada.isIntersecting) return 0
  const alturaVisivel = entrada.intersectionRect.height
  const alturaElemento = entrada.boundingClientRect.height
  const alturaRaiz = entrada.rootBounds?.height ?? alturaElemento
  const referencia = Math.min(alturaElemento, alturaRaiz)
  if (referencia <= 0) return entrada.intersectionRatio
  return Math.min(1, alturaVisivel / referencia)
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useVideoEmFoco(id: string): boolean {
  return useSyncExternalStore(inscrever, () => videoEmFoco === id, () => false)
}
