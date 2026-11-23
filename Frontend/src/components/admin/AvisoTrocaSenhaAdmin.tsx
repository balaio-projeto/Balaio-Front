import Link from 'next/link'
import { IconeAviso } from '@/components/ui/Icones'

export const CODIGO_TROCA_SENHA_OBRIGATORIA = 'TROCA_SENHA_OBRIGATORIA'

export default function AvisoTrocaSenhaAdmin() {
  return (
    <div className="aviso abaixo-4" role="alert">
      <IconeAviso />
      <span>
        <strong>Troque a senha inicial para liberar a administração.</strong> Enquanto a senha provisória não for
        trocada, a curadoria, o cadastro de coletivos e a promoção de organizadores ficam bloqueados.{' '}
        <Link href="/account/details#seguranca">Trocar senha agora</Link>
      </span>
    </div>
  )
}
