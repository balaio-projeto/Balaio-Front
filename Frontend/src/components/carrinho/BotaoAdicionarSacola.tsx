'use client'

import { useRouter } from 'next/navigation'
import { MENSAGEM_LIMITE_PECAS, useSacola } from '@/store/sacola'
import { useSessao } from '@/store/sessao'
import { MENSAGEM_PECA_DO_PROPRIO_ATELIE, pecaDoProprioAtelie } from '@/services/sessao/papeis'
import { avisar } from '@/components/feedback/Avisos'
import { IconeSacola } from '@/components/ui/Icones'
import { type Disponibilidade } from '@/types/dominio'

export default function BotaoAdicionarSacola({
  slug,
  disponibilidade,
  artesao,
  texto = 'Adicionar à sacola',
  className = 'botao botao-primario botao-largo abaixo-4',
}: {
  slug: string
  disponibilidade: Disponibilidade
  artesao?: string
  texto?: string
  className?: string
}) {
  const { adicionar, pronto, erro } = useSacola()
  const { sessao } = useSessao()
  const roteador = useRouter()

  if (pecaDoProprioAtelie(sessao, artesao)) {
    return (
      <button type="button" disabled className={className} title="Você não pode comprar peças do próprio ateliê">
        <IconeSacola />
        {MENSAGEM_PECA_DO_PROPRIO_ATELIE}
      </button>
    )
  }

  function clicar() {
    if (erro) { avisar.erro('Não foi possível carregar a sacola', erro); return }
    const resultado = adicionar(slug, disponibilidade === 'unica')
    if (resultado === 'limite') {
      avisar.comAcao(MENSAGEM_LIMITE_PECAS, 'Ver sacola', () => roteador.push('/cart'))
      return
    }
    if (resultado === 'ja-esta') {
      avisar.info(disponibilidade === 'unica' ? 'Essa peça única já está na sua sacola' : 'Você já tem 3 unidades desta peça na sacola')
      return
    }
    avisar.comAcao('Peça adicionada à sacola', 'Ver sacola', () => roteador.push('/cart'))
  }

  return (
    <button type="button" onClick={clicar} disabled={!pronto} className={className}>
      <IconeSacola />
      {texto}
    </button>
  )
}
