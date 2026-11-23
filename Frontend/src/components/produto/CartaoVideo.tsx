'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Retrato } from '@/components/ui/Basicos'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import PlayerVideo from '@/components/produto/PlayerVideo'
import { comentarVideo, comentariosDe, registrarVisualizacao } from '@/services/api/videos.servico'
import { avisar } from '@/components/feedback/Avisos'
import { IconeConversa, IconeCoracao, IconeMarcador, IconePlay, IconeSelo, IconeSetaDireita } from '@/components/ui/Icones'
import { emMilhares, emReais } from '@/utils/formato'
import type { Comentario, Video } from '@/types/dominio'
import { imagemReal } from '@/utils/imagem'
import { useEstadoCliente } from '@/store/estadoCliente'
import { useSessao } from '@/store/sessao'
import { rotaDeLogin } from '@/services/sessao/cookie'
import { useItemDaColecao } from '@/hooks/useItemDaColecao'
import { LIMIARES_DE_VISIBILIDADE, esquecerVideo, informarProporcaoVisivel, proporcaoVisivel, useVideoEmFoco } from '@/components/produto/focoDosVideos'

const TAMANHO_MAXIMO_COMENTARIO = 1000
const AVISAR_TAMANHO_COMENTARIO_A_PARTIR_DE = 900

type Autor = { slug: string; nome: string; imagem: string; territorio: string }
type PecaVinculada = { slug: string; nome: string; preco: number; imagem: string }
type LeituraComentarios = 'inicial' | 'carregando' | 'pronto' | 'erro'

type Props = {
  video: Video
  artesao?: Autor
  peca?: PecaVinculada
}

