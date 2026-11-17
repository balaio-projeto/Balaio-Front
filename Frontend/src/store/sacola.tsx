'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { obterSacola, salvarSacola } from '@/services/api/estado.servico'
import { obterPeca } from '@/services/api/pecas.servico'
import { useEstadoCliente } from '@/store/estadoCliente'
import { useSessao } from '@/store/sessao'
import { useEstadoPersistido } from '@/hooks/useEstadoPersistido'

export type ItemSacola = { slug: string; quantidade: number }
export type ResultadoAdicionar = 'adicionada' | 'ja-esta'
type ContextoSacola = {
  itens: ItemSacola[]; pronto: boolean; erro: string | null; aviso: string | null; conflito: boolean
  recarregar: () => void; removerParaMesclar: (slug: string) => void
  adicionar: (slug: string, unica?: boolean) => ResultadoAdicionar
  remover: (slug: string) => void; repor: (item: ItemSacola, posicao: number) => void
  alterarQuantidade: (slug: string, quantidade: number) => void; limpar: () => void
  limparConfirmado: () => Promise<{ ok: boolean; mensagem?: string }>
}

const Contexto = createContext<ContextoSacola | null>(null)
const CHAVE_VISITANTE = 'balaio:sacola:visitante:v1'
const CHAVE_MIGRADA = 'balaio:sacola:visitante:migrada:v1'
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

export async function mesclar(remotos: ItemSacola[], locais: ItemSacola[]): Promise<ItemSacola[]> {
  const unidos = validar([...remotos, ...locais])
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
  const { sessao } = useSessao()
  const { estado, pronto: estadoPronto, erro: estadoErro, recarregar: recarregarEstado } = useEstadoCliente()
  const estadoParaImportar = sessao ? null : estado
  const prontoParaImportar = sessao ? false : estadoPronto
  const erroParaImportar = sessao ? null : estadoErro
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
  const { valor: remoto, atualizar: atualizarRemoto, substituirConfirmado } = useEstadoPersistido(base, salvarSacola,
    'Não foi possível salvar a sacola')

  useEffect(() => {
    let ativo = true
    if (!sessao) {
      if (visitanteInicializado.current) return () => { ativo = false }
      const local = lerLocal()
      const marcador = lerChaveLocal(CHAVE_MIGRADA)
      if (memoriaVisitanteRef.current !== null) {
        const itens = memoriaVisitanteRef.current
        visitanteInicializado.current = true
        atual.current = itens
        definirBase(itens)
        if (!gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(itens))) definirAviso(AVISO_ARMAZENAMENTO)
        definirPronto(true)
        definirErro(null)
        return () => { ativo = false }
      }
      if (local.falhou || marcador.falhou) {
        if (!prontoParaImportar) return () => { ativo = false }
        const itens = validar(estadoParaImportar?.sacola)
        visitanteInicializado.current = true
        memoriaVisitanteRef.current = itens
        atual.current = itens
        definirBase(itens)
        definirAviso(AVISO_ARMAZENAMENTO)
        definirPronto(true)
        return () => { ativo = false }
      }
      if (local.itens === null && !marcador.valor && !prontoParaImportar)
        return () => { ativo = false }
      if (local.itens === null && !marcador.valor && erroParaImportar) {
        definirErro(erroParaImportar)
        definirPronto(true)
        return () => { ativo = false }
      }
      const itens = local.itens ?? (marcador.valor ? [] : validar(estadoParaImportar?.sacola))
      if (local.itens === null) {
        if (!gravarChaveLocal(CHAVE_VISITANTE, JSON.stringify(itens))
            || !gravarChaveLocal(CHAVE_MIGRADA, '1')) definirAviso(AVISO_ARMAZENAMENTO)
      }
      visitanteInicializado.current = true
      memoriaVisitanteRef.current = itens
      atual.current = itens
      definirBase(itens)
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
          if (!gravarChaveLocal(CHAVE_MIGRADA, '1')) definirAviso(AVISO_ARMAZENAMENTO)
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
        if (!gravarChaveLocal(CHAVE_VISITANTE, null)
            || !gravarChaveLocal(CHAVE_MIGRADA, '1')) definirAviso(AVISO_ARMAZENAMENTO)
        memoriaVisitanteRef.current = []
      }
      definirErro(null)
      definirConflito(false)
      definirPronto(true)
    })()
    return () => { ativo = false }
  }, [sessao, prontoParaImportar, erroParaImportar, estadoParaImportar, tentativa, memoriaVisitanteRef])

  function recarregar() {
    definirPronto(false)
    definirErro(null)
    if (!sessao && lerLocal().itens === null) recarregarEstado()
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
      const existente = itens.find((item) => item.slug === slug)
      if (!existente) return [...itens, { slug, quantidade: 1 }]
      if (unica || existente.quantidade >= 3) {
        resultado = 'ja-esta'
        return itens
      }
      return itens.map((item) => item.slug === slug ? { ...item, quantidade: item.quantidade + 1 } : item)
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
  async function limparConfirmado(): Promise<{ ok: boolean; mensagem?: string }> {
    if (!pronto || erro) return { ok: false, mensagem: erro ?? 'A sacola ainda não está pronta.' }
    if (!sessao) {
      const salvo = gravarChaveLocal(CHAVE_VISITANTE, '[]')
      if (!salvo) {
        definirAviso(AVISO_ARMAZENAMENTO)
        return { ok: false, mensagem: 'Não foi possível confirmar a limpeza da sacola neste dispositivo.' }
      }
      atual.current = []
      memoriaVisitanteRef.current = []
      definirBase([])
      definirAviso(null)
      return { ok: true }
    }
    const resposta = await substituirConfirmado([])
    if (resposta.erro || resposta.dados === null)
      return { ok: false, mensagem: resposta.erro?.mensagem ?? 'Não foi possível limpar a sacola da conta.' }
    atual.current = []
    definirBase([])
    return { ok: true }
  }

  return <Contexto.Provider value={{
    itens: sessao && !conflito ? remoto : base, pronto, erro, aviso, conflito, recarregar,
    removerParaMesclar, adicionar, remover, repor, alterarQuantidade, limpar, limparConfirmado,
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
