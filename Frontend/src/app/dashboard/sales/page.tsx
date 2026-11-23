import Link from 'next/link'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import GraficoFaturamento from '@/components/painel/GraficoFaturamento'
import { Migalhas } from '@/components/ui/Basicos'
import { IconeGrafico } from '@/components/ui/Icones'
import { emReais } from '@/utils/formato'
import { rotuloDoPonto } from '@/utils/painel'
import { exigirArtesao } from '@/services/autenticacao'
import { relatorioVendas, type PeriodoVendas } from '@/services/api/pedidos.servico'
import { pecasPainelArtesao } from '@/services/api/pecas.servico'

export const dynamic = 'force-dynamic'

const PERIODOS: { valor: PeriodoVendas; rotulo: string }[] = [
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: '90d', rotulo: 'Últimos 90 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
]

type Props = { searchParams: Promise<{ periodo?: string | string[] }> }

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function Vendas({ searchParams }: Props) {
  const { periodo: pedido } = await searchParams
  const periodo = PERIODOS.find((opcao) => opcao.valor === pedido)?.valor ?? '30d'
  const { artesao, token } = await exigirArtesao()
  const [{ dados: relatorio, erro }, { dados: pecas }] = await Promise.all([
    relatorioVendas(periodo, token), pecasPainelArtesao(artesao.slug, token),
  ])
  const nomes = new Map((pecas ?? []).map((peca) => [peca.slug, peca.nome]))
  const pontos = (relatorio?.serie.pontos ?? []).map((ponto) => ({
    mes: rotuloDoPonto(ponto.inicio, relatorio?.serie.granularidade ?? 'dia'),
    valor: ponto.receita,
  }))
  const temVendaNoPeriodo = pontos.some((ponto) => ponto.valor > 0)

  return (
    <>
      <Migalhas trilha={[{ texto: 'Painel do artesão', href: '/dashboard' }, { texto: 'Vendas & faturamento' }]} />
      <h1 className="titulo-pagina">Vendas e faturamento</h1>
      <p className="subtitulo-pagina">Totais calculados no servidor a partir dos pedidos pagos das suas peças. Cancelados, recusados, reembolsados e pedidos aguardando pagamento ficam de fora.</p>

      <nav className="linha-flex abaixo-4" aria-label="Período do relatório">
        {PERIODOS.map((opcao) => (
          <Link key={opcao.valor} href={`/dashboard/sales?periodo=${opcao.valor}`}
            className={`botao ${opcao.valor === periodo ? 'botao-primario' : 'botao-fantasma'}`}
            aria-current={opcao.valor === periodo ? 'page' : undefined}>
            {opcao.rotulo}
          </Link>
        ))}
      </nav>

      {erro || !relatorio ? (
        <EstadoErro mensagem={erro?.mensagem ?? 'Não foi possível carregar o relatório de vendas.'} />
      ) : (
        <>
          <p className="texto-suave abaixo-4">
            De {dataCurta(relatorio.periodo.de)} a {dataCurta(relatorio.periodo.ate)} (horário de Recife).
          </p>
          <div className="metricas">
            <div className="metrica metrica-azul"><p className="metrica-rotulo">Receita no período</p><p className="metrica-valor">{emReais(relatorio.receita)}</p><p className="metrica-nota">Sem frete ({emReais(relatorio.frete)} pagos à parte)</p></div>
            <div className="metrica metrica-verde"><p className="metrica-rotulo">Ticket médio</p><p className="metrica-valor">{emReais(relatorio.ticketMedio)}</p><p className="metrica-nota">{relatorio.quantidadePedidos} {relatorio.quantidadePedidos === 1 ? 'pedido' : 'pedidos'}</p></div>
            <div className="metrica metrica-amarela"><p className="metrica-rotulo">Peças vendidas</p><p className="metrica-valor">{relatorio.unidadesVendidas}</p></div>
          </div>
          <section className="secao">
            <h2 className="secao-titulo">Receita {relatorio.serie.granularidade === 'dia' ? 'por dia' : 'por mês'}</h2>
            {temVendaNoPeriodo ? (
              <div className="cartao"><GraficoFaturamento meses={pontos} /></div>
            ) : (
              <EstadoVazio
                icone={<IconeGrafico tamanho={34} />}
                titulo="Nenhuma venda neste período"
                descricao="Escolha um período maior ou aguarde novas vendas confirmadas."
              />
            )}
          </section>
          {relatorio.ranking.length > 0 && (
            <section className="secao">
              <h2 className="secao-titulo">Suas peças que mais vendem</h2>
              {relatorio.ranking.map((item) => (
                <article className="linha-pedido" key={item.slug}>
                  <div className="dado"><span className="dado-rotulo">Peça</span><span className="dado-valor">{nomes.get(item.slug) ?? item.slug.replace(/-/g, ' ')}</span></div>
                  <div className="dado"><span className="dado-rotulo">Unidades</span><span className="dado-valor">{item.unidades}</span></div>
                  <div className="dado"><span className="dado-rotulo">Receita</span><span className="dado-valor preco-destaque">{emReais(item.receita)}</span></div>
                  <span className="selo selo-neutro"><IconeGrafico tamanho={13} />{item.participacao.toLocaleString('pt-BR')}% do total</span>
                </article>
              ))}
            </section>
          )}
          <p className="campo-ajuda acima-4">Como calculamos: {relatorio.formulaReceita}</p>
        </>
      )}
    </>
  )
}