export default function CartaoVideo({ video, artesao, peca }: Props) {
  const { estado, pronto, erro, recarregar } = useEstadoCliente()
  const { sessao } = useSessao()
  const caminho = usePathname()
  const roteador = useRouter()
  const curtida = useItemDaColecao('videosCurtidos', video.id, 'Não foi possível registrar a curtida')
  const salvo = useItemDaColecao('videosSalvos', video.id, 'Não foi possível atualizar os vídeos salvos')
  const [salvando, definirSalvando] = useState(false)
  const [aberto, definirAberto] = useState(false)
  const visivel = useVideoEmFoco(video.id)
  const [naTela, definirNaTela] = useState(false)
  const [lista, definirLista] = useState<Comentario[]>([])
  const [totalLocal, definirTotalLocal] = useState<number | null>(null)
  const [leituraComentarios, definirLeituraComentarios] = useState<LeituraComentarios>('inicial')
  const [erroComentarios, definirErroComentarios] = useState<string | null>(null)
  const [rascunho, definirRascunho] = useState('')
  const campoComentario = useRef<HTMLInputElement>(null)
  const refArtigo = useRef<HTMLElement>(null)
  const refTela = useRef<HTMLDivElement>(null)
  const refComentarios = useRef<HTMLDialogElement>(null)
  const montado = useRef(true)
  const leituraAtual = useRef<LeituraComentarios>('inicial')
  const envioEmAndamento = useRef(false)

  const painelId = `comentarios-${video.id}`
  const totalComentarios = Math.max(video.comentarios, totalLocal ?? video.comentarios)
  const curtidasDeOutros = video.curtidas - (curtida.contadoNoServidor ? 1 : 0)
  const capa = imagemReal(video.capa)

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  useEffect(() => {
    const tela = refTela.current
    if (!tela) return
    const id = video.id
    const observador = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[entradas.length - 1]
        if (!entrada) return
        definirNaTela(entrada.isIntersecting)
        informarProporcaoVisivel(id, proporcaoVisivel(entrada))
      },
      { threshold: LIMIARES_DE_VISIBILIDADE },
    )
    observador.observe(tela)
    return () => {
      observador.disconnect()
      esquecerVideo(id)
    }
  }, [video.id])

  useEffect(() => {
    if (naTela) return
    const dialogo = refComentarios.current
    if (!dialogo?.open) return
    dialogo.close()
    definirAberto(false)
  }, [naTela])

  useEffect(() => {
    const listaLarga = window.matchMedia('(min-width: 900px)')
    function trocarModo() {
      const dialogo = refComentarios.current
      if (!dialogo || !dialogo.open) return
      dialogo.close()
      if (listaLarga.matches) dialogo.show()
      else dialogo.showModal()
      definirAberto(true)
    }
    listaLarga.addEventListener('change', trocarModo)
    return () => listaLarga.removeEventListener('change', trocarModo)
  }, [])

  function fecharComentarios() {
    refComentarios.current?.close()
    definirAberto(false)
  }

  async function carregarComentarios() {
    if (!montado.current || leituraAtual.current === 'carregando' || leituraAtual.current === 'pronto') return
    leituraAtual.current = 'carregando'
    definirLeituraComentarios('carregando')
    definirErroComentarios(null)
    try {
      const resposta = await comentariosDe(video.id)
      if (!montado.current) return
      if (resposta.erro || !resposta.dados) {
        leituraAtual.current = 'erro'
        definirLeituraComentarios('erro')
        definirErroComentarios(resposta.erro?.mensagem ?? 'Não foi possível carregar os comentários.')
        return
      }
      definirLista(resposta.dados)
      leituraAtual.current = 'pronto'
      definirLeituraComentarios('pronto')
    } catch {
      if (!montado.current) return
      leituraAtual.current = 'erro'
      definirLeituraComentarios('erro')
      definirErroComentarios('Não foi possível carregar os comentários. Tente novamente.')
    }
  }

  function alternarComentarios() {
    const dialogo = refComentarios.current
    if (!dialogo) return
    if (dialogo.open) {
      fecharComentarios()
      return
    }
    if (window.matchMedia('(min-width: 900px)').matches) dialogo.show()
    else dialogo.showModal()
    definirAberto(true)
    void carregarComentarios()
  }

  async function alternarSalvo() {
    if (await salvo.alternar()) avisar.comAcao('Vídeo salvo para ver depois', 'Ver salvos', () => roteador.push('/favorites?aba=videos'))
  }

  function responder(autor: string) {
    definirRascunho(`@${autor} `)
    campoComentario.current?.focus()
  }

  const pertoDoLimite = rascunho.length >= AVISAR_TAMANHO_COMENTARIO_A_PARTIR_DE

  async function enviarComentario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const texto = rascunho.trim()
    if (!montado.current || !texto || envioEmAndamento.current || leituraAtual.current !== 'pronto') return
    if (texto.length > TAMANHO_MAXIMO_COMENTARIO) {
      avisar.erro('Comentário longo demais', `O comentário pode ter até ${TAMANHO_MAXIMO_COMENTARIO} caracteres.`)
      return
    }
    envioEmAndamento.current = true
    definirSalvando(true)
    try {
      const resposta = await comentarVideo(video.id, texto)
      if (!montado.current) return
      if (resposta.erro || !resposta.dados) { avisar.erro('Não foi possível comentar', resposta.erro?.mensagem); return }
      definirLista((atuais) => [...atuais, resposta.dados!])
      definirTotalLocal((atual) => Math.max(atual ?? video.comentarios, video.comentarios) + 1)
      definirRascunho((atual) => atual.trim() === texto ? '' : atual)
    } catch {
      if (montado.current) avisar.erro('Não foi possível comentar', 'Seu texto foi mantido. Tente novamente.')
    } finally {
      envioEmAndamento.current = false
      if (montado.current) definirSalvando(false)
    }
  }

  return (
    <article className={`video${aberto ? ' video-aberto' : ''}`} id={video.id} ref={refArtigo} data-ativo={visivel}>
      <div className="video-principal">
        <div className="video-tela" ref={refTela}>
          {video.url ? (
            <PlayerVideo
              url={video.url}
              capa={capa}
              ativo={visivel}
              carregar={visivel || naTela}
              aoIniciar={() => void registrarVisualizacao(video.id)}
            />
          ) : (
            <>
              <ImagemComFallback className="video-capa" src={capa} alt="" loading="lazy"
                semImagem={<span className="capa-video-vazia" aria-hidden><IconePlay tamanho={40} /></span>} />
              <span className="video-progresso" aria-hidden>
                <span className="video-progresso-preenchido" />
              </span>
            </>
          )}

          <span className="video-duracao">{video.duracao}</span>

          <div className="video-rodape">
            {artesao && (
              <Link href={`/artisans/${artesao.slug}`} className="video-autor">
                <Retrato imagem={artesao.imagem} tamanho={40} />
                <span className="encolhivel">
                  <span className="video-autor-nome">{artesao.nome}</span>
                  <span className="video-autor-local">
                    {artesao.territorio} · {video.publicadoEm}
                  </span>
                </span>
              </Link>
            )}

            <p className="video-legenda">{video.legenda}</p>

            <p className="video-etiquetas">
              {video.etiquetas.map((e) => (
                <span key={e}>#{e}</span>
              ))}
            </p>

            {peca && (
              <Link href={`/pieces/${peca.slug}`} className="video-peca">
                <ImagemComFallback src={peca.imagem} alt="" loading="lazy" />
                <span className="encolhivel">
                  <span className="video-peca-nome">{peca.nome}</span>
                  <span className="video-peca-preco">{emReais(peca.preco)}</span>
                </span>
                <IconeSetaDireita tamanho={16} />
              </Link>
            )}
          </div>
        </div>

        <div className="acoes-video">
            <button
              type="button"
              className={`acao-video${curtida.ativo ? ' acao-video-ativa' : ''}`}
              onClick={() => void curtida.alternar()}
              aria-pressed={curtida.ativo}
              disabled={!curtida.disponivel}
            >
              <span className="acao-video-bolha">
                <IconeCoracao tamanho={22} preenchido={curtida.ativo} />
              </span>
              <span className="acao-video-numero">{emMilhares(curtidasDeOutros + (curtida.ativo ? 1 : 0))}</span>
              <span className="so-leitor">{curtida.ativo ? 'Descurtir vídeo' : 'Curtir vídeo'}</span>
            </button>

            <button
              type="button"
              className={`acao-video${aberto ? ' acao-video-ativa' : ''}`}
              onClick={alternarComentarios}
              aria-haspopup="dialog"
              aria-controls={painelId}
            >
              <span className="acao-video-bolha">
                <IconeConversa tamanho={22} />
              </span>
              <span className="acao-video-numero">{emMilhares(totalComentarios)}</span>
              <span className="so-leitor">{aberto ? 'Fechar comentários' : 'Ver comentários'}</span>
            </button>

            <button
              type="button"
              className={`acao-video${salvo.ativo ? ' acao-video-ativa' : ''}`}
              onClick={() => void alternarSalvo()}
              aria-pressed={salvo.ativo}
              disabled={!salvo.disponivel}
            >
              <span className="acao-video-bolha">
                <IconeMarcador tamanho={22} preenchido={salvo.ativo} />
              </span>
              <span className="acao-video-numero">{salvo.ativo ? 'Salvo' : 'Salvar'}</span>
            </button>
          </div>
      </div>

      {pronto && !estado && (
        <div className="acima-3">
          <p className="campo-erro" role="alert">{erro ?? 'Não foi possível carregar suas interações.'}</p>
          <button type="button" className="botao botao-secundario acima-2" onClick={recarregar}>
            Tentar novamente
          </button>
        </div>
      )}

      <dialog
        className="comentarios"
        id={painelId}
        ref={refComentarios}
        aria-label={`Comentários do vídeo de ${artesao?.nome ?? 'artesão'}`}
        onClose={() => {
          if (!refComentarios.current?.open) definirAberto(false)
        }}
      >
        <div className="comentarios-topo">
            <div className="encolhivel">
              <h3 className="secao-titulo" style={{ fontFamily: 'var(--fonte)', fontSize: 17, fontWeight: 700, margin: 0 }}>
                {emMilhares(totalComentarios)} comentários
              </h3>
              <p className="video-metricas">
                {emMilhares(video.visualizacoes)} visualizações · {video.duracao} · {video.publicadoEm}
              </p>
            </div>
            <button type="button" className="botao-texto" onClick={fecharComentarios}>
              Fechar
            </button>
          </div>

          {leituraComentarios === 'carregando' && <p className="campo-ajuda acima-3" role="status">Carregando comentários…</p>}
          {leituraComentarios === 'erro' && (
            <div className="acima-3">
              <p className="campo-erro" role="alert">{erroComentarios}</p>
              <button type="button" className="botao botao-secundario acima-2" onClick={() => void carregarComentarios()}>
                Tentar novamente
              </button>
            </div>
          )}
          {leituraComentarios === 'pronto' && lista.length === 0 && (
            <p className="campo-ajuda acima-3">Nenhum comentário ainda. Comece a conversa.</p>
          )}
          <ul className="lista-comentarios" aria-busy={leituraComentarios === 'carregando'}>
            {lista.map((c) => (
              <li className="comentario" key={c.id ?? c.autor + c.quando + c.texto}>
                <span className="comentario-inicial" aria-hidden>
                  {c.autor.charAt(0)}
                </span>
                <div className="encolhivel">
                  <p className="comentario-cabeca">
                    <span className="comentario-autor">{c.autor}</span>
                    {c.artesao && (
                      <span className="selo selo-neutro">
                        <IconeSelo tamanho={11} />
                        artesão
                      </span>
                    )}
                    <span className="dado-rotulo">{c.quando}</span>
                  </p>
                  <p className="comentario-texto">{c.texto}</p>
                  <p className="comentario-acoes">
                    <span>{c.curtidas} curtidas</span>
                    <button type="button" onClick={() => responder(c.autor)}>
                      Responder
                    </button>
                  </p>

                  {c.resposta && artesao && (
                    <div className="resposta">
                      <Retrato imagem={artesao.imagem} tamanho={28} />
                      <div className="encolhivel">
                        <p className="comentario-cabeca">
                          <span className="comentario-autor">{artesao.nome}</span>
                          <span className="selo selo-encomenda">autor do vídeo</span>
                          <span className="dado-rotulo">{c.resposta.quando}</span>
                        </p>
                        <p className="comentario-texto">{c.resposta.texto}</p>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {sessao ? (
            <form className="novo-comentario" onSubmit={enviarComentario}>
              <label className="so-leitor" htmlFor={`escrever-${video.id}`}>
                Escrever um comentário
              </label>
              <input
                id={`escrever-${video.id}`}
                ref={campoComentario}
                placeholder="Comente algo gentil ou faça uma pergunta..."
                value={rascunho}
                maxLength={TAMANHO_MAXIMO_COMENTARIO}
                aria-describedby={pertoDoLimite ? `contador-${video.id}` : undefined}
                onChange={(evento) => definirRascunho(evento.target.value)}
              />
              <button disabled={salvando || leituraComentarios !== 'pronto'} type="submit" className="botao botao-primario" style={{ padding: '0 18px' }}>
                Enviar
              </button>
              {pertoDoLimite && (
                <span
                  className="dado-rotulo"
                  style={{ alignSelf: 'center' }}
                  id={`contador-${video.id}`}
                  aria-live="polite"
                  aria-label={`${rascunho.length} de ${TAMANHO_MAXIMO_COMENTARIO} caracteres`}
                >
                  {rascunho.length}/{TAMANHO_MAXIMO_COMENTARIO}
                </span>
              )}
            </form>
          ) : (
            <p className="novo-comentario">
              <Link href={rotaDeLogin(`${caminho}#${video.id}`)} className="botao botao-primario">
                Entre para comentar
              </Link>
            </p>
          )}
      </dialog>
    </article>
  )
}
