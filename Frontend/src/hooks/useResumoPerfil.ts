'use client'

import { useEffect, useState } from 'react'
import { obterMeuAtelie } from '@/services/api/artesaos.servico'
import { consultarPendentesCuradoria, obterMeuSelo, totalDaFila } from '@/services/api/curadoria.servico'
import { listarConversasArtesao, listarPedidos, listarPedidosPendentes } from '@/services/api/pedidos.servico'
import { contarMediacoesEmAberto, listarMediacoes } from '@/services/api/mediacoes.servico'
import type { Sessao } from '@/services/sessao/cookie'
import { podeComprar } from '@/services/sessao/papeis'
import type { Artesao, EstadoPedido, EstadoSelo } from '@/types/dominio'

const ESTADOS_ENCERRADOS: EstadoPedido[] = ['entregue', 'falha_reserva', 'falha_pagamento', 'recusado', 'cancelado', 'reembolsado']

export type ResumoPerfil = {
  pedidosEmAndamento?: number
  pendentes?: number
  naoLidas?: number
  artesao?: Artesao
  selo?: EstadoSelo
  filaCuradoria?: number
  mediacoes?: number
}

async function carregarResumo(sessao: Sessao): Promise<ResumoPerfil> {
  if (sessao.papel === 'artesao') {
    const [pendentes, conversas, artesao, selo, compras] = await Promise.all([
      listarPedidosPendentes(),
      listarConversasArtesao(),
      obterMeuAtelie(),
      obterMeuSelo(),
      listarPedidos(),
    ])
    return {
      pedidosEmAndamento: comprasEmAndamento(compras.dados),
      pendentes: pendentes.dados?.length,
      naoLidas: conversas.dados?.filter((conversa) => conversa.naoLida).length,
      artesao: artesao.dados ?? undefined,
      selo: selo.dados ?? undefined,
    }
  }
  if (sessao.papel === 'admin') {
    const [fila, mediacoes] = await Promise.all([consultarPendentesCuradoria(), listarMediacoes()])
    return { filaCuradoria: totalDaFila(fila), mediacoes: mediacoes.dados ? contarMediacoesEmAberto(mediacoes.dados) : undefined }
  }
  if (!podeComprar(sessao.papel)) return {}
  const pedidos = await listarPedidos()
  return { pedidosEmAndamento: comprasEmAndamento(pedidos.dados) }
}

function comprasEmAndamento(pedidos: { estado: EstadoPedido }[] | null | undefined): number | undefined {
  return pedidos?.filter((pedido) => !ESTADOS_ENCERRADOS.includes(pedido.estado)).length
}

export function useResumoPerfil(sessao: Sessao | null, aberto: boolean): ResumoPerfil {
  const [resultado, definirResultado] = useState<{ chave: string; resumo: ResumoPerfil } | null>(null)
  const chave = sessao ? `${sessao.id}:${sessao.papel}` : null

  useEffect(() => {
    if (!sessao || !aberto) return
    let vivo = true
    carregarResumo(sessao).then((carregado) => {
      if (vivo) definirResultado({ chave: `${sessao.id}:${sessao.papel}`, resumo: carregado })
    })
    return () => {
      vivo = false
    }
  }, [sessao, aberto])

  return chave && resultado?.chave === chave ? resultado.resumo : {}
}
