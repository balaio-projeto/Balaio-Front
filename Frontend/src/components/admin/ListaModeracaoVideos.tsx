'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import SeloVideo from '@/components/painel/SeloVideo'
import { dataCurta } from '@/components/painel/estadoVideo'
import { IconeAviso, IconeNovaAba, IconePlay } from '@/components/ui/Icones'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import {
  TAMANHO_MAXIMO_MOTIVO_SUSPENSAO, reativarVideo, suspenderVideo, validarMotivoSuspensao,
  type FiltroModeracaoVideo,
} from '@/services/api/moderacaoVideos.servico'
import type { VideoEmModeracao } from '@/types/dominio'
import { emMilhares } from '@/utils/formato'

type Acao = { id: string; tipo: 'suspender' | 'reativar' } | null

type Props = {
  iniciais: VideoEmModeracao[]
  filtro: FiltroModeracaoVideo
  nomesDosArtesaos: Record<string, string>
}

function apareceNoFiltro(video: VideoEmModeracao, filtro: FiltroModeracaoVideo): boolean {
  return filtro === 'todos' || video.estado === filtro
}

function FormSuspensao({ video, ocupado, aoConfirmar, aoCancelar }: {
  video: VideoEmModeracao
  ocupado: boolean
  aoConfirmar: (motivo: string) => void
  aoCancelar: () => void
}) {
  const id = useId()
  const campo = useRef<HTMLTextAreaElement>(null)
  const [motivo, definirMotivo] = useState('')
  const [erro, definirErro] = useState<string | null>(null)

  useEffect(() => {
    campo.current?.focus()
  }, [])

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const problema = validarMotivoSuspensao(motivo)
    definirErro(problema)
    if (problema) {
      campo.current?.focus()
      return
    }
    aoConfirmar(motivo)
  }

  return (
    <form className="moderacao-video-form" onSubmit={enviar} noValidate aria-labelledby={`${id}-titulo`}>
      <strong id={`${id}-titulo`}>Suspender “{video.legenda}”?</strong>
      <p className="campo-ajuda">
        O vídeo sai do Ateliê ao vivo e da página do ateliê na hora. O artesão recebe uma notificação com o motivo
        abaixo e continua vendo o vídeo no painel.
      </p>
      <label className="campo-rotulo" htmlFor={`${id}-motivo`}>Motivo da suspensão</label>
      <textarea
        ref={campo}
        id={`${id}-motivo`}
        value={motivo}
        maxLength={TAMANHO_MAXIMO_MOTIVO_SUSPENSAO}
        onChange={(evento) => definirMotivo(evento.target.value)}
        placeholder="Ex.: o vídeo mostra peças de outro ateliê, o que contraria as regras de publicação."
        aria-invalid={erro ? true : undefined}
        aria-describedby={`${id}-contador${erro ? ` ${id}-erro` : ''}`}
        disabled={ocupado}
      />
      <span className="campo-ajuda" id={`${id}-contador`}>
        {motivo.trim().length} de {TAMANHO_MAXIMO_MOTIVO_SUSPENSAO} caracteres (mínimo 10).
      </span>
      {erro && <span className="campo-erro" id={`${id}-erro`} role="status">{erro}</span>}
      <div className="acoes-linha">
        <button type="button" className="botao botao-fantasma botao-compacto" disabled={ocupado} onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="botao botao-perigo botao-compacto" disabled={ocupado}>
          {ocupado ? 'Suspendendo…' : 'Confirmar suspensão'}
        </button>
      </div>
    </form>
  )
}

