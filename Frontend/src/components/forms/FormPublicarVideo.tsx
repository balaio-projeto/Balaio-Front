'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import CamposVideo, { type PecaVinculavel } from '@/components/forms/CamposVideo'
import { avisar } from '@/components/feedback/Avisos'
import { IconePincel } from '@/components/ui/Icones'
import {
  publicarVideo, type DestinoDoVideo, type EtapaPublicacao, type ResultadoPublicacao,
} from '@/services/api/publicacaoVideo'
import { TIPOS_DE_VIDEO } from '@/services/api/videos.servico'
import { useSessao } from '@/store/sessao'
import { DESCRICAO_LIMITE_VIDEO, problemaDoArquivoDeVideo } from '@/utils/midiaVideo'
import { validarObrigatorio } from '@/utils/validacao'

const ROTULO_ETAPA: Record<EtapaPublicacao, string> = {
  preparando: 'Lendo o vídeo…',
  enviando: 'Enviando o vídeo…',
  publicando: 'Publicando…',
}

const SUCESSO: Record<DestinoDoVideo, string> = {
  publicar: 'Vídeo publicado',
  rascunho: 'Rascunho salvo',
}

function etiquetasDoTexto(texto: string): string[] {
  return texto.split(/\s+/).map((etiqueta) => etiqueta.replace(/^#+/, '')).filter(Boolean)
}

export default function FormPublicarVideo({ pecas }: { pecas: PecaVinculavel[] }) {
  const roteador = useRouter()
  const { sessao } = useSessao()
  const formulario = useRef<HTMLFormElement>(null)
  const [etapa, definirEtapa] = useState<EtapaPublicacao | null>(null)
  const [arquivo, definirArquivo] = useState<File | null>(null)
  const [erroLegenda, definirErroLegenda] = useState<string | null>(null)
  const [erroArquivo, definirErroArquivo] = useState<string | null>(null)
  const ocupado = etapa !== null

  function validar(): boolean {
    const dados = new FormData(formulario.current ?? undefined)
    const problemaLegenda = validarObrigatorio(
      String(dados.get('legenda') ?? ''),
      'Escreva uma legenda contando o que aparece na cena',
    )
    const problemaArquivo = problemaDoArquivoDeVideo(arquivo)
    definirErroLegenda(problemaLegenda)
    definirErroArquivo(problemaArquivo)
    if (problemaLegenda || problemaArquivo) {
      document.getElementById(problemaArquivo ? 'video-arquivo' : 'video-legenda')?.focus()
      avisar.erro('Confira os campos destacados')
      return false
    }
    return true
  }

  function comunicar(resultado: ResultadoPublicacao, destino: DestinoDoVideo) {
    switch (resultado.tipo) {
      case 'arquivoIlegivel':
        definirErroArquivo('Não foi possível ler este vídeo. Tente outro arquivo.')
        avisar.erro('Não foi possível ler o vídeo')
        return
      case 'falhou':
        avisar.erro(resultado.titulo, resultado.mensagem)
        return
      case 'ficouRascunho':
        avisar.erro('O vídeo foi salvo como rascunho, mas não foi publicado', resultado.mensagem)
        roteador.refresh()
        return
      case 'concluida':
        formulario.current?.reset()
        definirArquivo(null)
        avisar.sucesso(SUCESSO[destino], resultado.capaGerada ? undefined : 'A capa não foi gerada; o vídeo usa a imagem padrão.')
        roteador.refresh()
    }
  }

  async function salvar(destino: DestinoDoVideo) {
    if (ocupado || !validar() || !sessao?.artesao || !arquivo) return
    const dados = new FormData(formulario.current!)
    try {
      const resultado = await publicarVideo(arquivo, {
        legenda: String(dados.get('legenda')).trim(),
        etiquetas: etiquetasDoTexto(String(dados.get('etiquetas') ?? '')),
        peca: String(dados.get('peca') ?? ''),
      }, destino, definirEtapa)
      comunicar(resultado, destino)
    } finally {
      definirEtapa(null)
    }
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    void salvar('publicar')
  }

  return (
    <form ref={formulario} onSubmit={aoEnviar} noValidate aria-busy={ocupado}>
      <section className="cartao abaixo-5">
        <label className="area-upload" htmlFor="video-arquivo" style={{ display: 'block', cursor: 'pointer' }}>
          <span className="estado-vazio-icone" style={{ width: 64, height: 64, marginBottom: 12 }}>
            <IconePincel tamanho={26} />
          </span>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--tinta)' }}>
            {arquivo ? arquivo.name : 'Toque para escolher o vídeo'}
          </span>
          <span className="campo-ajuda">{DESCRICAO_LIMITE_VIDEO}</span>
          <input
            id="video-arquivo"
            type="file"
            accept={TIPOS_DE_VIDEO.join(',')}
            className="so-leitor"
            disabled={ocupado}
            aria-invalid={Boolean(erroArquivo)}
            aria-describedby={erroArquivo ? 'video-arquivo-erro' : undefined}
            onChange={(evento) => {
              const escolhido = evento.target.files?.[0] ?? null
              definirArquivo(escolhido)
              definirErroArquivo(escolhido ? problemaDoArquivoDeVideo(escolhido) : null)
            }}
          />
        </label>
        {erroArquivo && <p className="campo-erro acima-2" id="video-arquivo-erro" role="alert">{erroArquivo}</p>}

        <CamposVideo pecas={pecas} erroLegenda={erroLegenda} />

        {etapa && <p className="campo-ajuda" role="status">{ROTULO_ETAPA[etapa]}</p>}

        <div className="acoes-linha">
          <button disabled={ocupado} type="submit" className="botao botao-primario">
            Publicar
          </button>
          <button type="button" className="botao botao-fantasma" disabled={ocupado} onClick={() => void salvar('rascunho')}>
            Salvar rascunho
          </button>
        </div>
      </section>
    </form>
  )
}
