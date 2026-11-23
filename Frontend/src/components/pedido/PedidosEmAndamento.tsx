'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { Campo } from '@/components/ui/Basicos'
import EstadoErro from '@/components/feedback/EstadoErro'
import { avisar } from '@/components/feedback/Avisos'
import { IconeFechar } from '@/components/ui/Icones'
import { emReais } from '@/utils/formato'
import { atualizarEstadoPedido } from '@/services/api/pedidos.servico'
import { avisarPainelAtualizado } from '@/hooks/useArtesaoLogado'
import { validarRastreio } from '@/utils/painel'

export type PedidoEmAndamento = {
  id: string
  estado: 'producao' | 'enviado'
  pecaNome?: string
  quando: string
  valor: number
  rastreio?: string | null
  emDisputa?: boolean
}

export default function PedidosEmAndamento({ pedidos, erroCarregamento }: { pedidos: PedidoEmAndamento[]; erroCarregamento?: string }) {
  const roteador = useRouter()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [processando, definirProcessando] = useState<string | null>(null)
  const [pedidoEnvio, definirPedidoEnvio] = useState<PedidoEmAndamento | null>(null)
  const [rastreio, definirRastreio] = useState('')
  const [transportadora, definirTransportadora] = useState('')
  const [erroRastreio, definirErroRastreio] = useState<string | null>(null)

  async function avancar(pedido: PedidoEmAndamento, destino: 'enviado' | 'entregue', envio?: { rastreio: string; transportadora?: string }) {
    if (processando) return false
    definirProcessando(pedido.id)
    try {
      const resposta = await atualizarEstadoPedido(pedido.id, destino, envio)
      if (resposta.erro || resposta.dados?.estado !== destino) {
        avisar.erro('Não foi possível atualizar o pedido', resposta.erro?.mensagem)
        return false
      }
      avisarPainelAtualizado()
      roteador.refresh()
      avisar.sucesso(destino === 'enviado' ? 'Pedido marcado como enviado' : 'Pedido marcado como entregue',
        destino === 'enviado' ? 'O comprador já vê o código de rastreio.' : 'O comprador já pode avaliar a compra.')
      return true
    } finally {
      definirProcessando(null)
    }
  }

  function abrirEnvio(pedido: PedidoEmAndamento) {
    definirPedidoEnvio(pedido)
    definirRastreio('')
    definirTransportadora('')
    definirErroRastreio(null)
    dialogo.current?.showModal()
  }

  async function confirmarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!pedidoEnvio) return
    const problema = validarRastreio(rastreio)
    definirErroRastreio(problema)
    if (problema) return
    const ok = await avancar(pedidoEnvio, 'enviado', {
      rastreio: rastreio.trim(),
      ...(transportadora.trim() ? { transportadora: transportadora.trim() } : {}),
    })
    if (ok) dialogo.current?.close()
  }

  return (
    <section className="secao">
      <h2 className="secao-titulo">Pedidos em andamento</h2>
      {erroCarregamento && <EstadoErro mensagem={erroCarregamento} aoTentarNovamente={() => roteador.refresh()} />}
      {!erroCarregamento && pedidos.length === 0 && <p className="texto-suave">Nenhum pedido em produção ou a caminho do comprador.</p>}
      {pedidos.map((pedido) => (
        <article className="linha-pedido" key={pedido.id}>
          <div className="dado">
            <span className="dado-rotulo">Peça</span>
            <span className="dado-valor">{pedido.pecaNome ?? 'Peça do pedido'}</span>
          </div>
          <div className="dado">
            <span className="dado-rotulo">Pedido</span>
            <span className="dado-valor">{pedido.quando}</span>
          </div>
          <div className="dado">
            <span className="dado-rotulo">Valor</span>
            <span className="dado-valor preco-destaque">{emReais(pedido.valor)}</span>
          </div>
          <div className="acoes-linha">
            <span className={`selo ${pedido.estado === 'enviado' ? 'selo-neutro' : 'selo-encomenda'}`}>
              <span className="selo-ponto" />
              {pedido.estado === 'enviado' ? `Enviado${pedido.rastreio ? ` · ${pedido.rastreio}` : ''}` : 'Em produção'}
            </span>
            {pedido.emDisputa && (
              <Link href={`/dashboard/disputes#pedido-${pedido.id}`} className="botao botao-fantasma">Ver disputa</Link>
            )}
            {pedido.estado === 'producao' ? (
              <button type="button" className="botao botao-primario" disabled={processando !== null} onClick={() => abrirEnvio(pedido)}>
                Marcar como enviado
              </button>
            ) : (
              <button type="button" className="botao botao-sucesso" disabled={processando !== null} onClick={() => void avancar(pedido, 'entregue')}>
                {processando === pedido.id ? 'Salvando…' : 'Marcar como entregue'}
              </button>
            )}
          </div>
        </article>
      ))}

      <dialog className="modal" ref={dialogo} aria-labelledby="envio-titulo" onCancel={(evento) => { if (processando) evento.preventDefault() }}>
        <div className="modal-cabecalho">
          <h2 className="modal-titulo" id="envio-titulo">Registrar envio</h2>
          <button type="button" className="modal-fechar" aria-label="Fechar" disabled={processando !== null} onClick={() => dialogo.current?.close()}>
            <IconeFechar tamanho={20} />
          </button>
        </div>
        <form onSubmit={confirmarEnvio} noValidate>
          <p className="texto-suave abaixo-4">
            {pedidoEnvio?.pecaNome}. O comprador recebe o código de rastreio e acompanha a entrega pelo pedido.
          </p>
          <Campo rotulo="Código de rastreio" erro={erroRastreio ?? undefined} id="rastreio-envio">
            <input id="rastreio-envio" value={rastreio} maxLength={40} autoComplete="off" disabled={processando !== null}
              onChange={(evento) => definirRastreio(evento.target.value)} />
          </Campo>
          <Campo rotulo="Transportadora (opcional)" id="transportadora-envio">
            <input id="transportadora-envio" value={transportadora} maxLength={60} disabled={processando !== null}
              onChange={(evento) => definirTransportadora(evento.target.value)} />
          </Campo>
          <div className="modal-acoes">
            <button type="button" className="botao botao-fantasma" disabled={processando !== null} onClick={() => dialogo.current?.close()}>Voltar</button>
            <button type="submit" className="botao botao-primario" disabled={processando !== null}>{processando ? 'Salvando…' : 'Confirmar envio'}</button>
          </div>
        </form>
      </dialog>
    </section>
  )
}
