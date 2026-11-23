'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { obterSacola, revalidarSacola, salvarSacola, type RevalidacaoSacola } from '@/services/api/estado.servico'
import { obterPeca } from '@/services/api/pecas.servico'
import { useSessao } from '@/store/sessao'
import { useEstadoPersistido } from '@/hooks/useEstadoPersistido'

export type ItemSacola = { slug: string; quantidade: number }
export type ResultadoAdicionar = 'adicionada' | 'ja-esta' | 'limite'
export type ResultadoConfirmado = { ok: boolean; mensagem?: string }
type ContextoSacola = {
  itens: ItemSacola[]; pronto: boolean; erro: string | null; aviso: string | null; conflito: boolean; sincronizando: boolean
  recarregar: () => void; removerParaMesclar: (slug: string) => void
  adicionar: (slug: string, unica?: boolean) => ResultadoAdicionar
  remover: (slug: string) => void; repor: (item: ItemSacola, posicao: number) => void
  alterarQuantidade: (slug: string, quantidade: number) => void; limpar: () => void
  removerConfirmado: (slugs: readonly string[]) => Promise<ResultadoConfirmado>
}

export const LIMITE_PECAS_DISTINTAS = 20
export const MENSAGEM_LIMITE_PECAS = 'A sacola aceita até 20 peças diferentes.'

const Contexto = createContext<ContextoSacola | null>(null)
const CHAVE_VISITANTE = 'balaio:sacola:visitante:v1'
const SACOLA_VAZIA: ItemSacola[] = []
const AVISO_ARMAZENAMENTO = 'Não foi possível salvar a sacola neste dispositivo. Ela ficará disponível apenas enquanto esta página estiver aberta.'

export function validar(valor: unknown): ItemSacola[] {
  if (!Array.isArray(valor)) return []
  const itens = new Map<string, number>()
  for (const item of valor) {
    if (!item || typeof item.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
        || !Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 3) continue
    itens.set(item.slug, Math.min(3, (itens.get(item.slug) ?? 0) + item.quantidade))
  }
  return [...itens].map(([slug, quantidade]) => ({ slug, quantidade }))
}

export function lerChaveLocal(chave: string): { valor: string | null; falhou: boolean } {
  try { return { valor: localStorage.getItem(chave), falhou: false } }
  catch { return { valor: null, falhou: true } }
}

