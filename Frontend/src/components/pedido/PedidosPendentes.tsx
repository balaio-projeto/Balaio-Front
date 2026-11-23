'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { Campo, Foto } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { avisar } from '@/components/feedback/Avisos'
import { IconeAviso, IconeFechar, IconePacote } from '@/components/ui/Icones'
import { emReais } from '@/utils/formato'
import { atualizarEstadoPedido, recusarPedido } from '@/services/api/pedidos.servico'
import { avisarPainelAtualizado } from '@/hooks/useArtesaoLogado'
import { textoDaMetrica } from '@/utils/painel'
import Preco from '@/components/ui/Preco'

export type PedidoPendente = {
  id: string
  comprador: string
  quando: string
  valor: number
  pecaNome?: string
  pecaTecnica?: string
  pecaImagem?: string
}

const NOME_PECA_INDISPONIVEL = 'Peça do pedido'

function nomeDaPeca(pedido: PedidoPendente) {
  return pedido.pecaNome || NOME_PECA_INDISPONIVEL
}

export default function PedidosPendentes({
  iniciais,
  erroCarregamento,
  faturamentoMes,
  emProducao,
  pecasAtivas,
  avisosPecas,
  erroResumo,
}: {
  iniciais: PedidoPendente[]
  erroCarregamento?: string
  faturamentoMes: number | null
  emProducao: number | null
  pecasAtivas: number | null
  avisosPecas: { slug: string; nome: string; motivo: string }[] | null
  erroResumo?: string
}) {
  const roteador = useRouter()
  const dialogoRecusa = useRef<HTMLDialogElement>(null)
  const [resolvidos, definirResolvidos] = useState<string[]>([])
  const [pedidoRecusado, definirPedidoRecusado] = useState<PedidoPendente | null>(null)
  const [motivo, definirMotivo] = useState('')
  const [erroMotivo, definirErroMotivo] = useState<string | null>(null)
  const [salvando, definirSalvando] = useState(false)
  const [processando, definirProcessando] = useState<string[]>([])
  const pedidosEmAndamento = useRef(new Set<string>())
  const pendentes = iniciais.filter((pedido) => !resolvidos.includes(pedido.id))

  function iniciarAtualizacao(id: string) {
    if (pedidosEmAndamento.current.has(id)) return false
    pedidosEmAndamento.current.add(id)
    definirProcessando((atuais) => [...atuais, id])
    return true
  }

  function finalizarAtualizacao(id: string) {
    pedidosEmAndamento.current.delete(id)
    definirProcessando((atuais) => atuais.filter((atual) => atual !== id))
  }

  const metricas = [
    {
      rotulo: 'Pedidos pendentes',
      valor: erroCarregamento ? textoDaMetrica(null) : String(pendentes.length),
      nota: erroCarregamento ? 'Não foi possível carregar agora' : 'Aguardando aceitação',
      classe: 'metrica-amarela',
    },
    {
      rotulo: 'Em produção',
      valor: textoDaMetrica(emProducao),
      nota: emProducao === null ? 'Não foi possível contar agora' : 'Nas bancadas e fornos',
      classe: 'metrica-azul',
    },
    {
      rotulo: 'Peças ativas',
      valor: textoDaMetrica(pecasAtivas),
      nota: pecasAtivas !== null ? 'Publicadas na vitrine' : erroResumo ? 'Resumo do painel indisponível' : 'Catálogo fora do ar agora',
      classe: 'metrica-verde',
    },
    {
      rotulo: 'Faturamento do mês',
      valor: textoDaMetrica(faturamentoMes, emReais),
      nota: faturamentoMes === null ? 'Não foi possível calcular agora' : 'Pagamentos confirmados neste mês',
      classe: 'metrica-branca',
    },
  ]

  async function aceitar(pedido: PedidoPendente) {
    if (!iniciarAtualizacao(pedido.id)) return
    try {
      const resposta = await atualizarEstadoPedido(pedido.id, 'producao')
      if (resposta.erro || resposta.dados?.estado !== 'producao')
        return avisar.erro('Não foi possível aceitar', resposta.erro?.mensagem)
      definirResolvidos((atuais) => [...new Set([...atuais, pedido.id])])
      avisarPainelAtualizado()
      roteador.refresh()
      avisar.sucesso('Pedido aceito', 'Combine o prazo com o comprador pela conversa.')
    } finally {
      finalizarAtualizacao(pedido.id)
    }
  }

  function abrirRecusa(pedido: PedidoPendente) {
    if (salvando || pedidosEmAndamento.current.has(pedido.id)) return
    definirPedidoRecusado(pedido)
    definirMotivo('')
    definirErroMotivo(null)
    dialogoRecusa.current?.showModal()
  }

  async function confirmarRecusa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!pedidoRecusado || salvando) return
    const texto = motivo.trim()
    if (texto.length < 5) {
      definirErroMotivo('Explique brevemente por que você não consegue atender este pedido')
      return
    }
    const pedido = pedidoRecusado
    if (!iniciarAtualizacao(pedido.id)) return
    definirSalvando(true)
    try {
      const resposta = await recusarPedido(pedido.id, texto)
      if (!resposta.dados) return avisar.erro('Não foi possível recusar', resposta.erro?.mensagem)
      if (['reembolso_pendente', 'cancelamento_pendente', 'encerramento_pendente'].includes(resposta.dados.estado)) {
        dialogoRecusa.current?.close()
        roteador.refresh()
        return avisar.info('Recusa em processamento', resposta.dados.estado === 'reembolso_pendente'
          ? 'Aguardamos a confirmação do reembolso antes de liberar a peça única no catálogo.'
          : 'A peça única ficará indisponível até a liberação confirmada pelo catálogo.')
      }
      definirResolvidos((atuais) => [...new Set([...atuais, pedido.id])])
      dialogoRecusa.current?.close()
      avisarPainelAtualizado()
      roteador.refresh()
      avisar.info('Pedido recusado', 'O comprador verá o motivo e a peça única, se houver, voltou à vitrine.')
    } finally {
      definirSalvando(false)
      finalizarAtualizacao(pedido.id)
    }
  }

  return (
    <>
      {avisosPecas === null && (
        <p className="aviso abaixo-4" role="status">
          {erroResumo
            ? 'Não foi possível carregar o resumo do painel agora. Os avisos de peças voltam quando ele responder.'
            : 'Não foi possível verificar suas peças no catálogo agora. Os avisos de peças voltam quando o catálogo responder.'}
        </p>
      )}
      {avisosPecas && avisosPecas.length > 0 && (
        <section className="painel-alertas" aria-labelledby="alertas-estoque">
          <div className="painel-alertas-icone"><IconeAviso tamanho={22} /></div>
          <div>
            <h2 id="alertas-estoque">Atenção à sua vitrine</h2>
            <ul>
              {avisosPecas.map((peca) => (
                <li key={`${peca.slug}-${peca.motivo}`}>
                  <strong>{peca.nome}</strong> · {peca.motivo}
                </li>
              ))}
            </ul>
            <Link href="/dashboard/pieces">Revisar minhas peças</Link>
          </div>
        </section>
      )}

      <div className="metricas">
        {metricas.map((m) => (
          <div className={`metrica ${m.classe}`} key={m.rotulo}>
            <p className="metrica-rotulo">{m.rotulo}</p>
            <p className="metrica-valor">{m.valor}</p>
            <p className="metrica-nota">{m.nota}</p>
          </div>
        ))}
      </div>

      <section className="secao">
        <h2 className="secao-titulo">Novos pedidos recebidos</h2>

        {erroCarregamento && <p role="alert">Não foi possível carregar os pedidos: {erroCarregamento}</p>}
        {!erroCarregamento && pendentes.length === 0 && (
          <EstadoVazio
            icone={<IconePacote tamanho={34} />}
            titulo="Nenhum pedido aguardando"
            descricao="Você aceitou todos os pedidos novos. Os próximos aparecem aqui assim que chegarem."
          />
        )}

        {pendentes.map((pedido) => (
          <article className="linha-pedido" key={pedido.id}>
            <div className="linha-flex encolhivel" style={{ flexWrap: 'nowrap' }}>
              <div className="linha-pedido-figura">
                {pedido.pecaImagem && <Foto nome={nomeDaPeca(pedido)} imagem={pedido.pecaImagem} decorativa />}
              </div>
              <div className="encolhivel">
                <p className="dado-valor">{nomeDaPeca(pedido)}</p>
                <p className="autoria">
                  {pedido.pecaTecnica ? `Técnica: ${pedido.pecaTecnica}` : 'Detalhes da peça indisponíveis no momento'}
                </p>
              </div>
            </div>

            <div className="dado">
              <span className="dado-rotulo">Comprador</span>
              <span className="dado-valor">{pedido.comprador}</span>
            </div>

            <div className="dado">
              <span className="dado-rotulo">Recebido</span>
              <span className="dado-valor">{pedido.quando}</span>
            </div>

            <div className="dado">
              <span className="dado-rotulo">Valor</span>
              <Preco valor={pedido.valor} className="dado-valor preco-destaque" />
            </div>

            <div className="acoes-linha">
              <span className="selo selo-encomenda">
                <span className="selo-ponto" />
                Pendente
              </span>
              <button type="button" className="botao botao-sucesso" disabled={processando.includes(pedido.id)} onClick={() => aceitar(pedido)}>
                Aceitar pedido
              </button>
              <button type="button" className="botao botao-fantasma" disabled={processando.includes(pedido.id)} onClick={() => abrirRecusa(pedido)}>
                Recusar
              </button>
            </div>
          </article>
        ))}
      </section>

      <dialog className="modal" ref={dialogoRecusa} aria-labelledby="recusa-titulo" onCancel={(evento) => { if (salvando) evento.preventDefault() }}>
        <div className="modal-cabecalho">
          <h2 className="modal-titulo" id="recusa-titulo">Recusar pedido</h2>
          <button type="button" className="modal-fechar" aria-label="Fechar" disabled={salvando} onClick={() => dialogoRecusa.current?.close()}>
            <IconeFechar tamanho={20} />
          </button>
        </div>
        <form onSubmit={confirmarRecusa}>
          <p className="texto-suave abaixo-4">
            {pedidoRecusado && nomeDaPeca(pedidoRecusado)}. O comprador verá a justificativa e será avisado sobre o cancelamento.
          </p>
          <Campo rotulo="Motivo da recusa" ajuda="Seja direto e cordial." erro={erroMotivo ?? undefined} id="motivo-recusa">
            <textarea id="motivo-recusa" value={motivo} maxLength={500} disabled={salvando} onChange={(evento) => definirMotivo(evento.target.value)} />
          </Campo>
          <div className="modal-acoes">
            <button type="button" className="botao botao-fantasma" disabled={salvando} onClick={() => dialogoRecusa.current?.close()}>Voltar</button>
            <button type="submit" className="botao botao-perigo" disabled={salvando}>{salvando ? 'Recusando…' : 'Confirmar recusa'}</button>
          </div>
        </form>
      </dialog>
    </>
  )
}
