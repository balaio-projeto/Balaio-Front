'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { rotaDeLogin, sessaoAtualizadaDoUsuario, type Sessao } from '@/services/sessao/cookie'
import { EVENTO_SESSAO_RECUSADA } from '@/services/api/cliente'

type ContextoSessao = {
  sessao: Sessao | null
  iniciarSessao: (sessao: Sessao) => void
  encerrarSessao: () => void
}

const Contexto = createContext<ContextoSessao>({ sessao: null, iniciarSessao: () => {}, encerrarSessao: () => {} })
const CANAL_DE_SESSAO = 'balaio-sessao'

type AvisoDeSessao = { contaId: string | null; abaDeOrigem: string }

const ESTA_ABA = Math.random().toString(36).slice(2)

function abrirCanalDeSessao(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CANAL_DE_SESSAO) }
  catch { return null }
}

function avisarOutrasAbas(contaId: string | null) {
  const canal = abrirCanalDeSessao()
  if (!canal) return
  canal.postMessage({ contaId, abaDeOrigem: ESTA_ABA } satisfies AvisoDeSessao)
  canal.close()
}

export function SessaoProvider({ inicial, children }: { inicial: Sessao | null; children: ReactNode }) {
  const [sessao, definirSessao] = useState<Sessao | null>(inicial)

  const iniciarSessao = useCallback((nova: Sessao) => {
    definirSessao(nova)
    avisarOutrasAbas(nova.id)
  }, [])

  const encerrarSessao = useCallback(() => {
    document.cookie = 'balaio-sessao=; path=/; max-age=0; samesite=lax'
    definirSessao(null)
    avisarOutrasAbas(null)
  }, [])

  const contaAtual = sessao?.id ?? null
  useEffect(() => {
    const canal = abrirCanalDeSessao()
    if (!canal) return
    canal.onmessage = (evento: MessageEvent<AvisoDeSessao>) => {
      if (evento.data?.abaDeOrigem === ESTA_ABA) return
      if ((evento.data?.contaId ?? null) !== contaAtual) window.location.reload()
    }
    return () => canal.close()
  }, [contaAtual])

  useEffect(() => {
    if (!sessao) return
    const aoRecusarSessao = () => {
      encerrarSessao()
      window.location.assign(rotaDeLogin(`${window.location.pathname}${window.location.search}`))
    }
    window.addEventListener(EVENTO_SESSAO_RECUSADA, aoRecusarSessao)
    return () => window.removeEventListener(EVENTO_SESSAO_RECUSADA, aoRecusarSessao)
  }, [sessao, encerrarSessao])

  useEffect(() => {
    if (!sessao) return
    const conferir = async () => {
      try {
        const resposta = await fetch('/api/v1/usuario', { cache: 'no-store' })
        if (resposta.status === 401) {
          encerrarSessao()
          return
        }
        if (!resposta.ok) return
        // Papel persistido: a claim do JWT atual só muda após novo login; a UI usa o valor do servidor.
        const corpo = await resposta.json().catch(() => null)
        const contaNoServidor = corpo?.dados?.id
        if (typeof contaNoServidor === 'string' && contaNoServidor !== sessao.id) {
          window.location.reload()
          return
        }
        const atualizada = sessaoAtualizadaDoUsuario(sessao, corpo?.dados)
        if (atualizada && atualizada.papel !== sessao.papel) definirSessao(atualizada)
      } catch { /* A próxima navegação tenta novamente. */ }
    }
    const conferirAoVoltar = () => { if (document.visibilityState === 'visible') void conferir() }
    void conferir()
    window.addEventListener('focus', conferir)
    document.addEventListener('visibilitychange', conferirAoVoltar)
    return () => {
      window.removeEventListener('focus', conferir)
      document.removeEventListener('visibilitychange', conferirAoVoltar)
    }
  }, [sessao, encerrarSessao])

  const valor = useMemo(() => ({ sessao, iniciarSessao, encerrarSessao }), [sessao, iniciarSessao, encerrarSessao])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useSessao = () => useContext(Contexto)
