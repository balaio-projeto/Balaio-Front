'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, use, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { IconeBusca, IconeRelogio, IconeUsuario } from '@/components/ui/Icones'
import type { SugestaoBusca } from '@/components/layout/sugestoesBusca'
import { useHistoricoBusca } from '@/store/historicoBusca'

const LIMITE_SUGESTOES = 8
const LIMITE_TERMO = 80

const normalizarTermo = (valor: string) =>
  valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const hrefDaBusca = (termo: string) => `/search?q=${encodeURIComponent(termo)}`

type Props = { sugestoes?: Promise<SugestaoBusca[]> }

export default function BuscaCabecalho({ sugestoes }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const roteador = useRouter()
  const parametros = useSearchParams()
  const [consulta, definirConsulta] = useState('')
  const { recentes, registrar, limpar } = useHistoricoBusca()
  const [aberto, definirAberto] = useState(false)

  useEffect(() => {
    definirConsulta(parametros.get('q') ?? '')
  }, [parametros])

  useEffect(() => {
    function fecharAoClicarFora(evento: PointerEvent) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) definirAberto(false)
    }

    document.addEventListener('pointerdown', fecharAoClicarFora)
    return () => document.removeEventListener('pointerdown', fecharAoClicarFora)
  }, [])

  const consultaLimpa = consulta.trim()
  const mostrarHistorico = !consultaLimpa
  const mostrarPainel = aberto && (mostrarHistorico ? recentes.length > 0 : true)

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const termo = consultaLimpa.slice(0, LIMITE_TERMO)
    definirAberto(false)
    if (!termo) {
      roteador.push('/search')
      return
    }
    registrar(termo)
    roteador.push(hrefDaBusca(termo))
  }

  function selecionarBusca(termo: string) {
    registrar(termo)
    definirAberto(false)
  }

  return (
    <div ref={raiz} className="cabecalho-busca">
      <form action="/search" role="search" onSubmit={buscar}>
        <button type="submit" className="cabecalho-busca-botao" aria-label="Buscar">
          <IconeBusca />
        </button>
        <label className="so-leitor" htmlFor="busca-topo">Buscar peças</label>
        <input
          id="busca-topo"
          name="q"
          type="search"
          value={consulta}
          placeholder="Buscar técnica, artesão, território..."
          autoComplete="off"
          onChange={(evento) => {
            definirConsulta(evento.currentTarget.value)
            definirAberto(true)
          }}
          onFocus={() => definirAberto(true)}
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') {
              definirAberto(false)
              evento.currentTarget.blur()
            }
          }}
        />
      </form>

      {mostrarPainel && (
        <div className="cabecalho-busca-painel" role="region" aria-label={mostrarHistorico ? 'Buscas recentes' : 'Sugestões de busca'}>
          {mostrarHistorico ? (
            <>
              <div className="cabecalho-busca-cabecalho">
                <span>Buscas recentes</span>
                <button type="button" onClick={limpar}>Limpar histórico</button>
              </div>
              <ul>
                {recentes.map((termo) => (
                  <li key={termo}>
                    <Link href={hrefDaBusca(termo)} onClick={() => selecionarBusca(termo)}>
                      <IconeRelogio tamanho={15} />
                      <span>{termo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="cabecalho-busca-cabecalho"><span>Sugestões</span></div>
              {sugestoes ? (
                <Suspense fallback={<p>Carregando sugestões…</p>}>
                  <ListaSugestoes
                    sugestoes={sugestoes}
                    consulta={consultaLimpa}
                    aoEscolherTermo={selecionarBusca}
                    aoAbrirPerfil={() => definirAberto(false)}
                  />
                </Suspense>
              ) : (
                <SemSugestoes consulta={consultaLimpa} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

type PropsLista = {
  sugestoes: Promise<SugestaoBusca[]>
  consulta: string
  aoEscolherTermo: (termo: string) => void
  aoAbrirPerfil: () => void
}

function ListaSugestoes({ sugestoes, consulta, aoEscolherTermo, aoAbrirPerfil }: PropsLista) {
  const todas = use(sugestoes)
  const termoNormalizado = normalizarTermo(consulta)
  const visiveis = useMemo(
    () => todas.filter((sugestao) => normalizarTermo(sugestao.texto).includes(termoNormalizado)).slice(0, LIMITE_SUGESTOES),
    [todas, termoNormalizado],
  )

  if (visiveis.length === 0) return <SemSugestoes consulta={consulta} />

  return (
    <ul>
      {visiveis.map((sugestao) => (
        <li key={sugestao.href}>
          <Link
            href={sugestao.href}
            onClick={() => (sugestao.perfilDeArtesao ? aoAbrirPerfil() : aoEscolherTermo(sugestao.texto))}
          >
            {sugestao.perfilDeArtesao ? <IconeUsuario tamanho={15} /> : <IconeBusca tamanho={15} />}
            <span>{sugestao.texto}</span>
            {sugestao.perfilDeArtesao && <span className="so-leitor"> (perfil do artesão)</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function SemSugestoes({ consulta }: { consulta: string }) {
  return <p>Nenhuma sugestão. Pressione Enter para buscar por “{consulta}”.</p>
}
