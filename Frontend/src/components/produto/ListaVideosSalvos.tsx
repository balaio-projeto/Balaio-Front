'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import { avisar } from '@/components/feedback/Avisos'
import { Retrato } from '@/components/ui/Basicos'
import ImagemComFallback from '@/components/ui/ImagemComFallback'
import { IconeMarcador, IconePlay } from '@/components/ui/Icones'
import { obterVideo } from '@/services/api/videos.servico'
import { useEstadoCliente } from '@/store/estadoCliente'
import { useDados } from '@/store/dados'
import { useItemDaColecao } from '@/hooks/useItemDaColecao'
import type { Video } from '@/types/dominio'

type VideoSalvo =
  | { tipo: 'disponivel'; video: Video }
  | { tipo: 'indisponivel' }
  | { tipo: 'erro'; mensagem: string }

const STATUS_DE_VIDEO_INEXISTENTE = [400, 404]

async function consultarVideoSalvo(id: string): Promise<[string, VideoSalvo]> {
  try {
    const { dados, erro } = await obterVideo(id)
    if (dados) return [id, dados.situacao === 'rascunho' ? { tipo: 'indisponivel' } : { tipo: 'disponivel', video: dados }]
    if (erro?.status && STATUS_DE_VIDEO_INEXISTENTE.includes(erro.status)) return [id, { tipo: 'indisponivel' }]
    return [id, { tipo: 'erro', mensagem: erro?.mensagem ?? 'Não foi possível carregar este vídeo.' }]
  } catch {
    return [id, { tipo: 'erro', mensagem: 'Não foi possível carregar este vídeo.' }]
  }
}

function BotaoRemoverVideo({ id, rotulo }: { id: string; rotulo: string }) {
  const salvo = useItemDaColecao('videosSalvos', id, 'Não foi possível atualizar os vídeos salvos')

  async function remover() {
    if ((await salvo.alternar()) === false) avisar.info('Vídeo removido dos salvos')
  }

  return (
    <button type="button" className="botao-texto botao-texto-perigo acima-3" onClick={() => void remover()}
      disabled={!salvo.disponivel} aria-label={rotulo}>
      Remover dos salvos
    </button>
  )
}

function CartaoVideoSalvo({ video }: { video: Video }) {
  const { artesaos, carregando } = useDados()
  const artesao = artesaos.find((a) => a.slug === video.artesao)

  return (
    <article className="cartao-peca">
      <div className="cartao-peca-figura">
        <ImagemComFallback src={video.capa} alt="" loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          semImagem={<span className="capa-video-vazia" aria-hidden><IconePlay tamanho={40} /></span>} />
        <span className="video-duracao">{video.duracao}</span>
      </div>
      <div className="cartao-peca-corpo">
        <span className="territorio">Publicado em {video.publicadoEm}</span>
        <h3 className="cartao-peca-nome">
          <Link href={`/videos#${encodeURIComponent(video.id)}`} className="cartao-peca-link">
            {video.legenda || 'Vídeo do ateliê'}
          </Link>
        </h3>
        <span className="autoria autoria-com-retrato" data-carregando={carregando || undefined}>
          <Retrato imagem={artesao?.imagem} tamanho={20} />
          por {artesao?.nome ?? 'Artesão parceiro'}
        </span>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <BotaoRemoverVideo id={video.id} rotulo={`Remover o vídeo ${video.legenda} dos salvos`} />
        </div>
      </div>
    </article>
  )
}

function CartaoVideoIndisponivel({ id }: { id: string }) {
  return (
    <article className="cartao-peca" data-indisponivel>
      <div className="cartao-peca-figura">
        <span className="capa-video-vazia" aria-hidden><IconePlay tamanho={40} /></span>
      </div>
      <div className="cartao-peca-corpo">
        <span className="selo selo-neutro">
          <span className="selo-ponto" />
          Indisponível
        </span>
        <h3 className="cartao-peca-nome">Vídeo indisponível</h3>
        <p className="autoria">O ateliê removeu este vídeo ou deixou de publicá-lo.</p>
        <BotaoRemoverVideo id={id} rotulo="Remover vídeo indisponível dos salvos" />
      </div>
    </article>
  )
}

