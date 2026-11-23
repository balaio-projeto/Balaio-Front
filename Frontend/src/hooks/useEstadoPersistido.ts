import { useEffect, useRef, useState } from 'react'
import { avisar } from '@/components/feedback/Avisos'
import { falha, type RespostaApi } from '@/services/api/tipos'

type Alteracao<T> = { valor: T; confirmado: T; versao: number }

export function useEstadoPersistido<T>(
  inicial: T,
  salvar: (valor: T) => Promise<RespostaApi<T>>,
  mensagemErro: string,
) {
  const [otimista, definirOtimista] = useState<{ valor: T } | null>(null)
  const [gravacoesPendentes, definirGravacoesPendentes] = useState(0)
  const alteracao = useRef<Alteracao<T> | null>(null)
  const fila = useRef<Promise<void>>(Promise.resolve())
  const ativo = useRef(true)

  useEffect(() => {
    ativo.current = true
    return () => { ativo.current = false }
  }, [])

  function atualizar(calcular: (atual: T) => T): T {
    if (!ativo.current) return alteracao.current?.valor ?? inicial
    const controle = alteracao.current ?? { valor: inicial, confirmado: inicial, versao: 0 }
    const proximo = calcular(controle.valor)
    if (Object.is(proximo, controle.valor)) return proximo

    controle.valor = proximo
    const versao = ++controle.versao
    alteracao.current = controle
    definirOtimista({ valor: proximo })

    function reverter(mensagem?: string) {
      if (!ativo.current || controle.versao !== versao) return
      controle.valor = controle.confirmado
      definirOtimista({ valor: controle.confirmado })
      avisar.erro(mensagemErro, mensagem)
    }

    // Cada PUT substitui a lista inteira; mantenha a ordem das intenções do usuário.
    definirGravacoesPendentes((n) => n + 1)
    fila.current = fila.current.then(async () => {
      if (!ativo.current) return
      try {
        const resposta = await salvar(proximo)
        if (!ativo.current) return
        if (resposta.erro || resposta.dados === null) {
          reverter(resposta.erro?.mensagem)
          return
        }
        controle.confirmado = resposta.dados
        if (controle.versao === versao) {
          controle.valor = resposta.dados
          definirOtimista({ valor: resposta.dados })
        }
      } catch {
        reverter('Tente novamente em instantes.')
      }
    }).finally(() => { if (ativo.current) definirGravacoesPendentes((n) => n - 1) })

    return proximo
  }

  async function substituirConfirmado(valor: T): Promise<RespostaApi<T>> {
    const operacao = fila.current.then(async (): Promise<RespostaApi<T>> => {
      if (!ativo.current) return falha('OPERACAO_INTERROMPIDA', 'A operação foi interrompida.')
      try {
        const resposta = await salvar(valor)
        if (!ativo.current || resposta.erro || resposta.dados === null) return resposta
        const controle = alteracao.current ?? { valor: inicial, confirmado: inicial, versao: 0 }
        controle.versao++
        controle.valor = resposta.dados
        controle.confirmado = resposta.dados
        alteracao.current = controle
        definirOtimista({ valor: resposta.dados })
        return resposta
      } catch {
        return falha('ERRO_REDE', 'Não foi possível falar com o servidor.')
      }
    })
    fila.current = operacao.then(() => {})
    return operacao
  }

  return { valor: otimista ? otimista.valor : inicial, atualizar, substituirConfirmado, sincronizando: gravacoesPendentes > 0 }
}