function ConfirmacaoReativacao({ ocupado, aoConfirmar, aoCancelar }: {
  ocupado: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  const id = useId()
  const confirmar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmar.current?.focus()
  }, [])

  return (
    <div className="cancelamento-confirmacao" role="region" aria-labelledby={id}>
      <span className="cancelamento-confirmacao-icone" aria-hidden="true">
        <IconeAviso tamanho={20} />
      </span>
      <div>
        <h3 id={id}>Reativar este vídeo?</h3>
        <p>Se estiver publicado, ele volta ao Ateliê ao vivo. O artesão recebe uma notificação.</p>
        <div className="cancelamento-acoes">
          <button type="button" className="botao botao-fantasma botao-compacto" disabled={ocupado} onClick={aoCancelar}>
            Voltar
          </button>
          <button ref={confirmar} type="button" className="botao botao-primario botao-compacto" disabled={ocupado}
            onClick={aoConfirmar}>
            {ocupado ? 'Reativando…' : 'Confirmar reativação'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ListaModeracaoVideos({ iniciais, filtro, nomesDosArtesaos }: Props) {
  const [lista, definirLista] = useState(iniciais)
  const [acao, definirAcao] = useState<Acao>(null)
  const [processando, definirProcessando] = useState<string | null>(null)

  useEffect(() => {
    definirLista(iniciais)
  }, [iniciais])

  function substituir(atualizado: VideoEmModeracao) {
    definirLista((atual) => atual.flatMap((video) => {
      if (video.id !== atualizado.id) return [video]
      return apareceNoFiltro(atualizado, filtro) ? [atualizado] : []
    }))
  }

  async function suspender(video: VideoEmModeracao, motivo: string) {
    if (processando) return
    definirProcessando(video.id)
    try {
      const resposta = await suspenderVideo(video.id, motivo)
      if (resposta.erro || !resposta.dados) {
        avisar.erro('Não foi possível suspender o vídeo', resposta.erro?.mensagem)
        return
      }
      substituir(resposta.dados)
      definirAcao(null)
      avisar.sucesso('Vídeo suspenso', 'O artesão foi avisado e o vídeo saiu do Ateliê ao vivo.')
    } catch {
      avisar.erro('Não foi possível suspender o vídeo', 'Tente novamente.')
    } finally {
      definirProcessando(null)
    }
  }

  async function reativar(video: VideoEmModeracao) {
    if (processando) return
    definirProcessando(video.id)
    try {
      const resposta = await reativarVideo(video.id)
      if (resposta.erro || !resposta.dados) {
        avisar.erro('Não foi possível reativar o vídeo', resposta.erro?.mensagem)
        return
      }
      substituir(resposta.dados)
      definirAcao(null)
      avisar.sucesso('Vídeo reativado', 'O artesão foi avisado.')
    } catch {
      avisar.erro('Não foi possível reativar o vídeo', 'Tente novamente.')
    } finally {
      definirProcessando(null)
    }
  }

  if (lista.length === 0) {
    return (
      <EstadoVazio
        icone={<IconePlay tamanho={34} />}
        titulo={filtro === 'suspensa' ? 'Nenhum vídeo suspenso' : 'Nenhum vídeo por aqui'}
        descricao={filtro === 'suspensa' ? 'Os vídeos suspensos aparecem aqui até serem reativados.' : undefined}
      />
    )
  }

  return (
    <ul className="moderacao-videos">
      {lista.map((video) => {
        const nomeArtesao = nomesDosArtesaos[video.artesao] ?? 'Artesão'
        const ocupado = processando === video.id
        const publicadoEm = dataCurta(video.publicadoEm)
        const suspensoEm = dataCurta(video.suspensao?.suspensoEm)
        return (
          <li className="moderacao-video" key={video.id}>
            <div className="moderacao-video-capa">
              <ImagemComFallback
                src={video.capa}
                alt=""
                loading="lazy"
                semImagem={<span className="capa-video-vazia" aria-hidden><IconePlay tamanho={28} /></span>}
              />
            </div>

            <div className="moderacao-video-info">
              <div className="moderacao-video-topo">
                <SeloVideo estado={video.estado} />
                <span className="dado-rotulo">
                  {publicadoEm ? `Publicado em ${publicadoEm}` : `Criado em ${dataCurta(video.criadoEm) ?? '—'}`}
                </span>
              </div>
              <p className="moderacao-video-legenda">{video.legenda}</p>
              <p className="autoria">
                <Link href={`/artisans/${encodeURIComponent(video.artesao)}`}>{nomeArtesao}</Link>
                {` · ${emMilhares(video.visualizacoes)} visualizações`}
                {video.etiquetas.length > 0 && ` · ${video.etiquetas.map((etiqueta) => `#${etiqueta}`).join(' ')}`}
              </p>
              {video.suspensao && (
                <div className="video-suspensao" role="note">
                  <strong>Suspenso{suspensoEm ? ` em ${suspensoEm}` : ''}</strong>
                  <p>Motivo: {video.suspensao.motivo}</p>
                </div>
              )}
            </div>

            <div className="moderacao-video-acoes">
              {acao?.id === video.id && acao.tipo === 'suspender' ? (
                <FormSuspensao
                  video={video}
                  ocupado={ocupado}
                  aoConfirmar={(motivo) => void suspender(video, motivo)}
                  aoCancelar={() => definirAcao(null)}
                />
              ) : acao?.id === video.id && acao.tipo === 'reativar' ? (
                <ConfirmacaoReativacao
                  ocupado={ocupado}
                  aoConfirmar={() => void reativar(video)}
                  aoCancelar={() => definirAcao(null)}
                />
              ) : (
                <>
                  {video.url && (
                    <a href={video.url} className="botao botao-compacto botao-secundario" target="_blank" rel="noopener">
                      <IconeNovaAba tamanho={15} />
                      Assistir
                      <span className="so-leitor"> (abre em nova aba)</span>
                    </a>
                  )}
                  {video.estado === 'suspensa' ? (
                    <button type="button" className="botao botao-compacto botao-primario" disabled={Boolean(processando)}
                      onClick={() => definirAcao({ id: video.id, tipo: 'reativar' })}>
                      Reativar
                    </button>
                  ) : (
                    <button type="button" className="botao botao-compacto botao-perigo" disabled={Boolean(processando)}
                      onClick={() => definirAcao({ id: video.id, tipo: 'suspender' })}>
                      Suspender
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
