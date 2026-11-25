import Link from 'next/link'
import { Foto } from '@/components/ui/Basicos'
import { obterPecaHistorico } from '@/services/api/pecas.servico'
import type { Pedido } from '@/types/dominio'
import { emReais } from '@/utils/formato'

export default async function ResumoItensPedido({ pedido }: { pedido: Pedido }) {
  const itens = pedido.itens ?? [{ slug: pedido.pecaSlug, quantidade: 1 }]
  const detalhados = await Promise.all(itens.map(async (item) => ({ ...item, peca: (await obterPecaHistorico(item.slug)).dados })))
  return <>
    {detalhados.map(({ slug, quantidade, preco, peca }) => <div className="item-sacola" key={slug}>
      <div className="item-sacola-figura"><Foto nome={peca?.nome ?? slug} imagem={peca?.imagem} decorativa /></div>
      <div>{peca?.inativadoEm ? <span className="texto-forte">{peca.nome}</span> : <Link className="texto-forte" href={`/pieces/${slug}`}>{peca?.nome ?? slug}</Link>}<p className="autoria">Quantidade: {quantidade}{preco !== undefined ? ` · ${emReais(preco)} por unidade na compra` : ''}</p></div>
    </div>)}
    {pedido.desconto && pedido.desconto.total > 0 && <>
      <p className="resumo"><span>Valor sem desconto</span><span>{emReais(pedido.desconto.valorSemDesconto)}</span></p>
      {pedido.desconto.produtos > 0 && <p className="resumo resumo-desconto">
        <span>Desconto{pedido.desconto.cupom ? ` do cupom ${pedido.desconto.cupom}` : ' da promoção'}</span>
        <strong>−{emReais(pedido.desconto.produtos)}</strong>
      </p>}
      {pedido.desconto.frete > 0 && <p className="resumo resumo-desconto">
        <span>Desconto no frete</span>
        <strong>−{emReais(pedido.desconto.frete)}</strong>
      </p>}
    </>}
    <p className="resumo resumo-total"><span>Total do pedido, com frete</span><strong>{emReais(pedido.total)}</strong></p>
    {pedido.simulado && <p className="campo-ajuda">Compra de demonstração. Nenhuma cobrança foi realizada.</p>}
  </>
}
