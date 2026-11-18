'use client'

import { useEffect, useState } from 'react'
import { obterMeuAtelie } from '@/services/api/artesaos.servico'
import { listarConversasArtesao, listarPedidosPendentes } from '@/services/api/pedidos.servico'
import type { ContagensPainel } from '@/components/painel/itensPainel'
import { useSessao } from '@/store/sessao'
import type { Artesao, Usuario } from '@/types/dominio'

const EVENTO_ARTESAO_ATUALIZADO = 'balaio:artesao-atualizado'
const EVENTO_PAINEL_ATUALIZADO = 'balaio:painel-atualizado'

export function avisarArtesaoAtualizado(artesao: Artesao, contaId: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_ARTESAO_ATUALIZADO, { detail: { artesao, contaId } }))
}

export function avisarPainelAtualizado() {
  window.dispatchEvent(new Event(EVENTO_PAINEL_ATUALIZADO))
}

export function usePerfilArtesao() {
  const { sessao } = useSessao()
  const contaId = sessao?.papel === 'artesao' ? sessao.id : undefined
  const [resultado, definirResultado] = useState<{ contaId: string; artesao: Artesao | null; erro: string | null } | null>(null)
  const [tentativa, definirTentativa] = useState(0)

  useEffect(() => {
    if (!contaId) return
    let vivo = true
    let atualizadoPorEvento = false
    obterMeuAtelie().then(({ dados, erro }) => {
      if (vivo && !atualizadoPorEvento) definirResultado({ contaId, artesao: dados, erro: erro?.mensagem ?? null })
    })
    function aoAtualizar(evento: Event) {
      const detalhe = (evento as CustomEvent<{ artesao: Artesao; contaId: string }>).detail
      if (detalhe.contaId !== contaId) return
      const atualizado = detalhe.artesao
      atualizadoPorEvento = true
      definirResultado({ contaId, artesao: atualizado, erro: null })
    }
    window.addEventListener(EVENTO_ARTESAO_ATUALIZADO, aoAtualizar)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_ARTESAO_ATUALIZADO, aoAtualizar)
    }
  }, [contaId, tentativa])

  const atual = contaId && resultado?.contaId === contaId ? resultado : null
  return {
    artesao: atual?.artesao ?? null,
    erro: atual?.erro ?? null,
    carregando: Boolean(contaId && !atual),
    recarregar: () => { definirResultado(null); definirTentativa((valor) => valor + 1) },
  }
}

export function useArtesaoLogado(): Artesao | null { return usePerfilArtesao().artesao }

export function useImagemConta(usuario: Pick<Usuario, 'id' | 'papel' | 'imagem'> | null): string {
  const { sessao } = useSessao()
  const { artesao } = usePerfilArtesao()
  if (usuario?.papel === 'artesao' && usuario.id === sessao?.id) {
    return artesao?.imagem ?? usuario.imagem
  }
  return usuario?.imagem ?? ''
}

export function useContagensPainel(): ContagensPainel {
  const { sessao } = useSessao()
  const slug = sessao?.artesao
  const [contagens, definirContagens] = useState<ContagensPainel>({ pendentes: 0, naoLidas: 0 })

  useEffect(() => {
    if (!slug) return
    let vivo = true
    function carregar() {
      Promise.all([listarPedidosPendentes(slug), listarConversasArtesao(slug)]).then(([pendentes, conversas]) => {
        if (!vivo) return
        definirContagens({
          pendentes: pendentes.dados?.length ?? 0,
          naoLidas: (conversas.dados ?? []).filter((c) => c.naoLida).length,
        })
      })
    }
    carregar()
    window.addEventListener(EVENTO_PAINEL_ATUALIZADO, carregar)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO_PAINEL_ATUALIZADO, carregar)
    }
  }, [slug])

  return contagens
}
