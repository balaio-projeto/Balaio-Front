'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import BotaoSair from '@/components/conta/BotaoSair'
import { itensAdmin } from '@/components/admin/itensAdmin'
import { itensPainel, type ChavePainel } from '@/components/painel/itensPainel'
import { Retrato } from '@/components/ui/Basicos'
import { IconeCalendario, IconeCasa, IconeCoracao, IconeEditar, IconeMapa, IconePacote, IconeSelo, IconeUsuario } from '@/components/ui/Icones'
import type { ResumoPerfil } from '@/hooks/useResumoPerfil'
import type { Sessao } from '@/services/sessao/cookie'
import { useFavoritos } from '@/store/favoritos'
import type { EstadoSelo } from '@/types/dominio'
import { useImagemConta } from '@/hooks/useArtesaoLogado'
import { rotuloDasCompras } from '@/services/sessao/papeis'

const ITENS_DO_PAINEL_NO_MENU: ChavePainel[] = ['pedidos', 'conversas', 'pecas', 'config']

type Marcador = { texto: string; alerta?: boolean }
type ItemMenu = { chave: string; texto: string; href: string; icone: ReactNode; marcador?: Marcador }
type GrupoMenu = { rotulo?: string; itens: ItemMenu[] }

type Props = {
  sessao: Sessao | null
  resumo: ResumoPerfil
  idTitulo: string
}

function seloDoArtesao(selo?: EstadoSelo): { texto: string; classe: string } | null {
  if (!selo) return null
  if (selo.selo) return { texto: 'Artesão verificado', classe: 'selo-disponivel' }
  if (selo.solicitacao?.situacao === 'pendente') return { texto: 'Selo em análise', classe: 'selo-encomenda' }
  if (selo.solicitacao?.situacao === 'ajuste') return { texto: 'Selo: ajuste pedido', classe: 'selo-encomenda' }
  return { texto: 'Sem selo', classe: 'selo-neutro' }
}

function itensDeCompra(sessao: Sessao, resumo: ResumoPerfil, salvas: ItemMenu): ItemMenu[] {
  const emAndamento = resumo.pedidosEmAndamento ?? 0
  return [
    {
      chave: 'pedidos',
      texto: rotuloDasCompras(sessao.papel),
      href: '/orders',
      icone: <IconePacote />,
      marcador: emAndamento > 0 ? { texto: `${emAndamento} em andamento` } : undefined,
    },
    salvas,
    { chave: 'enderecos', texto: 'Endereços de entrega', href: '/account/addresses', icone: <IconeMapa /> },
  ]
}

function gruposDoPerfil(sessao: Sessao, resumo: ResumoPerfil, salvas: ItemMenu): GrupoMenu[] {
  if (sessao.papel === 'artesao') {
    const doPainel = itensPainel({ pendentes: resumo.pendentes ?? 0, naoLidas: resumo.naoLidas ?? 0 })
      .filter((item) => ITENS_DO_PAINEL_NO_MENU.includes(item.chave))
      .map((item) => item.chave === 'pedidos' ? { ...item, chave: 'vendas', texto: 'Pedidos recebidos' } : item)
    return [
      {
        rotulo: 'Meu ateliê',
        itens: [
          ...doPainel,
          { chave: 'nova-peca', texto: 'Cadastrar peça', href: '/dashboard/pieces/new', icone: <IconeEditar /> },
          ...(resumo.artesao?.slug ? [{ chave: 'loja', texto: 'Ver minha loja', href: `/artisans/${resumo.artesao.slug}`, icone: <IconeSelo /> }] : []),
        ],
      },
      { rotulo: 'Minhas compras', itens: itensDeCompra(sessao, resumo, salvas) },
      {
        rotulo: 'Minha conta',
        itens: [{ chave: 'dados', texto: 'Meus dados', href: '/account/details', icone: <IconeUsuario /> }],
      },
    ]
  }
  if (sessao.papel === 'admin') {
    return [
      {
        rotulo: 'Administração',
        itens: itensAdmin({ curadoria: resumo.filaCuradoria ?? 0, mediacoes: resumo.mediacoes ?? 0 }),
      },
      { itens: [salvas] },
    ]
  }
  if (sessao.papel === 'organizador') {
    return [
      {
        rotulo: 'Eventos',
        itens: [
          { chave: 'novo-evento', texto: 'Cadastrar evento', href: '/events/new', icone: <IconeEditar /> },
          { chave: 'agenda', texto: 'Agenda de eventos', href: '/events', icone: <IconeCalendario /> },
        ],
      },
      { rotulo: 'Compras', itens: [salvas] },
      {
        rotulo: 'Minha conta',
        itens: [
          { chave: 'conta', texto: 'Visão geral da conta', href: '/account', icone: <IconeCasa /> },
          { chave: 'dados', texto: 'Meus dados', href: '/account/details', icone: <IconeUsuario /> },
        ],
      },
    ]
  }
  return [
    {
      itens: [
        ...itensDeCompra(sessao, resumo, salvas),
        { chave: 'dados', texto: 'Meus dados', href: '/account/details', icone: <IconeUsuario /> },
      ],
    },
  ]
}

