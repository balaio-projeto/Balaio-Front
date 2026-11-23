'use client'

import { useSyncExternalStore } from 'react'

export type PreferenciaSom = { mudo: boolean; volume: number }

const CHAVE_ARMAZENAMENTO = 'balaio-som-videos'
const PREFERENCIA_INICIAL: PreferenciaSom = { mudo: true, volume: 1 }

let preferenciaAtual: PreferenciaSom | null = null
const ouvintes = new Set<() => void>()

function volumeValido(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= 1 ? valor : null
}

function lerArmazenada(): PreferenciaSom {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_ARMAZENAMENTO)
    if (!bruto) return PREFERENCIA_INICIAL
    const lido = JSON.parse(bruto) as Partial<PreferenciaSom> | null
    return {
      mudo: typeof lido?.mudo === 'boolean' ? lido.mudo : PREFERENCIA_INICIAL.mudo,
      volume: volumeValido(lido?.volume) ?? PREFERENCIA_INICIAL.volume,
    }
  } catch {
    return PREFERENCIA_INICIAL
  }
}

export function lerPreferenciaSom(): PreferenciaSom {
  if (typeof window === 'undefined') return PREFERENCIA_INICIAL
  preferenciaAtual ??= lerArmazenada()
  return preferenciaAtual
}

export function definirPreferenciaSom(mudanca: Partial<PreferenciaSom>) {
  const anterior = lerPreferenciaSom()
  const proxima: PreferenciaSom = {
    mudo: mudanca.mudo ?? anterior.mudo,
    volume: volumeValido(mudanca.volume) ?? anterior.volume,
  }
  if (proxima.mudo === anterior.mudo && proxima.volume === anterior.volume) return
  preferenciaAtual = proxima
  try {
    window.sessionStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(proxima))
  } catch {}
  for (const ouvinte of ouvintes) ouvinte()
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function usePreferenciaSom(): PreferenciaSom {
  return useSyncExternalStore(inscrever, lerPreferenciaSom, () => PREFERENCIA_INICIAL)
}
