'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'

export type FotoAmpliavel = { id: string; url: string; nome: string }

type Props = {
  fotos: FotoAmpliavel[]
  indiceInicial: number
  titulo: string
  aoFechar: (indiceFinal: number) => void
}

type Ponto = { x: number; y: number }
type Vista = { escala: number; x: number; y: number }

const ESCALA_MINIMA = 1
const ESCALA_MAXIMA = 4
const ESCALA_DO_DUPLO_TOQUE = 2.5
const FATOR_DOS_BOTOES = 1.5
const INTERVALO_DUPLO_TOQUE_MS = 320
const DISTANCIA_DUPLO_TOQUE = 28
const MOVIMENTO_DE_TOQUE_SIMPLES = 8
const DISTANCIA_PARA_DESLIZAR = 60
const VISTA_INICIAL: Vista = { escala: 1, x: 0, y: 0 }
const SELETOR_FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function distancia(a: Ponto, b: Ponto) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function centro(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export default function VisualizadorFotos({ fotos, indiceInicial, titulo, aoFechar }: Props) {
  const refDialogo = useRef<HTMLDialogElement>(null)
  const refPalco = useRef<HTMLDivElement>(null)
  const refImagem = useRef<HTMLImageElement>(null)
  const refFechar = useRef<HTMLButtonElement>(null)
  const [indice, definirIndice] = useState(() => limitar(indiceInicial, 0, Math.max(0, fotos.length - 1)))
  const [vista, definirVista] = useState<Vista>(VISTA_INICIAL)
  const [emGesto, definirEmGesto] = useState(false)
  const [fotosQueFalharam, definirFotosQueFalharam] = useState<ReadonlySet<string>>(() => new Set())
  const vistaAtual = useRef<Vista>(VISTA_INICIAL)
  const indiceAtual = useRef(indice)
  const ponteiros = useRef(new Map<number, Ponto>())
  const pinca = useRef<{ distancia: number; centro: Ponto } | null>(null)
  const inicioDoToque = useRef<Ponto | null>(null)
  const movimentoTotal = useRef(0)
  const ultimoToque = useRef<{ tempo: number; ponto: Ponto } | null>(null)

  const foto = fotos[indice]
  const variasFotos = fotos.length > 1
  const ampliada = vista.escala > ESCALA_MINIMA

  function ajustarVista(proxima: Vista): Vista {
    const escala = limitar(proxima.escala, ESCALA_MINIMA, ESCALA_MAXIMA)
    const palco = refPalco.current
    const imagem = refImagem.current
    if (escala <= ESCALA_MINIMA + 0.001 || !palco || !imagem) return VISTA_INICIAL
    const folgaX = Math.max(0, (imagem.offsetWidth * escala - palco.clientWidth) / 2)
    const folgaY = Math.max(0, (imagem.offsetHeight * escala - palco.clientHeight) / 2)
    return { escala, x: limitar(proxima.x, -folgaX, folgaX), y: limitar(proxima.y, -folgaY, folgaY) }
  }

  function aplicarVista(proxima: Vista) {
    const ajustada = ajustarVista(proxima)
    vistaAtual.current = ajustada
    definirVista(ajustada)
  }

  function ampliarEm(ponto: Ponto, novaEscala: number, base: Vista = vistaAtual.current) {
    const escala = limitar(novaEscala, ESCALA_MINIMA, ESCALA_MAXIMA)
    const proporcao = escala / base.escala
    aplicarVista({
      escala,
      x: ponto.x - (ponto.x - base.x) * proporcao,
      y: ponto.y - (ponto.y - base.y) * proporcao,
    })
  }

  function pontoNoPalco(clienteX: number, clienteY: number): Ponto {
    const palco = refPalco.current
    if (!palco) return { x: 0, y: 0 }
    const caixa = palco.getBoundingClientRect()
    return { x: clienteX - caixa.left - caixa.width / 2, y: clienteY - caixa.top - caixa.height / 2 }
  }

  function irPara(proximo: number) {
    if (!variasFotos) return
    const total = fotos.length
    const ajustado = ((proximo % total) + total) % total
    indiceAtual.current = ajustado
    definirIndice(ajustado)
    vistaAtual.current = VISTA_INICIAL
    definirVista(VISTA_INICIAL)
  }

  function alternarZoom(ponto: Ponto) {
    if (vistaAtual.current.escala > ESCALA_MINIMA) aplicarVista(VISTA_INICIAL)
    else ampliarEm(ponto, ESCALA_DO_DUPLO_TOQUE)
  }

  function fechar() {
    refDialogo.current?.close()
  }

  useEffect(() => {
    const dialogo = refDialogo.current
    if (!dialogo) return
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raiz = document.documentElement
    const overflowAnterior = raiz.style.overflow
    const recuoAnterior = document.body.style.paddingRight
    const larguraDaBarra = window.innerWidth - raiz.clientWidth
    raiz.style.overflow = 'hidden'
    if (larguraDaBarra > 0) document.body.style.paddingRight = `${larguraDaBarra}px`
    if (!dialogo.open) dialogo.showModal()
    refFechar.current?.focus()
    return () => {
      raiz.style.overflow = overflowAnterior
      document.body.style.paddingRight = recuoAnterior
      if (dialogo.open) dialogo.close()
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const palco = refPalco.current
    if (!palco) return
    function aoRolar(evento: WheelEvent) {
      const atual = vistaAtual.current
      if (evento.ctrlKey || evento.metaKey) {
        evento.preventDefault()
        ampliarEm(pontoNoPalco(evento.clientX, evento.clientY), atual.escala * Math.exp(-evento.deltaY * 0.01))
        return
      }
      if (atual.escala <= ESCALA_MINIMA) return
      evento.preventDefault()
      aplicarVista({ ...atual, x: atual.x - evento.deltaX, y: atual.y - evento.deltaY })
    }
    palco.addEventListener('wheel', aoRolar, { passive: false })
    return () => palco.removeEventListener('wheel', aoRolar)
  })

  function aoPressionar(evento: PointerEvent<HTMLDivElement>) {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return
    evento.currentTarget.setPointerCapture(evento.pointerId)
    const ponto = { x: evento.clientX, y: evento.clientY }
    ponteiros.current.set(evento.pointerId, ponto)
    definirEmGesto(true)
    if (ponteiros.current.size === 1) {
      movimentoTotal.current = 0
      inicioDoToque.current = ponto
    }
    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      pinca.current = { distancia: distancia(a, b), centro: pontoNoPalco(centro(a, b).x, centro(a, b).y) }
      inicioDoToque.current = null
      movimentoTotal.current = Infinity
    }
  }

  function aoMover(evento: PointerEvent<HTMLDivElement>) {
    const anterior = ponteiros.current.get(evento.pointerId)
    if (!anterior) return
    const ponto = { x: evento.clientX, y: evento.clientY }
    ponteiros.current.set(evento.pointerId, ponto)

    if (ponteiros.current.size >= 2 && pinca.current) {
      const [a, b] = [...ponteiros.current.values()]
      const novaDistancia = distancia(a, b)
      const novoCentro = pontoNoPalco(centro(a, b).x, centro(a, b).y)
      const atual = vistaAtual.current
      const escala = limitar(atual.escala * (novaDistancia / Math.max(1, pinca.current.distancia)), ESCALA_MINIMA, ESCALA_MAXIMA)
      const proporcao = escala / atual.escala
      aplicarVista({
        escala,
        x: novoCentro.x - (pinca.current.centro.x - atual.x) * proporcao,
        y: novoCentro.y - (pinca.current.centro.y - atual.y) * proporcao,
      })
      pinca.current = { distancia: novaDistancia, centro: novoCentro }
      return
    }

    const deslocamentoX = ponto.x - anterior.x
    const deslocamentoY = ponto.y - anterior.y
    movimentoTotal.current += Math.abs(deslocamentoX) + Math.abs(deslocamentoY)
    const atual = vistaAtual.current
    if (atual.escala > ESCALA_MINIMA) aplicarVista({ ...atual, x: atual.x + deslocamentoX, y: atual.y + deslocamentoY })
  }

  function aoSoltar(evento: PointerEvent<HTMLDivElement>) {
    if (!ponteiros.current.has(evento.pointerId)) return
    ponteiros.current.delete(evento.pointerId)
    if (ponteiros.current.size < 2) pinca.current = null
    if (ponteiros.current.size > 0) return
    definirEmGesto(false)

    const inicio = inicioDoToque.current
    inicioDoToque.current = null
    if (evento.type === 'pointercancel' || !inicio) return

    const ponto = { x: evento.clientX, y: evento.clientY }
    const deslocamentoX = ponto.x - inicio.x
    const deslocamentoY = ponto.y - inicio.y
    if (vistaAtual.current.escala <= ESCALA_MINIMA && Math.abs(deslocamentoX) > DISTANCIA_PARA_DESLIZAR && Math.abs(deslocamentoX) > Math.abs(deslocamentoY) * 1.5) {
      ultimoToque.current = null
      irPara(indiceAtual.current + (deslocamentoX < 0 ? 1 : -1))
      return
    }
    if (movimentoTotal.current > MOVIMENTO_DE_TOQUE_SIMPLES) {
      ultimoToque.current = null
      return
    }
    const agora = evento.timeStamp
    const anterior = ultimoToque.current
    if (anterior && agora - anterior.tempo < INTERVALO_DUPLO_TOQUE_MS && distancia(anterior.ponto, ponto) < DISTANCIA_DUPLO_TOQUE) {
      ultimoToque.current = null
      alternarZoom(pontoNoPalco(ponto.x, ponto.y))
      return
    }
    ultimoToque.current = { tempo: agora, ponto }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDialogElement>) {
    if (evento.key === 'Tab') {
      const focaveis = [...(refDialogo.current?.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS) ?? [])]
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement
      if (evento.shiftKey && (ativo === primeiro || !refDialogo.current?.contains(ativo))) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && (ativo === ultimo || !refDialogo.current?.contains(ativo))) {
        evento.preventDefault()
        primeiro.focus()
      }
      return
    }
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      irPara(indiceAtual.current - 1)
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      irPara(indiceAtual.current + 1)
    } else if (evento.key === '+' || evento.key === '=') {
      evento.preventDefault()
      ampliarEm({ x: 0, y: 0 }, vistaAtual.current.escala * FATOR_DOS_BOTOES)
    } else if (evento.key === '-' || evento.key === '_') {
      evento.preventDefault()
      ampliarEm({ x: 0, y: 0 }, vistaAtual.current.escala / FATOR_DOS_BOTOES)
    } else if (evento.key === '0') {
      evento.preventDefault()
      aplicarVista(VISTA_INICIAL)
    }
  }

  if (!foto) return null
  const falhou = fotosQueFalharam.has(foto.id)
  const percentual = Math.round(vista.escala * 100)

  return (
    <dialog
      ref={refDialogo}
      className="visualizador-fotos"
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${titulo}`}
      onKeyDown={aoTeclar}
      onClose={() => {
        if (refDialogo.current?.open) return
        aoFechar(indiceAtual.current)
      }}
    >
      <div className="visualizador-topo">
        <p className="visualizador-contador" aria-live="polite">
          {variasFotos ? `${titulo} · foto ${indice + 1} de ${fotos.length}` : titulo}
        </p>
        <div className="visualizador-ferramentas">
          <button
            type="button"
            className="visualizador-botao"
            aria-label="Diminuir zoom"
            disabled={vista.escala <= ESCALA_MINIMA || falhou}
            onClick={() => ampliarEm({ x: 0, y: 0 }, vista.escala / FATOR_DOS_BOTOES)}
          >
            <ZoomOut size={20} aria-hidden focusable={false} />
          </button>
          <span className="visualizador-zoom" aria-live="polite">
            <span className="so-leitor">Zoom: </span>
            {percentual}%
          </span>
          <button
            type="button"
            className="visualizador-botao"
            aria-label="Aumentar zoom"
            disabled={vista.escala >= ESCALA_MAXIMA || falhou}
            onClick={() => ampliarEm({ x: 0, y: 0 }, vista.escala * FATOR_DOS_BOTOES)}
          >
            <ZoomIn size={20} aria-hidden focusable={false} />
          </button>
          <button ref={refFechar} type="button" className="visualizador-botao visualizador-fechar" onClick={fechar}>
            <X size={20} aria-hidden focusable={false} />
            <span>Fechar</span>
          </button>
        </div>
      </div>

      <div
        ref={refPalco}
        className={`visualizador-palco${ampliada ? ' visualizador-palco-ampliado' : ''}${emGesto ? ' visualizador-palco-em-gesto' : ''}`}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        {falhou ? (
          <p className="visualizador-falha">Não foi possível carregar esta foto.</p>
        ) : (
          <img
            key={foto.id}
            ref={refImagem}
            className="visualizador-imagem"
            src={foto.url}
            alt={variasFotos ? `${titulo}, foto ${indice + 1} de ${fotos.length}` : titulo}
            draggable={false}
            onError={() => definirFotosQueFalharam((atuais) => new Set(atuais).add(foto.id))}
            style={{ transform: `translate3d(${vista.x}px, ${vista.y}px, 0) scale(${vista.escala})` }}
          />
        )}
      </div>

      {variasFotos && (
        <>
          <button
            type="button"
            className="visualizador-botao visualizador-navegar visualizador-anterior"
            aria-label="Foto anterior"
            onClick={() => irPara(indice - 1)}
          >
            <ChevronLeft size={26} aria-hidden focusable={false} />
          </button>
          <button
            type="button"
            className="visualizador-botao visualizador-navegar visualizador-proxima"
            aria-label="Próxima foto"
            onClick={() => irPara(indice + 1)}
          >
            <ChevronRight size={26} aria-hidden focusable={false} />
          </button>
        </>
      )}

      <p className="visualizador-dica" aria-hidden>
        <span className="visualizador-dica-toque">Toque duas vezes ou use a pinça para ampliar</span>
        <span className="visualizador-dica-mouse">Clique duas vezes ou use Ctrl + roda do mouse para ampliar · ← → para trocar de foto</span>
      </p>
    </dialog>
  )
}
