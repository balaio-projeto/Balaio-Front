import Link from 'next/link'
import LayoutAuth from '@/components/auth/LayoutAuth'
import FormRecuperar from '@/components/forms/FormRecuperar'

const ajudas = [
  'O link chega no e-mail que você usou no cadastro',
  'O link vale por 1 hora e pode ser usado uma vez',
]

export default function Recuperar() {
  return (
    <LayoutAuth
      trilha={[{ texto: 'Início', href: '/' }, { texto: 'Entrar', href: '/login' }, { texto: 'Recuperar senha' }]}
      titulo="Recuperar sua senha"
      apoio="Informe o e-mail da sua conta. Se ela existir, você receberá um link para criar uma senha nova."
      frase="Acontece com todo mundo. Em um minuto você volta para o seu ateliê."
      destaques={ajudas}
      rodape={
        <p>
          Lembrou a senha? <Link href="/login">Voltar para o login</Link>
        </p>
      }
    >
      <FormRecuperar />
    </LayoutAuth>
  )
}
