import LayoutAdmin from '@/components/admin/LayoutAdmin'
import GerenciarOrganizadores from '@/components/admin/GerenciarOrganizadores'
import { Migalhas } from '@/components/ui/Basicos'
import { exigirAdmin } from '@/services/sessao/servidor'

export const dynamic = 'force-dynamic'

export default async function Organizadores() {
  await exigirAdmin('/admin/accounts')

  return (
    <LayoutAdmin ativo="organizadores">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Organizadores' }]} />

      <h1 className="titulo-pagina">Organizadores</h1>
      <p className="subtitulo-pagina">
        Organizadores enviam eventos para a agenda. O cadastro público só cria compradores e artesãos, então é aqui que
        uma conta de comprador passa a organizar eventos, ou volta a ser compradora.
      </p>

      <p className="aviso abaixo-4" role="note">
        O papel vai dentro da sessão de quem está logado. Depois da alteração, a pessoa precisa sair e entrar de novo
        para o novo papel valer.
      </p>

      <GerenciarOrganizadores />
    </LayoutAdmin>
  )
}