export function gravarChaveLocal(chave: string, valor: string | null): boolean {
  try {
    if (valor === null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
    return true
  } catch { return false }
}

function lerLocal(): { itens: ItemSacola[] | null; falhou: boolean } {
  const leitura = lerChaveLocal(CHAVE_VISITANTE)
  if (leitura.falhou || leitura.valor === null) return { itens: null, falhou: leitura.falhou }
  try { return { itens: validar(JSON.parse(leitura.valor)), falhou: false } }
  catch { return { itens: [], falhou: false } }
}

export function incluirItem(itens: ItemSacola[], slug: string, unica = false): { itens: ItemSacola[]; resultado: ResultadoAdicionar } {
  const existente = itens.find((item) => item.slug === slug)
  if (!existente) {
    if (itens.length >= LIMITE_PECAS_DISTINTAS) return { itens, resultado: 'limite' }
    return { itens: [...itens, { slug, quantidade: 1 }], resultado: 'adicionada' }
  }
  if (unica || existente.quantidade >= 3) return { itens, resultado: 'ja-esta' }
  return {
    itens: itens.map((item) => item.slug === slug ? { ...item, quantidade: item.quantidade + 1 } : item),
    resultado: 'adicionada',
  }
}

export function semItens(itens: ItemSacola[], slugs: readonly string[]): ItemSacola[] {
  const retirados = new Set(slugs)
  return itens.filter((item) => !retirados.has(item.slug))
}

export async function mesclar(remotos: ItemSacola[], locais: ItemSacola[]): Promise<ItemSacola[]> {
  const unidos = validar([...remotos, ...locais])
  if (unidos.length > LIMITE_PECAS_DISTINTAS) throw new Error(MENSAGEM_LIMITE_PECAS)
  const disponibilidade = await Promise.all(unidos.map(async (item) => {
    const resposta = await obterPeca(item.slug)
    if (resposta.erro || !resposta.dados) throw new Error(resposta.erro?.mensagem ?? 'Peça indisponível.')
    return resposta.dados.disponibilidade
  }))
  return unidos.map((item, indice) => ({
    ...item, quantidade: disponibilidade[indice] === 'unica' ? 1 : item.quantidade,
  }))
}

export function SacolaProvider({ children, memoriaVisitanteRef }: {
  children: ReactNode; memoriaVisitanteRef: RefObject<ItemSacola[] | null>
}) {
  const { sessao: sessaoAtual } = useSessao()
  const sessao = sessaoAtual?.papel === 'comprador' ? sessaoAtual : null
  const [base, definirBase] = useState<ItemSacola[]>(SACOLA_VAZIA)
  const [pronto, definirPronto] = useState(false)
  const [erro, definirErro] = useState<string | null>(null)
  const [aviso, definirAviso] = useState<string | null>(null)
  const [conflito, definirConflito] = useState(false)
  const [tentativa, definirTentativa] = useState(0)
  const atual = useRef<ItemSacola[]>(SACOLA_VAZIA)
  const visitanteInicializado = useRef(false)
  const locaisPendentes = useRef<ItemSacola[] | null>(null)
  const ignorados = useRef(new Set<string>())
  const { valor: remoto, atualizar: atualizarRemoto, substituirConfirmado, sincronizando } = useEstadoPersistido(base, salvarSacola,
    'Não foi possível salvar a sacola')

  useEffect(() => {
    let ativo = true
    if (!sessao) {
      if (visitanteInicializado.current) return () => { ativo = false }
      const local = lerLocal()
      const itens = memoriaVisitanteRef.current ?? local.itens ?? []
      visitanteInicializado.current = true
      memoriaVisitanteRef.current = itens
      atual.current = itens
      definirBase(itens)
      if (local.falhou || !gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(itens))) definirAviso(AVISO_ARMAZENAMENTO)
      definirPronto(true)
      definirErro(null)
      return () => { ativo = false }
    }
    void (async () => {
      const resposta = await obterSacola()
      if (!ativo) return
      if (resposta.erro || !resposta.dados) {
        definirErro(resposta.erro?.mensagem ?? 'Não foi possível carregar a sacola.')
        definirConflito(false)
        definirPronto(true)
        return
      }
      const remotos = validar(resposta.dados).filter((item) => !ignorados.current.has(item.slug))
      const leituraLocal = lerLocal()
      const locais = (locaisPendentes.current ?? memoriaVisitanteRef.current ?? leituraLocal.itens ?? [])
        .filter((item) => !ignorados.current.has(item.slug))
      locaisPendentes.current = locais
      if (leituraLocal.falhou) definirAviso(AVISO_ARMAZENAMENTO)
      atual.current = remotos
      definirBase(remotos)
      if (locais.length || ignorados.current.size) {
        try {
          const unidos = await mesclar(remotos, locais)
          const salva = await salvarSacola(unidos)
          if (!ativo) return
          if (salva.erro || !salva.dados) throw new Error(salva.erro?.mensagem ?? 'Não foi possível mesclar a sacola.')
          if (leituraLocal.itens !== null && !gravarChaveLocal(CHAVE_VISITANTE, null))
            definirAviso(AVISO_ARMAZENAMENTO)
          memoriaVisitanteRef.current = []
          locaisPendentes.current = null
          ignorados.current.clear()
          atual.current = salva.dados
          definirBase(salva.dados)
        } catch (falha) {
          if (!ativo) return
          definirBase(validar([...remotos, ...locais]))
          definirErro(falha instanceof Error ? falha.message : 'Não foi possível mesclar a sacola.')
          definirConflito(true)
          definirPronto(true)
          return
        }
      } else if (leituraLocal.itens !== null) {
        if (!gravarChaveLocal(CHAVE_VISITANTE, null)) definirAviso(AVISO_ARMAZENAMENTO)
        memoriaVisitanteRef.current = []
      }
      definirErro(null)
      definirConflito(false)
      definirPronto(true)
    })()
    return () => { ativo = false }
  }, [sessao, tentativa, memoriaVisitanteRef])

  function recarregar() {
    definirPronto(false)
    definirErro(null)
    definirTentativa((n) => n + 1)
  }
  function removerParaMesclar(slug: string) {
    if (!conflito) return
    ignorados.current.add(slug)
    const restantes = (locaisPendentes.current ?? []).filter((item) => item.slug !== slug)
    locaisPendentes.current = restantes
    memoriaVisitanteRef.current = restantes
    if (!gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(restantes))) definirAviso(AVISO_ARMAZENAMENTO)
    definirBase((itens) => itens.filter((item) => item.slug !== slug))
    recarregar()
  }
  function atualizar(calcular: (itens: ItemSacola[]) => ItemSacola[]) {
    if (!pronto || erro) return atual.current
    if (sessao) return atualizarRemoto(calcular)
    const proximos = calcular(atual.current)
    atual.current = proximos
    memoriaVisitanteRef.current = proximos
    definirBase(proximos)
    definirAviso(gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(proximos)) ? null : AVISO_ARMAZENAMENTO)
    return proximos
  }
  function adicionar(slug: string, unica = false): ResultadoAdicionar {
    let resultado: ResultadoAdicionar = 'adicionada'
    atualizar((itens) => {
      const inclusao = incluirItem(itens, slug, unica)
      resultado = inclusao.resultado
      return inclusao.itens
    })
    return resultado
  }
  function remover(slug: string) { atualizar((itens) => itens.filter((item) => item.slug !== slug)) }
  function repor(item: ItemSacola, posicao: number) {
    atualizar((itens) => {
      const proximos = itens.filter((i) => i.slug !== item.slug)
      proximos.splice(Math.min(posicao, proximos.length), 0, item)
      return proximos
    })
  }
  function alterarQuantidade(slug: string, quantidade: number) {
    atualizar((itens) => itens.map((item) => item.slug === slug ? { ...item, quantidade } : item))
  }
  function limpar() { atualizar(() => []) }
  async function removerConfirmado(slugs: readonly string[]): Promise<ResultadoConfirmado> {
    if (!pronto || erro) return { ok: false, mensagem: erro ?? 'A sacola ainda não está pronta.' }
    if (!sessao) {
      const restantes = semItens(atual.current, slugs)
      if (!gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(restantes))) {
        definirAviso(AVISO_ARMAZENAMENTO)
        return { ok: false, mensagem: 'Não foi possível confirmar a retirada das peças pagas neste dispositivo.' }
      }
      atual.current = restantes
      memoriaVisitanteRef.current = restantes
      definirBase(restantes)
      definirAviso(null)
      return { ok: true }
    }
    let resposta = await substituirConfirmado(semItens(remoto, slugs))
    if (resposta.erro?.codigo === 'PECA_INDISPONIVEL') {
      const revalidacao = await revalidarSacola()
      const indisponiveis = (revalidacao.dados?.itens ?? [])
        .filter((item) => item.situacao === 'indisponivel').map((item) => item.slug)
      if (indisponiveis.length) resposta = await substituirConfirmado(semItens(remoto, [...slugs, ...indisponiveis]))
    }
    if (resposta.erro || resposta.dados === null)
      return { ok: false, mensagem: resposta.erro?.mensagem ?? 'Não foi possível retirar as peças pagas da sacola da conta.' }
    atual.current = resposta.dados
    definirBase(resposta.dados)
    return { ok: true }
  }

  return <Contexto.Provider value={{
    itens: sessao && !conflito ? remoto : base, pronto, erro, aviso, conflito, sincronizando: Boolean(sessao) && sincronizando, recarregar,
    removerParaMesclar, adicionar, remover, repor, alterarQuantidade, limpar, removerConfirmado,
  }}>{children}</Contexto.Provider>
}

