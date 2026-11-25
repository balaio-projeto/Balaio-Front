'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import CamposVideo, { type PecaVinculavel } from '@/components/forms/CamposVideo'
import { avisar } from '@/components/feedback/Avisos'
import { atualizarVideo } from '@/services/api/videos.servico'
import type { Video } from '@/types/dominio'
import { lerCamposVideo, type ErrosCamposVideo } from '@/utils/etiquetas'

type Situacao = NonNullable<Video['situacao']>

const AVISO_POR_SITUACAO: Record<Situacao, string> = {
  publicada: 'Vídeo publicado',
  rascunho: 'Rascunho salvo',
}

export default function FormEditarVideo({ video, pecas }: { video: Video; pecas: PecaVinculavel[] }) {
  const roteador = useRouter()
  const formulario = useRef<HTMLFormElement>(null)
  const [salvando, definirSalvando] = useState(false)
  const [erros, definirErros] = useState<ErrosCamposVideo>({ legenda: null, etiquetas: null })
  const situacaoAtual: Situacao = video.situacao ?? 'publicada'
  const rascunho = situacaoAtual === 'rascunho'

  async function salvar(situacao: Situacao) {
    if (salvando) return
    const dados = new FormData(formulario.current!)
    const campos = lerCamposVideo(String(dados.get('legenda') ?? ''), String(dados.get('etiquetas') ?? ''))
    definirErros(campos.erros)
    if (!campos.valido) {
      document.getElementById(campos.erros.legenda ? 'video-legenda' : 'video-etiquetas')?.focus()
      avisar.erro('Confira os campos destacados')
      return
    }

    definirSalvando(true)
    const resposta = await atualizarVideo(video.id, {
      legenda: campos.legenda,
      etiquetas: campos.etiquetas,
      peca: String(dados.get('peca') ?? ''),
      situacao,
    })
    definirSalvando(false)
    if (resposta.erro) {
      avisar.erro('Não foi possível salvar', resposta.erro.mensagem)
      return
    }
    if (video.suspensao) avisar.sucesso('Alterações salvas', 'O vídeo continua suspenso até a reativação pela administração.')
    else avisar.sucesso(situacao === situacaoAtual && !rascunho ? 'Alterações salvas' : AVISO_POR_SITUACAO[situacao])
    roteador.push('/dashboard/videos')
    roteador.refresh()
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    void salvar(rascunho ? 'publicada' : situacaoAtual)
  }

  return (
    <form ref={formulario} onSubmit={enviar} noValidate>
      <section className="cartao">
        <CamposVideo pecas={pecas} erroLegenda={erros.legenda} erroEtiquetas={erros.etiquetas} video={video} />

        <div className="acoes-linha">
          <button type="submit" className="botao botao-primario" disabled={salvando}>
            {rascunho ? 'Publicar' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            className="botao botao-fantasma"
            disabled={salvando}
            onClick={() => void salvar('rascunho')}
          >
            {rascunho ? 'Salvar rascunho' : 'Voltar para rascunho'}
          </button>
          <Link href="/dashboard/videos" className="botao botao-fantasma">Cancelar</Link>
        </div>
      </section>
    </form>
  )
}
