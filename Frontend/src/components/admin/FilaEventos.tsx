'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Campo } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import { IconeCalendario, IconeCheck, IconeNovaAba } from '@/components/ui/Icones'
import { rotuloTipoEvento } from '@/constants/eventos'
import { enderecoDoEvento, linkDoMapa, resumoParticipantes } from '@/utils/eventos'
import {
  decidirEvento, type DecisaoEvento, type EstadoModeracaoEvento, type EventoEmModeracao,
} from '@/services/api/eventos.servico'
import { resumoDaFilaDeEventos } from '@/components/admin/resumoFilaEventos'

const LIMITE_MOTIVO = 1000
const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Recife' })

const VAZIO_POR_ESTADO: Record<EstadoModeracaoEvento, { titulo: string; descricao: string }> = {
  PENDENTE: {
    titulo: 'Nenhum evento aguardando análise',
    descricao: 'Quando um organizador enviar uma feira, festival ou oficina, a proposta aparece aqui.',
  },
  APROVADO: {
    titulo: 'Nenhum evento aprovado ainda',
    descricao: 'Os eventos aprovados aparecem aqui e também na agenda pública.',
  },
  REJEITADO: {
    titulo: 'Nenhum evento rejeitado',
    descricao: 'As propostas rejeitadas ficam registradas aqui com o motivo informado ao organizador.',
  },
}

const ROTULO_ESTADO: Record<EstadoModeracaoEvento, string> = {
  PENDENTE: 'Aguardando análise',
  APROVADO: 'Aprovado e publicado',
  REJEITADO: 'Rejeitado',
}

function quando(iso: string | null): string {
  if (!iso) return ''
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? iso : formatoData.format(data)
}