export function useSacola(): ContextoSacola {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSacola precisa estar dentro de SacolaProvider')
  return contexto
}

export function useTotalSacola(): { total: number; pronto: boolean } {
  const { itens, pronto } = useSacola()
  return { total: itens.reduce((soma, item) => soma + item.quantidade, 0), pronto }
}

export function recortarRevalidacao(dados: RevalidacaoSacola, slugs?: readonly string[]): RevalidacaoSacola {
  if (!slugs) return dados
  const incluidos = new Set(slugs)
  const itens = dados.itens.filter((item) => incluidos.has(item.slug))
  return { ...dados, itens, podeProsseguir: itens.length > 0 && itens.every((item) => item.situacao === 'disponivel') }
}

export function useRevalidacaoSacola(itens: ItemSacola[], habilitada: boolean, recorte?: readonly string[]) {
  const assinatura = JSON.stringify([...itens].sort((a, b) => a.slug.localeCompare(b.slug)))
  const [estado, definirEstado] = useState<{
    assinatura: string; dados: RevalidacaoSacola | null; erro: string | null; consultando: boolean
  }>({ assinatura: '', dados: null, erro: null, consultando: false })
  const versaoRef = useRef(0)

  const revalidar = useCallback(async (): Promise<RevalidacaoSacola | null> => {
    if (!habilitada || itens.length === 0) return null
    const versao = ++versaoRef.current
    definirEstado((atual) => ({ ...atual, assinatura, erro: null, consultando: true }))
    const resposta = await revalidarSacola()
    if (versao !== versaoRef.current) return null
    const recebidos = resposta.dados?.itens
    const assinaturaRemota = Array.isArray(recebidos)
      ? JSON.stringify(recebidos.map(({ slug, quantidade }) => ({ slug, quantidade }))
        .sort((a, b) => a.slug.localeCompare(b.slug))) : ''
    if (resposta.erro || !resposta.dados || assinaturaRemota !== assinatura) {
      definirEstado((atual) => ({ ...atual, assinatura, consultando: false,
        erro: resposta.erro?.mensagem ?? 'A sacola mudou durante a consulta. Tente novamente.' }))
      return null
    }
    definirEstado({ assinatura, dados: resposta.dados, erro: null, consultando: false })
    return resposta.dados
  }, [assinatura, habilitada, itens.length])

  useEffect(() => {
    if (!habilitada || itens.length === 0) return
    const controle = versaoRef
    void revalidar()
    return () => { controle.current++ }
  }, [habilitada, assinatura, itens.length, revalidar])

  async function revalidarRecorte(): Promise<RevalidacaoSacola | null> {
    const atual = await revalidar()
    return atual && recortarRevalidacao(atual, recorte)
  }

  return { dados: estado.dados && recortarRevalidacao(estado.dados, recorte),
    valido: habilitada && estado.assinatura === assinatura && !estado.erro && !estado.consultando,
    erro: estado.assinatura === assinatura ? estado.erro : null,
    consultando: estado.assinatura !== assinatura || estado.consultando, revalidar: revalidarRecorte }
}
