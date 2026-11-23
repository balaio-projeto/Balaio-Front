'use client'

import { useEffect, useState } from 'react'
import type { OpcaoFrete } from '@/types/dominio'
import { cotarFretes } from '@/services/api/pedidos.servico'
import { cepParaCotacao, chaveDaCotacao, itensDaChave } from '@/utils/frete'

type Cotacao = { chave: string; opcoes: OpcaoFrete[]; erro: string | null }

const PRAZO_COTACAO_MS = 10_000
const AVISO_COTACAO_DEMORADA = 'A cotação do frete demorou demais. Tente novamente.'

export function useCotacaoFrete(cep: string, itens: { slug: string; quantidade: number }[], ativo = true) {
  const cepValido = cepParaCotacao(cep)
  const chave = cepValido && itens.length ? chaveDaCotacao(cepValido, itens) : null
  const [cotacao, definirCotacao] = useState<Cotacao | null>(null)
  const [tentativa, definirTentativa] = useState(0)

  useEffect(() => {
    if (!ativo || !chave) return
    const controle = new AbortController()
    let prazoEsgotado = false
    const prazo = setTimeout(() => { prazoEsgotado = true; controle.abort() }, PRAZO_COTACAO_MS)
    const espera = setTimeout(() => {
      const { cep: destino, itens: volumes } = itensDaChave(chave)
      void cotarFretes(destino, volumes, controle.signal).then((resposta) => {
        if (controle.signal.aborted && !prazoEsgotado && !resposta.dados) return
        const erro = prazoEsgotado && !resposta.dados ? AVISO_COTACAO_DEMORADA : resposta.erro?.mensagem ?? null
        definirCotacao({ chave, opcoes: resposta.dados ?? [], erro })
      })
    }, 400)
    return () => { clearTimeout(espera); clearTimeout(prazo); controle.abort() }
  }, [chave, ativo, tentativa])

  const atual = cotacao && cotacao.chave === chave ? cotacao : null
  return {
    cepValido: Boolean(cepValido),
    consultando: Boolean(ativo && chave && !atual),
    opcoes: atual?.opcoes ?? [],
    erro: atual?.erro ?? null,
    tentarNovamente: () => { definirCotacao(null); definirTentativa((valor) => valor + 1) },
  }
}