export default function ListaVideosSalvos() {
  const { estado, pronto, erro: erroEstado, recarregar } = useEstadoCliente()
  const [consultados, definirConsultados] = useState<ReadonlyMap<string, VideoSalvo>>(new Map())
  const ids = useMemo(() => [...new Set(estado?.videosSalvos ?? [])], [estado])
  const chaveConsulta = ids.filter((id) => !consultados.has(id)).join('\n')

  useEffect(() => {
    if (!chaveConsulta) return
    let vivo = true
    void Promise.all(chaveConsulta.split('\n').map(consultarVideoSalvo)).then((entradas) => {
      if (vivo) definirConsultados((atuais) => new Map([...atuais, ...entradas]))
    })
    return () => { vivo = false }
  }, [chaveConsulta])

  function tentarNovamente() {
    definirConsultados((atuais) => new Map([...atuais].filter(([, salvo]) => salvo.tipo !== 'erro')))
  }

  if (!pronto) return <EstadoCarregando rotulo="Carregando vídeos salvos…" cartoes={3} />
  if (!estado) return <EstadoErro mensagem={erroEstado ?? 'Não foi possível carregar seus vídeos salvos.'} aoTentarNovamente={recarregar} />

  if (ids.length === 0) {
    return (
      <EstadoVazio
        icone={<IconeMarcador tamanho={34} />}
        titulo="Você ainda não salvou nenhum vídeo"
        descricao="No Ateliê ao vivo, toque em Salvar para guardar um vídeo e assistir depois."
        acao={<Link href="/videos" className="botao botao-primario">Ver o Ateliê ao vivo</Link>}
      />
    )
  }

  if (chaveConsulta) return <EstadoCarregando rotulo="Carregando vídeos salvos…" cartoes={Math.min(ids.length, 6)} />

  const resultados = ids.map((id) => ({ id, salvo: consultados.get(id)! }))
  const disponiveis = resultados.flatMap(({ salvo }) => salvo.tipo === 'disponivel' ? [salvo.video] : [])
  const indisponiveis = resultados.filter(({ salvo }) => salvo.tipo === 'indisponivel').map(({ id }) => id)
  const falhas = resultados.flatMap(({ salvo }) => salvo.tipo === 'erro' ? [salvo.mensagem] : [])

  if (falhas.length === resultados.length) return <EstadoErro mensagem={falhas[0]} aoTentarNovamente={tentarNovamente} />

  return (
    <>
      {falhas.length > 0 && (
        <div className="aviso abaixo-4" role="alert">
          <span>
            {falhas.length === 1 ? 'Um vídeo salvo não pôde ser carregado agora.' : `${falhas.length} vídeos salvos não puderam ser carregados agora.`}
          </span>
          <button type="button" className="botao-texto" onClick={tentarNovamente}>Tentar novamente</button>
        </div>
      )}
      {disponiveis.length > 0 && (
        <div className="grade-pecas grade-pecas-compacta escalonado">
          {disponiveis.map((video) => <CartaoVideoSalvo key={video.id} video={video} />)}
        </div>
      )}
      {indisponiveis.length > 0 && (
        <section className="secao" aria-labelledby="videos-indisponiveis">
          <h2 className="secao-titulo" id="videos-indisponiveis">Indisponíveis</h2>
          <p className="texto-suave abaixo-4">Vídeos salvos que saíram do ar. Eles ficam aqui até você removê-los.</p>
          <div className="grade-pecas grade-pecas-compacta">
            {indisponiveis.map((id) => <CartaoVideoIndisponivel key={id} id={id} />)}
          </div>
        </section>
      )}
    </>
  )
}
