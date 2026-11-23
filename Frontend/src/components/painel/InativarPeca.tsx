'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { excluirPeca, reativarPeca } from '@/services/api/pecas.servico'
import { avisar } from '@/components/feedback/Avisos'

type Props = { slug: string; nome: string; inativada?: boolean }

export default function InativarPeca({ slug, nome, inativada = false }: Props) {
  const roteador = useRouter()
  const [salvando, definirSalvando] = useState(false)

  async function alterarAtividade() {
    const mensagem = inativada
      ? `Reativar "${nome}"? Ela voltará a aparecer na vitrine e na busca.`
      : `Inativar "${nome}"? Ela deixará de aparecer na vitrine e na busca.`
    if (!window.confirm(mensagem)) return
    definirSalvando(true)
    const resposta = inativada ? await reativarPeca(slug) : await excluirPeca(slug)
    definirSalvando(false)
    if (resposta.erro) {
      avisar.erro(inativada ? 'Não foi possível reativar' : 'Não foi possível inativar', resposta.erro.mensagem)
      return
    }
    avisar.sucesso(inativada ? 'Peça reativada' : 'Peça inativada')
    roteador.refresh()
  }

  return <button type="button" className="botao botao-fantasma" onClick={() => void alterarAtividade()} disabled={salvando}>{inativada ? 'Reativar' : 'Inativar'}</button>
}