import Pagina from '@/components/layout/Pagina'
import { Migalhas } from '@/components/ui/Basicos'
import MenuDrawer from '@/components/navegacao/MenuDrawer'
import MenuConta from '@/components/conta/MenuConta'
import { exigirSessao } from '@/services/autenticacao'
import { listarPedidos } from '@/services/api/pedidos.servico'
import FormDadosConta from '@/components/forms/FormDadosConta'
import FormAlterarSenha from '@/components/conta/FormAlterarSenha'
import FotoDaConta from '@/components/conta/FotoDaConta'

export default async function DadosDaConta() {
  const { usuario, token } = await exigirSessao()
  const { dados: pedidos } = usuario.papel === 'comprador' ? await listarPedidos(token) : { dados: [] }
  return (
    <Pagina>
      <Migalhas
        trilha={[{ texto: 'Início', href: '/' }, { texto: 'Minha conta', href: '/account' }, { texto: 'Meus dados' }]}
      />

      <MenuDrawer titulo="Minha conta" rotulo="Minha conta">
        <MenuConta ativo="dados" usuario={usuario} totalPedidos={pedidos?.length ?? 0} />
      </MenuDrawer>

      <h1 className="titulo-pagina">Meus dados</h1>
      <p className="subtitulo-pagina">Sua foto, seu nome, contatos e a senha de acesso.</p>

      <div className="conta-hub">
        <FotoDaConta usuario={usuario} />

        <FormDadosConta usuario={usuario} />

        <FormAlterarSenha />
      </div>
    </Pagina>
  )
}
