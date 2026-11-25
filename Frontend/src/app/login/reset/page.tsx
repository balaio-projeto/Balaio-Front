import { Suspense } from 'react'
import LayoutAuth from '@/components/auth/LayoutAuth'
import FormRedefinirSenha from '@/components/forms/FormRedefinirSenha'

export default function RedefinirSenha() {
  return <LayoutAuth
    trilha={[{ texto: 'Início', href: '/' }, { texto: 'Entrar', href: '/login' }, { texto: 'Redefinir senha' }]}
    titulo="Crie uma nova senha"
    frase="Uma nova senha coloca você de volta no Balaio."
    destaques={['O link vale por 1 hora', 'No mínimo 12 caracteres', 'Depois, entre com sua nova senha']}
  >
    <Suspense fallback={<p>Carregando...</p>}><FormRedefinirSenha /></Suspense>
  </LayoutAuth>
}
