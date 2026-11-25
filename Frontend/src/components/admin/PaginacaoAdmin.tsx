import Link from 'next/link'
import type { Paginacao } from '@/services/api/tipos'
import { hrefAdmin } from '@/utils/filtrosAdmin'

type Props = {
  paginacao: Paginacao
  caminho: string
  parametros?: Record<string, string | number | undefined>
  rotulo: string
}

export default function PaginacaoAdmin({ paginacao, caminho, parametros = {}, rotulo }: Props) {
  const { pagina, totalPaginas } = paginacao
  if (totalPaginas <= 1 && pagina <= 1) return null
  const href = (numero: number) => hrefAdmin(caminho, { ...parametros, pagina: numero })
  const anterior = Math.min(pagina - 1, totalPaginas)

  return (
    <nav className="paginacao-admin" aria-label={rotulo}>
      {pagina > 1 ? (
        <Link href={href(anterior)} className="botao botao-fantasma" aria-label={`Página anterior, ${anterior} de ${totalPaginas}`}>
          ← Anterior
        </Link>
      ) : (
        <span className="botao botao-fantasma" aria-disabled="true">← Anterior</span>
      )}
      <span className="paginacao-admin-posicao" aria-current="page">
        Página {pagina} de {totalPaginas}
      </span>
      {pagina < totalPaginas ? (
        <Link href={href(pagina + 1)} className="botao botao-fantasma" aria-label={`Próxima página, ${pagina + 1} de ${totalPaginas}`}>
          Próxima →
        </Link>
      ) : (
        <span className="botao botao-fantasma" aria-disabled="true">Próxima →</span>
      )}
    </nav>
  )
}
