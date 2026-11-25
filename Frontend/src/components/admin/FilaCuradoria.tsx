'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import EvidenciasSolicitacao from '@/components/admin/EvidenciasSolicitacao'
import type { SolicitacaoComEvidencias } from '@/components/admin/montarFilaCuradoria'
import { Campo, Retrato } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import { IconeCheck, IconeNovaAba, IconeSelo, IconeSetaBaixo } from '@/components/ui/Icones'
import { MOTIVO_SEM_PECAS, motivosDeAjuste } from '@/constants/curadoria'
import { decidirSolicitacaoSelo, type SituacaoFiltroCuradoria } from '@/services/api/curadoria.servico'
import type { Paginacao } from '@/services/api/tipos'

const LIMITE_MOTIVO = 1000
const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Recife' })

function quando(iso?: string | null): string {
  if (!iso) return ''
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? iso : formatoData.format(data)
}

function tempoDeEspera(dias: number): string {
  if (dias === 0) return 'Hoje'
  return dias === 1 ? 'Há 1 dia' : `Há ${dias} dias`
}

function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`
}

function resumoDaFila(
  fila: SolicitacaoComEvidencias[],
  situacao: SituacaoFiltroCuradoria,
  busca: string,
  paginacao: Paginacao,
  verificados: number,
): string {
  const { total } = paginacao
  const contagem = {
    pendente: total === 0 ? 'Nenhuma solicitação aguardando' : `${total} aguardando`,
    ajuste: total === 0 ? 'Nenhum pedido de ajuste' : plural(total, 'pedido de ajuste', 'pedidos de ajuste'),
    aprovada: total === 0 ? 'Nenhum selo concedido' : plural(total, 'selo concedido', 'selos concedidos'),
    todas: total === 0 ? 'Nenhuma solicitação' : plural(total, 'solicitação', 'solicitações'),
  }[situacao]
  const maisAntiga = situacao === 'pendente' && !busca && paginacao.pagina === 1 ? fila[0] : undefined
  const partes = [
    busca ? `${contagem} para “${busca}”` : contagem,
    maisAntiga && (maisAntiga.diasEsperando === 0
      ? 'a mais antiga é de hoje'
      : `a mais antiga ${tempoDeEspera(maisAntiga.diasEsperando).toLowerCase()}`),
    verificados === 1 ? '1 artesão verificado' : `${verificados} artesãos verificados`,
  ]
  return partes.filter(Boolean).join(' · ')
}

function seloDaSituacao(item: SolicitacaoComEvidencias): { classe: string; texto: string; titulo: string } {
  if (item.situacao === 'aprovada') {
    return { classe: 'selo-disponivel', texto: 'Selo concedido', titulo: `Concedido em ${quando(item.decididoEm)}` }
  }
  if (item.situacao === 'ajuste') {
    return { classe: 'selo-neutro', texto: 'Ajuste pedido', titulo: `Ajuste pedido em ${quando(item.decididoEm)}` }
  }
  return { classe: 'selo-encomenda', texto: tempoDeEspera(item.diasEsperando), titulo: `Solicitado em ${quando(item.solicitadoEm)}` }
}

function estadoVazio(situacao: SituacaoFiltroCuradoria, busca: string): string {
  if (busca) return 'Nenhuma solicitação encontrada'
  return {
    pendente: 'Fila de curadoria em dia',
    ajuste: 'Nenhum pedido de ajuste',
    aprovada: 'Nenhum selo concedido ainda',
    todas: 'Nenhuma solicitação de selo',
  }[situacao]
}

export default function FilaCuradoria({
  filaInicial,
  situacao,
  busca,
  paginacao,
  artesaosVerificados,
}: {
  filaInicial: SolicitacaoComEvidencias[]
  situacao: SituacaoFiltroCuradoria
  busca: string
  paginacao: Paginacao
  artesaosVerificados: number
}) {
  const roteador = useRouter()
  const [decididas, definirDecididas] = useState<Record<string, Partial<SolicitacaoComEvidencias>>>({})
  const [verificados, definirVerificados] = useState(artesaosVerificados)
  const [confirmando, definirConfirmando] = useState<string | null>(null)
  const [ajusteAberto, definirAjusteAberto] = useState<string | null>(null)
  const [motivo, definirMotivo] = useState('')
  const [erroMotivo, definirErroMotivo] = useState('')
  const [processando, definirProcessando] = useState<string[]>([])
  const emAndamento = useRef(new Set<string>())
  const solicitacoesConcluidas = useRef(new Set<string>())
  const fila = filaInicial.map((item) => (decididas[item.id] ? { ...item, ...decididas[item.id] } : item))

  function iniciarAtualizacao(id: string) {
    if (emAndamento.current.has(id) || solicitacoesConcluidas.current.has(id)) return false
    emAndamento.current.add(id)
    definirProcessando((atuais) => [...atuais, id])
    return true
  }

  function finalizarAtualizacao(id: string) {
    emAndamento.current.delete(id)
    definirProcessando((atuais) => atuais.filter((atual) => atual !== id))
  }

  function registrarDecisao(item: SolicitacaoComEvidencias, decidida: Partial<SolicitacaoComEvidencias>) {
    solicitacoesConcluidas.current.add(item.id)
    definirDecididas((atuais) => ({ ...atuais, [item.id]: decidida }))
    definirAjusteAberto((atual) => atual === item.id ? null : atual)
    definirConfirmando((atual) => atual === item.id ? null : atual)
    roteador.refresh()
  }

  async function conceder(item: SolicitacaoComEvidencias) {
    if (!iniciarAtualizacao(item.id)) return
    try {
      const resposta = await decidirSolicitacaoSelo(item.id, 'aprovada')
      if (resposta.erro || !resposta.dados) { avisar.erro('Não foi possível conceder o selo', resposta.erro?.mensagem); return }
      registrarDecisao(item, resposta.dados)
      definirVerificados((n) => n + 1)
      avisar.sucesso('Selo de verificado concedido', `${item.atelie}, de ${item.artesao}.`)
    } catch {
      avisar.erro('Não foi possível conceder o selo', 'Tente novamente.')
    } finally {
      finalizarAtualizacao(item.id)
    }
  }

  async function pedirAjuste(item: SolicitacaoComEvidencias) {
    if (!motivo.trim()) {
      definirErroMotivo('Explique ao artesão o que precisa ser ajustado')
      document.getElementById(`motivo-${item.id}`)?.focus()
      return
    }
    if (!iniciarAtualizacao(item.id)) return
    try {
      const resposta = await decidirSolicitacaoSelo(item.id, 'ajuste', motivo)
      if (resposta.erro || !resposta.dados) { avisar.erro('Não foi possível registrar', resposta.erro?.mensagem); return }
      registrarDecisao(item, resposta.dados)
      avisar.info('Pedido de ajuste enviado', `${item.artesao} vê o motivo no painel e continua vendendo normalmente.`)
    } catch {
      avisar.erro('Não foi possível registrar', 'Seu motivo foi mantido. Tente novamente.')
    } finally {
      finalizarAtualizacao(item.id)
    }
  }

  function abrirConfirmacao(id: string) {
    if (emAndamento.current.has(id) || solicitacoesConcluidas.current.has(id)) return
    definirAjusteAberto(null)
    definirConfirmando(id)
  }

  function abrirAjuste(item: SolicitacaoComEvidencias) {
    if (emAndamento.current.has(item.id) || solicitacoesConcluidas.current.has(item.id)) return
    definirConfirmando(null)
    definirAjusteAberto(item.id)
    definirMotivo(!item.pecasIndisponiveis && item.pecas.length === 0 ? MOTIVO_SEM_PECAS : '')
    definirErroMotivo('')
  }

  function alternarMotivo(texto: string) {
    definirMotivo((atual) => atual.includes(texto)
      ? atual.replace(texto, '').replace(/\n{2,}/g, '\n').trim()
      : [atual.trim(), texto].filter(Boolean).join('\n'))
    definirErroMotivo('')
  }

  return (
    <>
      <p className="subtitulo-pagina">{resumoDaFila(fila, situacao, busca, paginacao, verificados)}</p>

      <section aria-labelledby="fila-curadoria-titulo">
        <h2 className="so-leitor" id="fila-curadoria-titulo">Solicitações do selo de verificado</h2>

        {fila.length === 0 ? (
          <EstadoVazio icone={<IconeSelo tamanho={34} />} titulo={estadoVazio(situacao, busca)} />
        ) : (
          <ul className="lista-acordeao-admin">
            {fila.map((item) => {
              const ocupado = processando.includes(item.id)
              const temPecas = item.pecas.length > 0
              const pendente = item.situacao === 'pendente'
              const selo = seloDaSituacao(item)
              const origem = [item.territorio, item.tecnica].filter(Boolean).join(' · ')
              return (
                <li className="item-curadoria" key={item.id}>
                  <details className="acordeao-admin">
                    <summary className="acordeao-admin-resumo">
                      <Retrato imagem={item.imagem} tamanho={36} />
                      <span className="acordeao-admin-identidade">
                        <span className="acordeao-admin-titulo">{item.atelie || item.artesao}</span>
                        <span className="acordeao-admin-subtitulo">{item.artesao}</span>
                      </span>
                      <span className={`selo ${selo.classe}`} title={selo.titulo}>{selo.texto}</span>
                      <span className="seta-grupo" aria-hidden>
                        <IconeSetaBaixo />
                      </span>
                    </summary>

                    <div className="acordeao-admin-corpo">
                      {origem && <p className="texto-suave">{origem}</p>}

                      {pendente ? (
                        <EvidenciasSolicitacao item={item} />
                      ) : (
                        <dl className="acordeao-admin-dados">
                          <div className="dado">
                            <dt className="dado-rotulo">{item.situacao === 'aprovada' ? 'Selo concedido em' : 'Ajuste pedido em'}</dt>
                            <dd className="dado-valor">{quando(item.decididoEm) || '—'}</dd>
                          </div>
                          <div className="dado">
                            <dt className="dado-rotulo">Solicitado em</dt>
                            <dd className="dado-valor">{quando(item.solicitadoEm)}</dd>
                          </div>
                          {typeof item.pecasPublicadas === 'number' && (
                            <div className="dado">
                              <dt className="dado-rotulo">Peças publicadas na decisão</dt>
                              <dd className="dado-valor">{item.pecasPublicadas}</dd>
                            </div>
                          )}
                          {item.situacao === 'ajuste' && item.motivo && (
                            <div className="dado acordeao-admin-dado-largo">
                              <dt className="dado-rotulo">Motivo do ajuste</dt>
                              <dd className="dado-valor acordeao-admin-texto">{item.motivo}</dd>
                            </div>
                          )}
                        </dl>
                      )}

                      {item.mensagem && (
                        <p className="texto-suave acordeao-admin-texto">
                          <strong>Mensagem do artesão:</strong> {item.mensagem}
                        </p>
                      )}

                      {pendente && ajusteAberto === item.id && (
                        <div>
                          <div className="chips-filtro abaixo-2" role="group" aria-label="Motivos frequentes">
                            {motivosDeAjuste.map((texto) => {
                              const ativo = motivo.includes(texto)
                              return (
                                <button
                                  key={texto}
                                  type="button"
                                  className={`chip-filtro${ativo ? ' chip-filtro-ativo' : ''}`}
                                  aria-pressed={ativo}
                                  disabled={ocupado}
                                  onClick={() => alternarMotivo(texto)}
                                >
                                  {texto}
                                </button>
                              )
                            })}
                          </div>
                          <Campo
                            rotulo="O que precisa ser ajustado?"
                            ajuda="O artesão vê este texto no painel. Ele pode continuar vendendo enquanto ajusta."
                            erro={erroMotivo}
                            id={`motivo-${item.id}`}
                          >
                            <textarea
                              id={`motivo-${item.id}`}
                              maxLength={LIMITE_MOTIVO}
                              disabled={ocupado}
                              value={motivo}
                              onChange={(evento) => {
                                definirMotivo(evento.target.value)
                                if (erroMotivo) definirErroMotivo('')
                              }}
                            />
                          </Campo>
                        </div>
                      )}

                      {pendente && (
                        <div className="acoes-linha acoes-empilhaveis">
                          {ajusteAberto === item.id && (
                            <>
                              <button type="button" className="botao botao-primario" disabled={ocupado} onClick={() => pedirAjuste(item)}>
                                Enviar pedido de ajuste
                              </button>
                              <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => definirAjusteAberto(null)}>
                                Cancelar
                              </button>
                            </>
                          )}

                          {confirmando === item.id && (
                            <>
                              <p className="cartao-curadoria-pergunta">Conceder o selo de verificado a {item.atelie}?</p>
                              <button type="button" className="botao botao-sucesso" disabled={ocupado} autoFocus onClick={() => conceder(item)}>
                                <IconeCheck />
                                Confirmar selo
                              </button>
                              <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => definirConfirmando(null)}>
                                Cancelar
                              </button>
                            </>
                          )}

                          {ajusteAberto !== item.id && confirmando !== item.id && (
                            <>
                              {temPecas && (
                                <button type="button" className="botao botao-sucesso" disabled={ocupado} onClick={() => abrirConfirmacao(item.id)}>
                                  <IconeCheck />
                                  Conceder selo
                                </button>
                              )}
                              <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => abrirAjuste(item)}>
                                Pedir ajuste
                              </button>
                              <Link href={`/artisans/${item.artesaoSlug}`} target="_blank" rel="noopener noreferrer" className="botao botao-fantasma">
                                Ver perfil
                                <IconeNovaAba />
                                <span className="so-leitor">(abre em nova aba)</span>
                              </Link>
                              {item.pecasIndisponiveis ? (
                                <p className="campo-ajuda">Peças indisponíveis no momento. Recarregue a página para conferir as peças antes de conceder o selo.</p>
                              ) : (
                                !temPecas && <p className="campo-ajuda">O selo exige ao menos uma peça publicada.</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
