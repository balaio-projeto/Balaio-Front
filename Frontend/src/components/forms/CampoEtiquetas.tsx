'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { IconeFechar } from '@/components/ui/Icones'
import {
  QUANTIDADE_MAXIMA_ETIQUETAS, acaoDaTeclaNaEtiqueta, descreverRecusas, etiquetasComoTexto, incluirEtiquetas,
  normalizarEtiquetas, removerEtiqueta, separarDigitacao, temSeparadorDeEtiqueta,
} from '@/utils/etiquetas'

type Props = {
  id: string
  nome: string
  rotulo: string
  iniciais?: readonly string[]
  erro?: string
}

export default function CampoEtiquetas({ id, nome, rotulo, iniciais = [], erro }: Props) {
  const campo = useRef<HTMLInputElement>(null)
  const [etiquetas, definirEtiquetas] = useState<string[]>(() => normalizarEtiquetas(etiquetasComoTexto(iniciais)))
  const [rascunho, definirRascunho] = useState('')
  const [aviso, definirAviso] = useState<string | null>(null)
  const cheio = etiquetas.length >= QUANTIDADE_MAXIMA_ETIQUETAS
  const idAjuda = `${id}-ajuda`
  const idContador = `${id}-contador`
  const idAviso = `${id}-aviso`
  const idErro = `${id}-erro`
  const descricao = [erro && idErro, aviso && idAviso, idAjuda, idContador].filter(Boolean).join(' ')

  function confirmar(texto: string, restante = '') {
    const inclusao = incluirEtiquetas(etiquetas, texto)
    definirEtiquetas(inclusao.etiquetas)
    definirRascunho([inclusao.pendente, restante].filter(Boolean).join(' '))
    definirAviso(descreverRecusas(inclusao.recusadas))
  }

  function remover(etiqueta: string) {
    definirEtiquetas((atuais) => removerEtiqueta(atuais, etiqueta))
    definirAviso(null)
    campo.current?.focus()
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    const acao = acaoDaTeclaNaEtiqueta(evento.key, rascunho, evento.nativeEvent.isComposing)
    if (acao === 'confirmar') {
      evento.preventDefault()
      if (rascunho.trim()) confirmar(rascunho)
    } else if (acao === 'removerUltima' && etiquetas.length > 0) {
      evento.preventDefault()
      definirEtiquetas((atuais) => atuais.slice(0, -1))
      definirAviso(null)
    }
  }

  function aoDigitar(valor: string) {
    const separada = separarDigitacao(valor)
    if (separada) confirmar(separada.confirmar, separada.restante)
    else definirRascunho(valor)
  }

  function aoColar(evento: ClipboardEvent<HTMLInputElement>) {
    const colado = evento.clipboardData.getData('text')
    if (!temSeparadorDeEtiqueta(colado.trim())) return
    evento.preventDefault()
    confirmar(`${rascunho} ${colado}`)
  }

  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>{rotulo}</label>
      <span className="campo-ajuda" id={idAjuda}>
        Digite e confirme com Enter, vírgula ou espaço. Backspace apaga a última.
      </span>
      <div
        className={`campo-etiquetas${erro ? ' campo-etiquetas-invalido' : ''}`}
        onClick={(evento) => { if (evento.target === evento.currentTarget) campo.current?.focus() }}
      >
        {etiquetas.length > 0 && (
          <ul className="etiquetas-chips" aria-label="Etiquetas adicionadas">
            {etiquetas.map((etiqueta) => (
              <li className="etiqueta-chip" key={etiqueta}>
                <span>#{etiqueta}</span>
                <button
                  type="button"
                  className="etiqueta-chip-remover"
                  aria-label={`Remover etiqueta ${etiqueta}`}
                  onClick={() => remover(etiqueta)}
                >
                  <IconeFechar tamanho={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={campo}
          id={id}
          type="text"
          className="campo-etiquetas-entrada"
          value={rascunho}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="enter"
          placeholder={cheio ? 'Limite de etiquetas atingido' : etiquetas.length === 0 ? 'ceramica, tracunhaem, passo-a-passo' : 'Mais uma etiqueta'}
          aria-describedby={descricao}
          aria-invalid={erro ? true : undefined}
          onChange={(evento) => aoDigitar(evento.target.value)}
          onKeyDown={aoTeclar}
          onPaste={aoColar}
          onBlur={() => { if (rascunho.trim()) confirmar(rascunho) }}
        />
      </div>
      <input type="hidden" name={nome} value={etiquetasComoTexto([...etiquetas, rascunho.trim()])} />
      <span className={`etiquetas-contador${cheio ? ' etiquetas-contador-cheio' : ''}`} id={idContador} aria-live="polite">
        {etiquetas.length} de {QUANTIDADE_MAXIMA_ETIQUETAS}
      </span>
      {aviso && <span className="campo-erro" id={idAviso} role="status">{aviso}</span>}
      {erro && <span className="campo-erro" id={idErro} role="status">{erro}</span>}
    </div>
  )
}
