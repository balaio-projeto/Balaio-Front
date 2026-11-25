import Link from 'next/link'
import Pagina from '@/components/layout/Pagina'
import { Migalhas } from '@/components/ui/Basicos'
import ListaFavoritos from '@/components/produto/ListaFavoritos'
import ListaVideosSalvos from '@/components/produto/ListaVideosSalvos'

const ABAS: Record<'pecas' | 'videos', { titulo: string; subtitulo?: string; href: string }> = {
  pecas: {
    titulo: 'Peças salvas',
    subtitulo: 'Peças únicas podem sair do catálogo se outra pessoa comprar antes.',
    href: '/favorites',
  },
  videos: {
    titulo: 'Vídeos salvos',
    href: '/favorites?aba=videos',
  },
}

type Aba = keyof typeof ABAS

export default async function Favoritos({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  const { aba: abaPedida } = await searchParams
  const aba: Aba = abaPedida === 'videos' ? 'videos' : 'pecas'
  const atual = ABAS[aba]

  return (
    <Pagina>
      <Migalhas trilha={[{ texto: 'Início', href: '/' }, { texto: atual.titulo }]} />

      <h1 className="titulo-pagina">{atual.titulo}</h1>
      {atual.subtitulo && <p className="subtitulo-pagina">{atual.subtitulo}</p>}

      <nav className="painel-abas" aria-label="O que você salvou">
        {(Object.keys(ABAS) as Aba[]).map((chave) => (
          <Link
            key={chave}
            href={ABAS[chave].href}
            className={`painel-aba${chave === aba ? ' painel-aba-ativa' : ''}`}
            aria-current={chave === aba ? 'page' : undefined}
          >
            {ABAS[chave].titulo}
          </Link>
        ))}
      </nav>

      {aba === 'videos' ? <ListaVideosSalvos /> : <ListaFavoritos />}
    </Pagina>
  )
}
