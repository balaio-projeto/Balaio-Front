'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  COLECOES, alterarColecao as alterarColecaoRemota, obterColecao, salvarColecao as salvarColecaoRemota,
  type Colecao, type ColecoesDoUsuario, type EstadoCliente,
} from '@/services/api/estado.servico'
import { falha, sucesso, type RespostaApi } from '@/services/api/tipos'
import { useSessao } from '@/store/sessao'
import {
  colecoesVazias, esquecerColecoesVisitante, gravarColecaoVisitante,
  lerColecoesVisitante, mesclarColecao, normalizarColecoes,
} from '@/store/colecoesVisitante'

type SalvarItens = (itens: string[]) => Promise<RespostaApi<string[]>>

type ContextoEstadoCliente = {
  estado: EstadoCliente | null
  pronto: boolean
  erro: string | null
  curtidosNoCarregamento: string[]
  recarregar: () => void
  salvadorDaColecao: (colecao: Colecao) => SalvarItens
  alternarNaColecao: (colecao: Colecao, item: string, incluir: boolean) => Promise<RespostaApi<string[]>>
}

type Leitura = Pick<ContextoEstadoCliente, 'estado' | 'pronto' | 'erro' | 'curtidosNoCarregamento'>

const Contexto = createContext<ContextoEstadoCliente | null>(null)
const LEITURA_INICIAL: Leitura = { estado: null, pronto: false, erro: null, curtidosNoCarregamento: [] }
const ERRO_ARMAZENAMENTO = 'Não foi possível guardar neste dispositivo.'

async function carregarColecoesDaConta(): Promise<RespostaApi<ColecoesDoUsuario>> {
  const respostas = await Promise.all(COLECOES.map(obterColecao))
  const problema = respostas.find((resposta) => resposta.erro || !resposta.dados)
  if (problema) return falha(problema.erro?.codigo ?? 'RESPOSTA_INVALIDA', problema.erro?.mensagem ?? 'Não foi possível carregar seus dados.')
  const remotas = normalizarColecoes(Object.fromEntries(COLECOES.map((colecao, indice) => [colecao, respostas[indice].dados])))
  return sucesso(await migrarColecoesDoVisitante(remotas))
}

async function migrarColecoesDoVisitante(remotas: ColecoesDoUsuario): Promise<ColecoesDoUsuario> {
  const locais = lerColecoesVisitante()
  if (!locais) return remotas
  const mescladas = { ...remotas }
  let todasMigradas = true
  for (const colecao of COLECOES) {
    if (locais[colecao].length === 0) continue
    const unidas = mesclarColecao(colecao, remotas[colecao], locais[colecao])
    if (unidas.length === remotas[colecao].length && unidas.every((item, indice) => item === remotas[colecao][indice])) continue
    const salva = await salvarColecaoRemota(colecao, unidas)
    if (salva.dados) mescladas[colecao] = salva.dados
    else todasMigradas = false
  }
  if (todasMigradas) esquecerColecoesVisitante()
  return mescladas
}

function alternarNoVisitante(colecao: Colecao, item: string, incluir: boolean): RespostaApi<string[]> {
  const atuais = (lerColecoesVisitante() ?? colecoesVazias())[colecao]
  const proximos = incluir ? [...new Set([...atuais, item])] : atuais.filter((atual) => atual !== item)
  return gravarColecaoVisitante(colecao, proximos) ? sucesso(proximos) : falha('ARMAZENAMENTO_INDISPONIVEL', ERRO_ARMAZENAMENTO)
}

function estadoDoVisitante(): EstadoCliente {
  return { ...(lerColecoesVisitante() ?? colecoesVazias()), id: 'visitante' }
}

export function EstadoClienteProvider({ children }: { children: ReactNode }) {
  const { sessao } = useSessao()
  const usuarioId = sessao?.id ?? null
  const [leitura, definirLeitura] = useState<Leitura>(LEITURA_INICIAL)
  const [tentativa, definirTentativa] = useState(0)
  const filas = useRef(new Map<Colecao, Promise<unknown>>())

  useEffect(() => {
    let ativo = true
    void (async () => {
      if (usuarioId) {
        const { dados, erro } = await carregarColecoesDaConta()
        if (!ativo) return
        definirLeitura(dados
          ? { estado: { ...dados, id: usuarioId }, pronto: true, erro: null, curtidosNoCarregamento: dados.videosCurtidos }
          : { ...LEITURA_INICIAL, pronto: true, erro: erro?.mensagem ?? 'Não foi possível carregar seus dados.' })
        return
      }
      if (ativo) definirLeitura({ estado: estadoDoVisitante(), pronto: true, erro: null, curtidosNoCarregamento: [] })
    })()
    return () => { ativo = false }
  }, [usuarioId, tentativa])

  function recarregar() {
    definirLeitura(LEITURA_INICIAL)
    definirTentativa((atual) => atual + 1)
  }

  const atualizarEstado = useCallback((alteracoes: Partial<EstadoCliente>) => {
    definirLeitura((atual) => atual.estado ? { ...atual, estado: { ...atual.estado, ...alteracoes } } : atual)
  }, [])

  const salvadorDaColecao = useCallback((colecao: Colecao): SalvarItens => async (itens) => {
    if (usuarioId) return salvarColecaoRemota(colecao, itens)
    return gravarColecaoVisitante(colecao, itens) ? sucesso(itens) : falha('ARMAZENAMENTO_INDISPONIVEL', ERRO_ARMAZENAMENTO)
  }, [usuarioId])

  const alternarNaColecao = useCallback((colecao: Colecao, item: string, incluir: boolean) => {
    const operacao = (filas.current.get(colecao) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const salva = usuarioId
        ? await alterarColecaoRemota(colecao, incluir ? { adicionar: [item] } : { remover: [item] })
        : alternarNoVisitante(colecao, item, incluir)
      if (salva.dados) atualizarEstado({ [colecao]: salva.dados })
      return salva
    })
    filas.current.set(colecao, operacao)
    void operacao.finally(() => {
      if (filas.current.get(colecao) === operacao) filas.current.delete(colecao)
    })
    return operacao
  }, [usuarioId, atualizarEstado])

  return (
    <Contexto.Provider value={{ ...leitura, recarregar, salvadorDaColecao, alternarNaColecao }}>
      {children}
    </Contexto.Provider>
  )
}

export function useEstadoCliente(): ContextoEstadoCliente {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useEstadoCliente precisa estar dentro de EstadoClienteProvider')
  return contexto
}
