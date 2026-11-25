import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import { Migalhas } from '@/components/ui/Basicos'
import EnderecosEntrega from '@/components/forms/EnderecosEntrega'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeMapa } from '@/components/ui/Icones'
import MenuDrawer from '@/components/navegacao/MenuDrawer'
import MenuConta from '@/components/conta/MenuConta'
import { exigirSessao } from '@/services/autenticacao'
import { listarPedidos } from '@/services/api/pedidos.servico'
import { listarEnderecos } from '@/services/api/conta.servico'
import { podeComprar } from '@/services/sessao/papeis'

export default async function EnderecosDaConta() {
  const { usuario, token } = await exigirSessao()
  const compra = podeComprar(usuario.papel ?? usuario.perfil)
  const [{ dados: pedidos }, { dados: enderecos, erro: erroEnderecos }] = compra
    ? await Promise.all([listarPedidos(token), listarEnderecos(token)])
    : [{ dados: [] }, { dados: null, erro: null }]
  return (
    <Pagina>
      <Migalhas
        trilha={[{ texto: 'Início', href: '/' }, { texto: 'Minha conta', href: '/account' }, { texto: 'Endereços' }]}
      />

      <MenuDrawer titulo="Minha conta" rotulo="Minha conta">
        <MenuConta ativo="enderecos" usuario={usuario} totalPedidos={pedidos?.length ?? 0} />
      </MenuDrawer>

      <h1 className="titulo-pagina">Endereços de entrega</h1>

      <div className="conta-hub">
        {!compra ? (
          <EstadoVazio
            icone={<IconeMapa tamanho={34} />}
            titulo="Endereços de entrega são de quem compra"
            descricao="Esta conta não faz compras no Balaio, então não guarda endereços de entrega. Para comprar peças, entre com uma conta de comprador ou de artesão."
            acao={<Link href="/account" className="botao botao-primario">Voltar para minha conta</Link>}
          />
        ) : erroEnderecos || !enderecos ? (
          <EstadoErro mensagem={erroEnderecos?.mensagem} />
        ) : (
          <EnderecosEntrega iniciais={enderecos} />
        )}
      </div>
    </Pagina>
  )
}
