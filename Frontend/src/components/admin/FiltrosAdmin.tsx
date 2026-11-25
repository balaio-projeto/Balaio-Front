import Form from 'next/form'
import Link from 'next/link'
import { IconeBusca } from '@/components/ui/Icones'
import { LIMITE_BUSCA_ADMIN } from '@/utils/filtrosAdmin'

export type ChipFiltroAdmin = { rotulo: string; href: string; ativo: boolean }

type Props = {
  caminho: string
  chips: ChipFiltroAdmin[]
  rotuloChips: string
  busca: string
  rotuloBusca: string
  dica: string
  ocultos?: Record<string, string | undefined>
  hrefLimpar: string
}

export default function FiltrosAdmin({ caminho, chips, rotuloChips, busca, rotuloBusca, dica, ocultos = {}, hrefLimpar }: Props) {
  return (
    <div className="filtros-admin">
      <nav className="chips-filtro" aria-label={rotuloChips}>
        {chips.map((chip) => (
          <Link
            key={chip.rotulo}
            href={chip.href}
            className={`chip-filtro${chip.ativo ? ' chip-filtro-ativo' : ''}`}
            aria-current={chip.ativo ? 'page' : undefined}
          >
            {chip.rotulo}
          </Link>
        ))}
      </nav>

      <Form action={caminho} className="busca-admin" role="search" aria-label={rotuloBusca}>
        {Object.entries(ocultos).map(([nome, valor]) =>
          valor ? <input key={nome} type="hidden" name={nome} value={valor} /> : null,
        )}
        <label className="so-leitor" htmlFor="busca-admin">{rotuloBusca}</label>
        <input
          key={busca}
          id="busca-admin"
          name="busca"
          type="search"
          defaultValue={busca}
          placeholder={dica}
          maxLength={LIMITE_BUSCA_ADMIN}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="botao botao-secundario">
          <IconeBusca tamanho={16} />
          Buscar
        </button>
        {busca && (
          <Link href={hrefLimpar} className="botao-texto">
            Limpar
          </Link>
        )}
      </Form>
    </div>
  )
}
