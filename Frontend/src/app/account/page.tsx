import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import { Migalhas, Retrato } from '@/components/ui/Basicos'
import BotaoSair from '@/components/conta/BotaoSair'
import {
  IconeCadeado,
  IconeCalendario,
  IconeCoracao,
  IconeMapa,
  IconePacote,
  IconePincel,
  IconeSetaDireita,
  IconeUsuario,
} from '@/components/ui/Icones'
import { listarPedidos } from '@/services/api/pedidos.servico'
import { obterMeuAtelie } from '@/services/api/artesaos.servico'
import { exigirSessao } from '@/services/autenticacao'
import { podeComprar, rotuloDasCompras } from '@/services/sessao/papeis'

export default async function Conta() {
  const { usuario: usuarioAtual, token } = await exigirSessao()
  const compra = podeComprar(usuarioAtual.papel)
  const [{ dados: pedidos }, perfil] = await Promise.all([
    compra ? listarPedidos(token) : { dados: [] },
    usuarioAtual.papel === 'artesao' ? obterMeuAtelie(token) : null,
  ])
  const imagem = usuarioAtual.imagem || perfil?.dados?.imagem
  const totalPedidos = (pedidos ?? []).length
  return (
    <Pagina>
      <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: 'Minha conta' }]} />

      <h1 className="titulo-pagina">Minha conta</h1>

      <div className="conta-hub">
        <header className="cartao conta-capa">
          <Retrato imagem={imagem} grande />
          <div className="encolhivel">
            <p className="conta-capa-nome">{usuarioAtual.nome}</p>
            <p className="autoria">{usuarioAtual.email}</p>
          </div>
        </header>

        <nav className="cartao lista-menu" aria-label="Minha conta">
          {usuarioAtual.papel === 'artesao' && <Link href="/dashboard/settings" className="menu-item">
            <IconeUsuario />Perfil do ateliê<span className="menu-item-seta"><IconeSetaDireita /></span>
          </Link>}
          {compra && <Link href="/orders" className="menu-item">
            <IconePacote />
            {rotuloDasCompras(usuarioAtual.papel)}
            <span className="menu-marcador">{totalPedidos}</span>
            <span className="menu-item-seta">
              <IconeSetaDireita />
            </span>
          </Link>}
          <Link href="/favorites" className="menu-item">
            <IconeCoracao />
            Peças salvas
            <span className="menu-item-seta">
              <IconeSetaDireita />
            </span>
          </Link>
          {compra && <Link href="/account/addresses" className="menu-item">
            <IconeMapa />
            Endereços de entrega
            <span className="menu-item-seta">
              <IconeSetaDireita />
            </span>
          </Link>}
          <Link href="/account/details" className="menu-item">
            <IconeUsuario />
            Meus dados
            <span className="menu-item-seta">
              <IconeSetaDireita />
            </span>
          </Link>
          <Link href="/account/details#seguranca" className="menu-item">
            <IconeCadeado />
            Alterar senha
            <span className="menu-item-seta">
              <IconeSetaDireita />
            </span>
          </Link>
          {usuarioAtual.papel === 'organizador' && (
            <Link href="/events/new" className="menu-item">
              <IconeCalendario />
              Organizar um evento
              <span className="menu-item-seta">
                <IconeSetaDireita />
              </span>
            </Link>
          )}
          {usuarioAtual.papel === 'admin' && (
            <Link href="/admin" className="menu-item">
              <IconePincel />
              Curadoria e mediações
              <span className="menu-item-seta">
                <IconeSetaDireita />
              </span>
            </Link>
          )}
          {usuarioAtual.papel === 'artesao' && (
            <Link href="/dashboard" className="menu-item">
              <IconePincel />
              Painel do artesão
              <span className="menu-item-seta">
                <IconeSetaDireita />
              </span>
            </Link>
          )}
          <BotaoSair />
        </nav>
      </div>
    </Pagina>
  )
}
