import { useEffect, useRef, useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import type { Colecao } from '@/services/api/estado.servico'
import { useEstadoCliente } from '@/store/estadoCliente'

export function useItemDaColecao(colecao: Colecao, item: string, mensagemErro: string) {
  const { estado, pronto, alternarNaColecao, curtidosNoCarregamento } = useEstadoCliente()
  const [otimista, definirOtimista] = useState<boolean | null>(null)
  const emAndamento = useRef(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  const ativo = otimista ?? (estado?.[colecao].includes(item) ?? false)

  async function alternar(): Promise<boolean | null> {
    if (!pronto || !estado || emAndamento.current) return null
    emAndamento.current = true
    const proximo = !ativo
    definirOtimista(proximo)
    try {
      const resposta = await alternarNaColecao(colecao, item, proximo)
      if (!montado.current) return null
      if (resposta.erro || !resposta.dados) {
        definirOtimista(null)
        avisar.erro(mensagemErro, resposta.erro?.mensagem)
        return null
      }
      definirOtimista(null)
      return proximo
    } catch {
      if (montado.current) {
        definirOtimista(null)
        avisar.erro(mensagemErro, 'Tente novamente.')
      }
      return null
    } finally {
      emAndamento.current = false
    }
  }

  const contadoNoServidor = colecao === 'videosCurtidos' && curtidosNoCarregamento.includes(item)
  return { ativo, alternar, contadoNoServidor, disponivel: pronto && Boolean(estado) }
}