export default function ConteudoMenuPerfil({ sessao, resumo, idTitulo }: Props) {
  const { slugs, pronto } = useFavoritos()
  const imagem = useImagemConta(sessao)
  const salvas: ItemMenu = {
    chave: 'salvas',
    texto: 'Peças salvas',
    href: '/favorites',
    icone: <IconeCoracao />,
    marcador: pronto ? { texto: String(slugs.length) } : undefined,
  }

  if (!sessao) {
    return (
      <div className="menu-perfil-conteudo">
        <div className="menu-perfil-topo">
          <div className="encolhivel">
            <p className="menu-perfil-nome" id={idTitulo}>Boas-vindas ao Balaio</p>
            <p className="menu-perfil-detalhe">Entre para acompanhar seus pedidos.</p>
          </div>
        </div>
        <div className="menu-perfil-acoes">
          <Link href="/login" className="botao botao-primario">Entrar</Link>
          <Link href="/login/register" className="botao botao-secundario">Criar conta</Link>
        </div>
      </div>
    )
  }

  const selo = sessao.papel === 'artesao' ? seloDoArtesao(resumo.selo) : null
  const detalhe = sessao.papel === 'artesao' ? resumo.artesao?.atelie ?? sessao.email : sessao.email

  return (
    <div className="menu-perfil-conteudo">
      <div className="menu-perfil-topo">
        <Retrato imagem={imagem} tamanho={44} />
        <div className="encolhivel">
          <p className="menu-perfil-nome" id={idTitulo}>{sessao.nome}</p>
          <p className="menu-perfil-detalhe">{detalhe}</p>
          {selo && (
            <Link href="/dashboard/settings" className={`selo ${selo.classe} menu-perfil-selo`}>
              <span className="selo-ponto" />
              {selo.texto}
            </Link>
          )}
        </div>
      </div>

      {gruposDoPerfil(sessao, resumo, salvas).map((grupo, indice) => (
        <div className="menu-perfil-grupo" key={grupo.rotulo ?? indice}>
          {grupo.rotulo && <p className="menu-grupo-rotulo">{grupo.rotulo}</p>}
          {grupo.itens.map((item) => (
            <ItemDoMenu key={item.chave} item={item} />
          ))}
        </div>
      ))}

      <div className="menu-perfil-grupo">
        <BotaoSair />
      </div>
    </div>
  )
}

function ItemDoMenu({ item }: { item: ItemMenu }) {
  return (
    <Link href={item.href} className="menu-item">
      {item.icone}
      {item.texto}
      {item.marcador && (
        <span className={`menu-marcador${item.marcador.alerta ? ' menu-marcador-alerta' : ''}`}>{item.marcador.texto}</span>
      )}
    </Link>
  )
}
