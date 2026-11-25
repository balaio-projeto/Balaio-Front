'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { IconeSino } from '@/components/ui/Icones'
import { useSessao } from '@/store/sessao'
import {
  listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas,
  type CaixaNotificacoes, type Notificacao,
} from '@/services/api/notificacoes.servico'
import { tempoRelativo } from '@/utils/tempoRelativo'

const INTERVALO_ATUALIZACAO_MS = 60_000

export default function SinoNotificacoes() {
  const { sessao } = useSessao()
  const router = useRouter()
  const [caixa, definirCaixa] = useState<CaixaNotificacoes | null>(null)
  const [aberto, definirAberto] = useState(false)
  const [falhou, definirFalhou] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)
  const idPainel = useId()
  const idTitulo = useId()
  const logado = Boolean(sessao)

  const atualizar = useCallback(async () => {
    const { dados } = await listarNotificacoes()
    definirFalhou(!dados)
    if (dados) definirCaixa(dados)
  }, [])

  useEffect(() => {
    if (!logado) {
      definirCaixa(null)
      return
    }
    void atualizar()
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void atualizar()
    }, INTERVALO_ATUALIZACAO_MS)
    const aoFocar = () => void atualizar()
    window.addEventListener('focus', aoFocar)
    return () => {
      window.clearInterval(intervalo)
      window.removeEventListener('focus', aoFocar)
    }
  }, [logado, atualizar])

  useEffect(() => {
    if (!aberto) return
    void atualizar()
    function fecharSeClicarFora(evento: PointerEvent) {
      if (!area.current?.contains(evento.target as Node)) definirAberto(false)
    }
    document.addEventListener('pointerdown', fecharSeClicarFora)
    return () => document.removeEventListener('pointerdown', fecharSeClicarFora)
  }, [aberto, atualizar])

  if (!logado) return null

  const naoLidas = caixa?.naoLidas ?? 0
  const rotulo = naoLidas > 0 ? `Notificações, ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Notificações'

  function fecharComEsc(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Escape' || !aberto) return
    definirAberto(false)
    gatilho.current?.focus()
  }

  async function lerTodas() {
    const { dados } = await marcarTodasLidas()
    if (dados) definirCaixa(dados)
  }

  async function abrir(notificacao: Notificacao) {
    definirAberto(false)
    if (!notificacao.lida) {
      definirCaixa((atual) => atual && {
        naoLidas: Math.max(0, atual.naoLidas - 1),
        itens: atual.itens.map((item) => item.id === notificacao.id ? { ...item, lida: true } : item),
      })
      void marcarNotificacaoLida(notificacao.id)
    }
    if (notificacao.link) router.push(notificacao.link)
  }

  return (
    <div className="notificacoes" ref={area} onKeyDown={fecharComEsc}>
      <button
        ref={gatilho}
        type="button"
        className="cabecalho-link notificacoes-gatilho"
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={rotulo}
        title={rotulo}
        onClick={() => definirAberto((atual) => !atual)}
      >
        <IconeSino />
        {naoLidas > 0 && <span className="notificacoes-contador" aria-hidden>{naoLidas > 9 ? '9+' : naoLidas}</span>}
      </button>

      {aberto && (
        <div id={idPainel} className="notificacoes-painel" role="region" aria-labelledby={idTitulo}>
          <div className="notificacoes-topo">
            <h2 id={idTitulo} className="notificacoes-titulo">Notificações</h2>
            {naoLidas > 0 && (
              <button type="button" className="botao-texto" onClick={() => void lerTodas()}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          {!caixa && falhou && <p className="notificacoes-vazio">Não foi possível carregar as notificações.</p>}
          {!caixa && !falhou && <p className="notificacoes-vazio">Carregando…</p>}
          {caixa && caixa.itens.length === 0 && <p className="notificacoes-vazio">Nenhuma notificação por enquanto.</p>}
          {caixa && caixa.itens.length > 0 && (
            <ul className="notificacoes-lista">
              {caixa.itens.map((notificacao) => (
                <li key={notificacao.id}>
                  <button
                    type="button"
                    className={notificacao.lida ? 'notificacao' : 'notificacao notificacao-nova'}
                    onClick={() => void abrir(notificacao)}
                  >
                    <span className="notificacao-marca" aria-hidden />
                    <span className="encolhivel">
                      <span className="notificacao-titulo">
                        {notificacao.titulo}
                        {!notificacao.lida && <span className="so-leitor"> (não lida)</span>}
                      </span>
                      <span className="notificacao-mensagem">{notificacao.mensagem}</span>
                      <span className="notificacao-quando">{tempoRelativo(notificacao.criadaEm)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
