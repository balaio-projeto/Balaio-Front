'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useEstadoPersistido } from '@/hooks/useEstadoPersistido'
import { LIMITE_HISTORICO_BUSCA } from '@/store/colecoesVisitante'
import { useEstadoCliente } from '@/store/estadoCliente'

const HISTORICO_VAZIO: string[] = []
const TAMANHO_MAXIMO_TERMO = 120

export function termoParaHistorico(termo: string): string {
  let resultado = ''
  for (const caractere of termo.replace(/\p{Cc}+/gu, ' ').trim()) {
    if (resultado.length + caractere.length > TAMANHO_MAXIMO_TERMO) break
    resultado += caractere
  }
  return resultado.trim()
}

type ContextoHistoricoBusca = {
  recentes: string[]
  registrar: (termo: string) => void
  limpar: () => void
}

const Contexto = createContext<ContextoHistoricoBusca | null>(null)

export function HistoricoBuscaProvider({ children }: { children: ReactNode }) {
  const { estado, salvadorDaColecao } = useEstadoCliente()
  const { valor: recentes, atualizar } = useEstadoPersistido(
    estado?.historicoBusca ?? HISTORICO_VAZIO,
    salvadorDaColecao('historicoBusca'),
    'Não foi possível salvar o histórico de busca',
  )

  function registrar(termo: string) {
    const normalizado = termoParaHistorico(termo)
    if (!estado || !normalizado) return
    atualizar((atuais) => [normalizado, ...atuais.map(termoParaHistorico)
      .filter((item) => item && item.toLowerCase() !== normalizado.toLowerCase())].slice(0, LIMITE_HISTORICO_BUSCA))
  }

  function limpar() {
    if (estado) atualizar(() => [])
  }

  return <Contexto.Provider value={{ recentes, registrar, limpar }}>{children}</Contexto.Provider>
}

export function useHistoricoBusca(): ContextoHistoricoBusca {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useHistoricoBusca precisa estar dentro de HistoricoBuscaProvider')
  return contexto
}