export default function FilaEventos({ iniciais, estado }: { iniciais: EventoEmModeracao[]; estado: EstadoModeracaoEvento }) {
  const roteador = useRouter()
  const [lista, definirLista] = useState(iniciais)
  const [confirmando, definirConfirmando] = useState<string | null>(null)
  const [rejeicaoAberta, definirRejeicaoAberta] = useState<string | null>(null)
  const [motivo, definirMotivo] = useState('')
  const [erroMotivo, definirErroMotivo] = useState('')
  const [processando, definirProcessando] = useState<string[]>([])
  const emAndamento = useRef(new Set<string>())

  useEffect(() => {
    definirLista(iniciais)
  }, [iniciais])

  function comecar(slug: string): boolean {
    if (emAndamento.current.has(slug)) return false
    emAndamento.current.add(slug)
    definirProcessando((atuais) => [...atuais, slug])
    return true
  }

  function terminar(slug: string) {
    emAndamento.current.delete(slug)
    definirProcessando((atuais) => atuais.filter((atual) => atual !== slug))
  }

  function tirarDaLista(slug: string) {
    definirLista((atual) => atual.filter((item) => item.evento.slug !== slug))
    definirConfirmando((atual) => (atual === slug ? null : atual))
    definirRejeicaoAberta((atual) => (atual === slug ? null : atual))
    roteador.refresh()
  }

  async function decidir(item: EventoEmModeracao, decisao: DecisaoEvento) {
    const { slug, nome } = item.evento
    if (decisao === 'rejeitar' && !motivo.trim()) {
      definirErroMotivo('Explique ao organizador por que o evento não será publicado')
      document.getElementById(`motivo-evento-${slug}`)?.focus()
      return
    }
    if (!comecar(slug)) return
    try {
      const resposta = await decidirEvento(slug, decisao, motivo)
      if (resposta.erro || !resposta.dados) {
        if (resposta.erro?.codigo === 'EVENTO_JA_DECIDIDO') {
          avisar.info('Este evento já foi decidido', 'Outra pessoa da equipe registrou a decisão antes. A fila foi atualizada.')
          tirarDaLista(slug)
          return
        }
        const erroDoMotivo = resposta.erro?.campos?.motivo
        if (erroDoMotivo) definirErroMotivo(erroDoMotivo)
        avisar.erro('Não foi possível registrar a decisão', resposta.erro?.mensagem)
        return
      }
      tirarDaLista(slug)
      if (resposta.dados.status === 'APROVADO') {
        avisar.sucesso('Evento aprovado e publicado', `${nome} já aparece na agenda pública.`)
      } else {
        avisar.info('Evento rejeitado', `${nome} não será publicado. O motivo ficou registrado.`)
      }
    } catch {
      avisar.erro('Não foi possível registrar a decisão', 'Tente novamente.')
    } finally {
      terminar(slug)
    }
  }

  function abrirConfirmacao(slug: string) {
    if (emAndamento.current.has(slug)) return
    definirRejeicaoAberta(null)
    definirConfirmando(slug)
  }

  function abrirRejeicao(slug: string) {
    if (emAndamento.current.has(slug)) return
    definirConfirmando(null)
    definirRejeicaoAberta(slug)
    definirMotivo('')
    definirErroMotivo('')
  }

  if (lista.length === 0) {
    const vazio = VAZIO_POR_ESTADO[estado]
    return <EstadoVazio icone={<IconeCalendario tamanho={34} />} titulo={vazio.titulo} descricao={vazio.descricao} />
  }

  return (
    <section aria-labelledby="fila-eventos-titulo">
      <h2 className="so-leitor" id="fila-eventos-titulo">{resumoDaFilaDeEventos(lista.length, estado)}</h2>
      <ul className="lista-curadoria escalonado">
        {lista.map((item) => {
          const { evento } = item
          const ocupado = processando.includes(evento.slug)
          const pendente = item.status === 'PENDENTE'
          return (
            <li className="cartao-curadoria" key={evento.slug}>
              <header className="cartao-curadoria-topo">
                <div className="encolhivel">
                  <p className="cartao-curadoria-peca">{evento.nome}</p>
                  <p className="autoria">
                    {[rotuloTipoEvento[evento.tipo] ?? evento.tipo, evento.cidade, evento.local].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={`selo ${pendente ? 'selo-encomenda' : item.publicado ? 'selo-unica' : 'selo-neutro'}`}>
                  <span className="selo-ponto" />
                  {ROTULO_ESTADO[item.status]}
                </span>
              </header>

              <div className="cartao-curadoria-corpo">
                <p className="texto-suave" style={{ whiteSpace: 'pre-line' }}>{evento.descricao}</p>
                <div className="moderacao-blocos">
                  <dl className="moderacao-bloco">
                    <dt>Quando</dt>
                    <dd>{[evento.periodo, evento.horario].filter(Boolean).join(' · ')}</dd>
                    <dt>Entrada</dt>
                    <dd>{evento.entrada}</dd>
                    <dt>Organização</dt>
                    <dd>{evento.organizador}</dd>
                    <dt>Participantes</dt>
                    <dd>{resumoParticipantes(evento)}</dd>
                    {evento.site && (<>
                      <dt>Site</dt>
                      <dd><a href={evento.site} target="_blank" rel="noopener noreferrer">{evento.site}</a></dd>
                    </>)}
                  </dl>
                  <dl className="moderacao-bloco">
                    <dt>Local</dt>
                    <dd>{evento.local}</dd>
                    <dt>Endereço</dt>
                    <dd>
                      {enderecoDoEvento(evento).logradouro}
                      <br />
                      <span className="texto-suave">{enderecoDoEvento(evento).regiao}</span>
                    </dd>
                    {evento.referencia && (<>
                      <dt>Referência</dt>
                      <dd>{evento.referencia}</dd>
                    </>)}
                    <dt>Ponto no mapa</dt>
                    <dd>
                      <a href={linkDoMapa(evento)} target="_blank" rel="noopener noreferrer" className="linha-flex" style={{ gap: 6 }}>
                        Conferir no mapa <IconeNovaAba tamanho={14} />
                      </a>
                    </dd>
                  </dl>
                  <dl className="moderacao-bloco">
                    <dt>Solicitante</dt>
                    <dd>
                      {item.solicitante?.nome ?? 'Conta não identificada'}
                      {item.solicitante?.email && (<><br /><a href={`mailto:${item.solicitante.email}`}>{item.solicitante.email}</a></>)}
                    </dd>
                    <dt>Responsável</dt>
                    <dd>
                      {item.contato?.nome ?? 'Não informado'}
                      {item.contato?.telefone && (<><br /><a href={`tel:${item.contato.telefone.replace(/D/g, '')}`}>{item.contato.telefone}</a></>)}
                      {item.contato?.email && (<><br /><a href={`mailto:${item.contato.email}`}>{item.contato.email}</a></>)}
                    </dd>
                  </dl>
                </div>
                <p className="dado-rotulo acima-2">
                  Enviado em {quando(item.submetidoEm)}
                  {item.decididoEm && ` · decidido em ${quando(item.decididoEm)}`}
                </p>
                {item.motivo && (
                  <p className="texto-suave acima-2">
                    <strong>Motivo da rejeição:</strong> {item.motivo}
                  </p>
                )}

                {rejeicaoAberta === evento.slug && (
                  <div className="acima-3">
                    <Campo
                      rotulo="Por que o evento não será publicado?"
                     
                      erro={erroMotivo}
                      id={`motivo-evento-${evento.slug}`}
                    >
                      <textarea
                        id={`motivo-evento-${evento.slug}`}
                        maxLength={LIMITE_MOTIVO}
                        disabled={ocupado}
                        value={motivo}
                        onChange={(e) => {
                          definirMotivo(e.target.value)
                          if (erroMotivo) definirErroMotivo('')
                        }}
                      />
                    </Campo>
                  </div>
                )}
              </div>

              <footer className="acoes-linha acoes-empilhaveis cartao-curadoria-acoes">
                {pendente && rejeicaoAberta === evento.slug && (
                  <>
                    <button type="button" className="botao botao-primario" disabled={ocupado} onClick={() => decidir(item, 'rejeitar')}>
                      Rejeitar evento
                    </button>
                    <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => definirRejeicaoAberta(null)}>
                      Cancelar
                    </button>
                  </>
                )}

                {pendente && confirmando === evento.slug && (
                  <>
                    <p className="cartao-curadoria-pergunta">Aprovar e publicar {evento.nome} na agenda?</p>
                    <button type="button" className="botao botao-sucesso" disabled={ocupado} autoFocus onClick={() => decidir(item, 'aprovar')}>
                      <IconeCheck />
                      Confirmar aprovação
                    </button>
                    <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => definirConfirmando(null)}>
                      Cancelar
                    </button>
                  </>
                )}

                {pendente && rejeicaoAberta !== evento.slug && confirmando !== evento.slug && (
                  <>
                    <button type="button" className="botao botao-sucesso" disabled={ocupado} onClick={() => abrirConfirmacao(evento.slug)}>
                      <IconeCheck />
                      Aprovar
                    </button>
                    <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => abrirRejeicao(evento.slug)}>
                      Rejeitar
                    </button>
                  </>
                )}

                {item.publicado && (
                  <Link href={`/events/${evento.slug}`} target="_blank" rel="noopener noreferrer" className="botao botao-fantasma">
                    Ver na agenda
                    <IconeNovaAba />
                    <span className="so-leitor">(abre em nova aba)</span>
                  </Link>
                )}
              </footer>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
