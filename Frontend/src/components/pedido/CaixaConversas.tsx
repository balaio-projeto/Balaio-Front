'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Retrato } from '@/components/ui/Basicos'
import { IconeEnviar, IconeSetaEsquerda } from '@/components/ui/Icones'
import type { ConversaArtesao, Mensagem } from '@/types/dominio'
import { confirmarLeituraDaConversa, conversaDoPedido, enviarMensagem } from '@/services/api/pedidos.servico'
import { avisar } from '@/components/feedback/Avisos'
import { ContadorMensagem, ListaMensagens, TAMANHO_MAXIMO_MENSAGEM } from '@/components/pedido/ConversaPedido'

type Props = { fios: ConversaArtesao[]; conversaInicial: Mensagem[]; fioSolicitado?: string }

export default function CaixaConversas({ fios, conversaInicial, fioSolicitado }: Props) {
  const idFioInicial = fios.find((f) => f.id === fioSolicitado)?.id ?? fios[0]?.id
  const [fioAtivo, definirFioAtivo] = useState(idFioInicial)
  const [fioAberto, definirFioAberto] = useState(idFioInicial !== undefined && idFioInicial === fioSolicitado)
  const [lidas, definirLidas] = useState<string[]>([])
  const [mensagens, definirMensagens] = useState<Record<string, Mensagem[]>>(() =>
    idFioInicial ? { [idFioInicial]: conversaInicial } : {},
  )
  const [rascunhos, definirRascunhos] = useState<Record<string, string>>({})
  const [enviando, definirEnviando] = useState<string[]>([])
  const [carregando, definirCarregando] = useState<string[]>([])
  const enviosEmAndamento = useRef(new Set<string>())
  const tentativasPendentes = useRef(new Map<string, { texto: string; chave: string }>())
  const carregamentosEmAndamento = useRef(new Set<string>())
  const refTituloFio = useRef<HTMLParagraphElement>(null)
  const jaAbriuFio = useRef(false)
  const leituraInicialAvaliada = useRef(false)

  const fio = fios.find((f) => f.id === fioAtivo)

  useEffect(() => {
    if (leituraInicialAvaliada.current) return
    leituraInicialAvaliada.current = true
    const fioInicialNaoLido = fios.find((f) => f.id === idFioInicial)?.naoLida
    const fioInicialVisivel = fioAberto || window.matchMedia('(min-width: 1000px)').matches
    if (idFioInicial && fioInicialNaoLido && fioInicialVisivel) void confirmarLeituraDaConversa(idFioInicial)
  }, [fios, idFioInicial, fioAberto])

  useEffect(() => {
    const listaLarga = window.matchMedia('(min-width: 1000px)').matches
    if (fioAberto) {
      jaAbriuFio.current = true
      if (!listaLarga) refTituloFio.current?.focus()
    } else if (jaAbriuFio.current) {
      document.getElementById(`fio-${fioAtivo}`)?.focus()
    }
  }, [fioAberto, fioAtivo])

  function estaNaoLida(f: ConversaArtesao) {
    return f.naoLida && !lidas.includes(f.id) && f.id !== fioAtivo
  }

  async function selecionar(id: string) {
    definirFioAtivo(id)
    definirFioAberto(true)
    definirLidas((atuais) => atuais.includes(id) ? atuais : [...atuais, id])
    void confirmarLeituraDaConversa(id)
    if (mensagens[id] || carregamentosEmAndamento.current.has(id)) return
    carregamentosEmAndamento.current.add(id)
    definirCarregando((atuais) => [...atuais, id])
    try {
      const resposta = await conversaDoPedido(id)
      if (!resposta.dados) return avisar.erro('Não foi possível carregar a conversa', resposta.erro?.mensagem)
      const historico = resposta.dados
      definirMensagens((atuais) => atuais[id] ? atuais : { ...atuais, [id]: historico })
    } finally {
      carregamentosEmAndamento.current.delete(id)
      definirCarregando((atuais) => atuais.filter((atual) => atual !== id))
    }
  }

  function voltar() {
    definirFioAberto(false)
  }

  function conversaDo(id: string): Mensagem[] {
    if (mensagens[id]) return mensagens[id]
    const dados = fios.find((f) => f.id === id)
    return dados ? [{ autor: 'comprador', texto: dados.previa, hora: dados.quando }] : []
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!fioAtivo || enviosEmAndamento.current.has(fioAtivo) || carregamentosEmAndamento.current.has(fioAtivo)) return
    const id = fioAtivo
    const rascunho = rascunhos[id] ?? ''
    const texto = rascunho.trim()
    if (!texto) return
    if (texto.length > TAMANHO_MAXIMO_MENSAGEM) {
      avisar.erro('Mensagem longa demais', `A mensagem pode ter até ${TAMANHO_MAXIMO_MENSAGEM} caracteres.`)
      return
    }
    if (tentativasPendentes.current.get(id)?.texto !== texto) {
      tentativasPendentes.current.set(id, { texto, chave: crypto.randomUUID() })
    }
    enviosEmAndamento.current.add(id)
    definirEnviando((atuais) => [...atuais, id])
    const nova: Mensagem = { autor: 'artesao', texto, hora: 'agora' }
    try {
      const resposta = await enviarMensagem(id, nova, tentativasPendentes.current.get(id)!.chave)
      if (!resposta.dados) return avisar.erro('Não foi possível enviar', resposta.erro?.mensagem)
      const enviada = resposta.dados
      definirMensagens((atuais) => ({ ...atuais, [id]: (atuais[id] ?? conversaDo(id)).some((m) => m.id === enviada.id && enviada.id)
        ? (atuais[id] ?? conversaDo(id)) : [...(atuais[id] ?? conversaDo(id)), enviada] }))
      tentativasPendentes.current.delete(id)
      definirRascunhos((atuais) => atuais[id] === rascunho ? { ...atuais, [id]: '' } : atuais)
    } finally {
      enviosEmAndamento.current.delete(id)
      definirEnviando((atuais) => atuais.filter((atual) => atual !== id))
    }
  }

  return (
    <div className={`caixa-conversas${fioAberto ? ' caixa-conversas-detalhe' : ''}`}>
      <ul className="lista-fios">
        {fios.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              id={`fio-${f.id}`}
              className={`fio${estaNaoLida(f) ? ' fio-nao-lido' : ''}${f.id === fioAtivo ? ' fio-ativo' : ''}`}
              onClick={() => selecionar(f.id)}
              aria-pressed={f.id === fioAtivo}
            >
              <Retrato imagem={f.retrato} tamanho={44} />
              <span className="encolhivel" style={{ flex: 1, display: 'block' }}>
                <span className="linha-flex linha-entre" style={{ gap: 10 }}>
                  <span style={{ fontWeight: 600 }}>{f.pessoa}</span>
                  <span className="dado-rotulo">{f.quando}</span>
                </span>
                <span className="territorio" style={{ textTransform: 'none', letterSpacing: 0, display: 'block' }}>
                  {f.assunto}
                </span>
                <span className="previa" style={{ display: 'block' }}>
                  {f.previa}
                </span>
              </span>
              {estaNaoLida(f) && <span className="menu-marcador menu-marcador-alerta">nova</span>}
            </button>
          </li>
        ))}
      </ul>

      {fio && (
        <div className="cartao painel-conversa">
          <button type="button" className="botao botao-fantasma voltar-conversas" onClick={voltar}>
            <IconeSetaEsquerda />
            Todas as conversas
          </button>
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--linha)' }}>
            <p className="texto-forte" tabIndex={-1} ref={refTituloFio}>
              {fio.pessoa}
            </p>
            <p className="autoria">
              Pedido #{fio.id} · {fio.assunto}
            </p>
          </div>

          <div className="conversa">
            <ListaMensagens mensagens={conversaDo(fio.id)} minhas="artesao" />
          </div>

          <form className="conversa-envio" onSubmit={enviar}>
            <label className="so-leitor" htmlFor="resposta">
              Escreva sua resposta
            </label>
            <input
              id="resposta"
              className="campo-select"
              placeholder="Escreva sua resposta..."
              style={{ flex: 1, minHeight: 48 }}
              value={rascunhos[fio.id] ?? ''}
              maxLength={TAMANHO_MAXIMO_MENSAGEM}
              aria-describedby="resposta-contador"
              onChange={(evento) => {
                const texto = evento.target.value
                definirRascunhos((atuais) => ({ ...atuais, [fio.id]: texto }))
              }}
            />
            <button type="submit" className="botao botao-primario" disabled={enviando.includes(fio.id) || carregando.includes(fio.id)} style={{ padding: '0 16px' }} aria-label="Enviar resposta">
              <IconeEnviar />
            </button>
          </form>
          <ContadorMensagem id="resposta-contador" texto={rascunhos[fio.id] ?? ''} />
        </div>
      )}
    </div>
  )
}
