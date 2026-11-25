import LayoutAdmin from '@/components/admin/LayoutAdmin'
import GerenciarDescontos from '@/components/admin/GerenciarDescontos'
import { Migalhas } from '@/components/ui/Basicos'
import { listarCuponsAdmin } from '@/services/api/cupons.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { exigirAdmin } from '@/services/sessao/servidor'

export const dynamic = 'force-dynamic'

export default async function Descontos() {
  await exigirAdmin('/admin/discounts')
  const token = await tokenDaSessao()
  const resposta = await listarCuponsAdmin(token)

  return (
    <LayoutAdmin ativo="descontos">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Descontos' }]} />

      <h1 className="titulo-pagina">Descontos da plataforma</h1>
      <p className="subtitulo-pagina">
        Cupons com código e promoções automáticas: porcentagem nas peças, valor fixo ou frete grátis.
      </p>

      <GerenciarDescontos cuponsIniciais={resposta.dados ?? []} erro={resposta.erro} />
    </LayoutAdmin>
  )
}
