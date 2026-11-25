import Link from 'next/link'
import { Suspense } from 'react'
import BarraDepartamentos from '@/components/layout/BarraDepartamentos'
import BuscaCabecalho from '@/components/layout/BuscaCabecalho'
import { carregarSugestoesDeBusca } from '@/components/layout/sugestoesBusca'
import { IconeSacola } from '@/components/ui/Icones'
import AlternadorTema from '@/components/layout/AlternadorTema'
import ContadorSacola from '@/components/carrinho/ContadorSacola'
import MenuPerfil from '@/components/perfil/MenuPerfil'
import SinoNotificacoes from '@/components/notificacoes/SinoNotificacoes'

export default function Cabecalho({ semSugestoesDeBusca = false }: { semSugestoesDeBusca?: boolean }) {
  const sugestoes = semSugestoesDeBusca ? undefined : carregarSugestoesDeBusca()

  return (
    <header className="cabecalho">
      <div className="container cabecalho-linha">
        <Link href="/" className="marca" aria-label="Balaio, artesanato de Pernambuco">
          <img className="marca-logo" src="/balaio-logo.png" alt="" width={52} height={52} />
          <span>
            <span className="marca-nome">Balaio</span>
            <span className="marca-linha">Artesanato de Pernambuco</span>
          </span>
        </Link>

        <BuscaCabecalho sugestoes={sugestoes} />

        <div className="cabecalho-acoes">
          <AlternadorTema />

          <SinoNotificacoes />

          <MenuPerfil />

          <Link href="/cart" className="cabecalho-link sacola">
            <IconeSacola />
            Sacola
            <ContadorSacola />
          </Link>
        </div>
      </div>
      <Suspense>
        <BarraDepartamentos />
      </Suspense>
    </header>
  )
}
