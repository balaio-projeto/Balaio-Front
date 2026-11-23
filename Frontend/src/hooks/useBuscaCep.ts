'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cepCompleto, consultarViaCep, mensagemDaBuscaCep, type EnderecoPorCep, type SituacaoBuscaCep } from '@/utils/cep'

export function useBuscaCep(aoEncontrar: (endereco: EnderecoPorCep) => void) {
  const [situacao, definirSituacao] = useState<SituacaoBuscaCep>('ocioso')
  const ultimoCep = useRef<string | null>(null)
  const consultaAtual = useRef<AbortController | null>(null)
  const aoEncontrarAtual = useRef(aoEncontrar)

  useEffect(() => { aoEncontrarAtual.current = aoEncontrar }, [aoEncontrar])
  useEffect(() => () => consultaAtual.current?.abort(), [])

  const buscarCep = useCallback(async (valor: string) => {
    const cep = cepCompleto(valor)
    if (!cep) {
      consultaAtual.current?.abort()
      ultimoCep.current = null
      definirSituacao('ocioso')
      return
    }
    if (cep === ultimoCep.current) return
    ultimoCep.current = cep
    consultaAtual.current?.abort()
    const controle = new AbortController()
    consultaAtual.current = controle
    definirSituacao('carregando')
    const prazo = setTimeout(() => controle.abort(), 8000)
    const resultado = await consultarViaCep(cep, { signal: controle.signal })
    clearTimeout(prazo)
    if (consultaAtual.current !== controle) return
    consultaAtual.current = null
    if (resultado.situacao === 'encontrado') {
      aoEncontrarAtual.current(resultado.endereco)
      definirSituacao('encontrado')
      return
    }
    if (resultado.situacao === 'erro') ultimoCep.current = null
    definirSituacao(resultado.situacao === 'inexistente' ? 'inexistente' : resultado.situacao === 'invalido' ? 'ocioso' : 'erro')
  }, [])

  const esquecerCep = useCallback(() => {
    consultaAtual.current?.abort()
    consultaAtual.current = null
    ultimoCep.current = null
    definirSituacao('ocioso')
  }, [])

  return { situacao, mensagem: mensagemDaBuscaCep(situacao), carregando: situacao === 'carregando', buscarCep, esquecerCep }
}
