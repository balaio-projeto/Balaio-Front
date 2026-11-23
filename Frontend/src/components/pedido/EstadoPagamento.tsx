'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { obterPedido } from '@/services/api/pedidos.servico'
import { linkDePagamentoConfiavel } from '@/components/carrinho/abrirPagamento'
import { IconeSetaDireita } from '@/components/ui/Icones'
import { pagamentoConfirmado, pedidoEncerrado } from './acaoCancelamentoPedido'
import type { Pedido } from '@/types/dominio'

const INTERVALO_CONSULTA_MS = 8000
const LIMITE_CONSULTA_MS = 5 * 60_000

function estadoDefinitivo(pedido: Pedido): boolean {
  return pagamentoConfirmado(pedido.estado) || pedidoEncerrado(pedido.estado)
}

function mensagem(pedido: Pedido): string {
  if (pagamentoConfirmado(pedido.estado)) return 'Pagamento confirmado pelo provedor de teste.'
  if (pedido.estado === 'reembolsado') return 'Reembolso confirmado pelo provedor de teste.'
  if (pedido.estado === 'reembolso_pendente') return 'Reembolso solicitado; aguardando confirmação do provedor.'
  if (pedido.estado === 'cancelamento_pendente') return 'Cancelamento solicitado; aguardando confirmação do provedor.'
  if (pedido.estado === 'falha_pagamento') return 'O pagamento não foi concluído e o pedido foi encerrado. A peça volta para a vitrine.'
  if (pedidoEncerrado(pedido.estado)) return 'Este pedido foi encerrado. Consulte os detalhes do pedido.'
  return 'Aguardando confirmação do pagamento pelo Mercado Pago. O retorno ao site não confirma a cobrança.'
}

export default function EstadoPagamento({ inicial }: { inicial: Pedido }) {
  const roteador = useRouter()
  const [pedido, definirPedido] = useState(inicial)
  const [consultaEsgotada, definirConsultaEsgotada] = useState(false)
  const [rodada, definirRodada] = useState(0)
  const estadoExibido = useRef(inicial.estado)

  const definitivo = estadoDefinitivo(pedido)
  const pedidoId = pedido.id

  useEffect(() => {
    if (definitivo) return
    let ativo = true
    const inicio = Date.now()
    const temporizador = window.setInterval(async () => {
      if (Date.now() - inicio > LIMITE_CONSULTA_MS) {
        window.clearInterval(temporizador)
        if (ativo) definirConsultaEsgotada(true)
        return
      }
      const resposta = await obterPedido(pedidoId)
      if (!ativo || !resposta.dados) return
      definirPedido(resposta.dados)
      if (resposta.dados.estado !== estadoExibido.current) {
        estadoExibido.current = resposta.dados.estado
        roteador.refresh()
      }
    }, INTERVALO_CONSULTA_MS)
    return () => { ativo = false; window.clearInterval(temporizador) }
  }, [pedidoId, definitivo, rodada, roteador])

  function consultarDeNovo() {
    definirConsultaEsgotada(false)
    definirRodada((n) => n + 1)
    roteador.refresh()
  }

  const linkPagamento = pedido.estado === 'aguardando_pagamento' && pedido.checkoutUrl
    ? linkDePagamentoConfiavel(pedido.checkoutUrl) : null

  return (
    <div>
      <p role="status" className="texto-suave">{mensagem(pedido)}</p>
      {linkPagamento && (
        <a className="botao botao-primario acima-3" href={linkPagamento.toString()}>
          Concluir pagamento no Mercado Pago
          <IconeSetaDireita />
        </a>
      )}
      {consultaEsgotada && (
        <p className="campo-ajuda acima-3">
          Paramos de atualizar automaticamente.{' '}
          <button type="button" className="botao-texto" onClick={consultarDeNovo}>Verificar novamente</button>
        </p>
      )}
    </div>
  )
}
