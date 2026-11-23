import Link from 'next/link'
import LayoutAdmin from '@/components/admin/LayoutAdmin'
import { Migalhas } from '@/components/ui/Basicos'
import FilaCuradoria from '@/components/admin/FilaCuradoria'
import { montarFilaCuradoria } from '@/components/admin/montarFilaCuradoria'
import EstadoErro from '@/components/feedback/EstadoErro'
import { IconeSetaDireita } from '@/components/ui/Icones'
import { listarFilaCuradoria } from '@/services/api/curadoria.servico'
import { listarArtesaos } from '@/services/api/artesaos.servico'
import { listarColetivos } from '@/services/api/coletivos.servico'
import { pecasPorArtesao } from '@/services/api/pecas.servico'
import { tokenDaSessao } from '@/services/autenticacao'

export default async function Admin() {
  const token = await tokenDaSessao()
  const [fila, artesaos, coletivos] = await Promise.all([
    listarFilaCuradoria(token),
    listarArtesaos(),
    listarColetivos(),
  ])
  const solicitacoes = fila.dados ?? []
  const pecasDaFila = await Promise.all(solicitacoes.map((item) => pecasPorArtesao(item.artesaoSlug)))
  const falha = [fila, artesaos].find((resposta) => resposta.erro || !resposta.dados)
  const ateliesSemPecas = solicitacoes
    .filter((_, indice) => pecasDaFila[indice].erro || !pecasDaFila[indice].dados)
    .map((item) => item.atelie || item.artesao)

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

      {falha ? (
        <EstadoErro mensagem={falha.erro?.mensagem} />
      ) : (
        <FilaCuradoria
          filaInicial={montarFilaCuradoria(
            solicitacoes,
            pecasDaFila.map((resposta) => (resposta.erro || !resposta.dados ? null : resposta.dados)),
            coletivos.dados ?? [],
          )}
          artesaosVerificados={(artesaos.dados ?? []).filter((artesao) => artesao.selo).length}
        />
      )}
    </LayoutAdmin>
  )
}
