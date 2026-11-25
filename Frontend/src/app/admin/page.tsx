import Link from 'next/link'
import LayoutAdmin from '@/components/admin/LayoutAdmin'
import { Migalhas } from '@/components/ui/Basicos'
import FilaCuradoria from '@/components/admin/FilaCuradoria'
import FiltrosAdmin from '@/components/admin/FiltrosAdmin'
import PaginacaoAdmin from '@/components/admin/PaginacaoAdmin'
import { montarFilaCuradoria } from '@/components/admin/montarFilaCuradoria'
import EstadoErro from '@/components/feedback/EstadoErro'
import { CODIGO_TROCA_SENHA_OBRIGATORIA } from '@/components/admin/AvisoTrocaSenhaAdmin'
import { IconeSetaDireita } from '@/components/ui/Icones'
import { listarFilaCuradoria, type SituacaoFiltroCuradoria } from '@/services/api/curadoria.servico'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarColetivos } from '@/services/api/coletivos.servico'
import { pecasPorArtesao } from '@/services/api/pecas.servico'
import { tokenDaSessao } from '@/services/autenticacao'
import { hrefAdmin, lerFiltrosCuradoria, parametrosCuradoria, TAMANHO_PAGINA_ADMIN } from '@/utils/filtrosAdmin'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const SITUACOES: { situacao: SituacaoFiltroCuradoria; rotulo: string }[] = [
  { situacao: 'pendente', rotulo: 'Pendentes' },
  { situacao: 'ajuste', rotulo: 'Pedidos de ajuste' },
  { situacao: 'aprovada', rotulo: 'Aprovados' },
  { situacao: 'todas', rotulo: 'Todos' },
]

export default async function Admin({ searchParams }: Props) {
  const filtros = lerFiltrosCuradoria(await searchParams)
  const token = await tokenDaSessao()
  const [fila, artesaos, coletivos] = await Promise.all([
    listarFilaCuradoria(token, { ...filtros, tamanho: TAMANHO_PAGINA_ADMIN }),
    listarArtesaos(),
    listarColetivos(),
  ])
  const solicitacoes = fila.dados ?? []
  const pecasDaFila = await Promise.all(solicitacoes.map((item) =>
    item.situacao === 'pendente' ? pecasPorArtesao(item.artesaoSlug) : Promise.resolve(null)))
  const falha = [fila, artesaos].find((resposta) => resposta.erro || !resposta.dados)
  const ateliesSemPecas = solicitacoes
    .filter((item, indice) => {
      const resposta = pecasDaFila[indice]
      return item.situacao === 'pendente' && (!resposta || resposta.erro || !resposta.dados)
    })
    .map((item) => item.atelie || item.artesao)
  const parametros = parametrosCuradoria(filtros)

  return (
    <LayoutAdmin ativo="curadoria">
      <Migalhas trilha={[{ texto: 'Administração', href: '/admin' }, { texto: 'Curadoria' }]} />

      <div className="admin-topo">
        <h1 className="titulo-pagina">Fila de curadoria</h1>
        <Link href="/admin/criteria" className="prateleira-ver-todos">
          Ver critérios
          <IconeSetaDireita tamanho={14} />
        </Link>
      </div>

      {(coletivos.erro || !coletivos.dados) && (
        <p className="aviso" role="status">Não foi possível consultar os coletivos. Confira o vínculo com a associação durante a análise.</p>
      )}

      {!falha && ateliesSemPecas.length > 0 && (
        <p className="aviso" role="status">
          Peças indisponíveis no momento para {ateliesSemPecas.join(', ')}. O catálogo não respondeu para{' '}
          {ateliesSemPecas.length === 1 ? 'esta solicitação' : 'estas solicitações'}; recarregue a página antes de decidir
          por falta de peças.
        </p>
      )}

      <FiltrosAdmin
        caminho="/admin"
        rotuloChips="Filtrar solicitações por situação"
        chips={SITUACOES.map(({ situacao, rotulo }) => ({
          rotulo,
          href: hrefAdmin('/admin', parametrosCuradoria({ situacao, busca: filtros.busca })),
          ativo: situacao === filtros.situacao,
        }))}
        busca={filtros.busca}
        rotuloBusca="Buscar por ateliê ou artesão"
        dica="Ateliê ou artesão"
        ocultos={{ situacao: parametros.situacao }}
        hrefLimpar={hrefAdmin('/admin', { situacao: parametros.situacao })}
      />

      {fila.erro?.codigo === CODIGO_TROCA_SENHA_OBRIGATORIA ? null : falha ? (
        <EstadoErro mensagem={falha.erro?.mensagem} />
      ) : (
        <>
          <FilaCuradoria
            filaInicial={montarFilaCuradoria(
              solicitacoes,
              pecasDaFila.map((resposta) => (!resposta || resposta.erro || !resposta.dados ? null : resposta.dados)),
              coletivos.dados ?? [],
            )}
            situacao={filtros.situacao}
            busca={filtros.busca}
            paginacao={fila.paginacao ?? { pagina: 1, tamanho: TAMANHO_PAGINA_ADMIN, total: solicitacoes.length, totalPaginas: 1 }}
            artesaosVerificados={(artesaos.dados ?? []).filter((artesao) => artesao.selo).length}
          />
          {fila.paginacao && (
            <PaginacaoAdmin paginacao={fila.paginacao} caminho="/admin" parametros={parametros} rotulo="Páginas da fila de curadoria" />
          )}
        </>
      )}
    </LayoutAdmin>
  )
}
