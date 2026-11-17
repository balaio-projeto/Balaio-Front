'use client'

import Link from 'next/link'
import { Foto, SeloDisponibilidade } from '@/components/ui/Basicos'
import Seletor from '@/components/ui/Seletor'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeSacola, IconeSetaDireita } from '@/components/ui/Icones'
import { useRevalidacaoSacola, useSacola } from '@/store/sacola'
import { useSessao } from '@/store/sessao'
import { avisar } from '@/components/feedback/Avisos'
import { usePecas } from '@/hooks/usePecas'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import { useDados } from '@/store/dados'
import { emReais, precoComDesconto } from '@/utils/formato'

const QUANTIDADES = ['1', '2', '3']

export default function ItensSacola() {
  const { mapaPecas, carregando, erro } = usePecas()
  const { artesaos, fretes, carregando: carregandoFretes, erroFretes } = useDados()
  const { itens, pronto, erro: erroSacola, aviso, conflito, recarregar,
    remover, removerParaMesclar, repor, alterarQuantidade } = useSacola()
  const { sessao } = useSessao()
  const cotacao = useRevalidacaoSacola(itens, Boolean(sessao && pronto && !erroSacola && !conflito))
  const precos = new Map(cotacao.valido ? cotacao.dados?.itens.map((item) => [item.slug, item] as const) : [])

  const detalhados = itens.flatMap((item) => {
    const peca = mapaPecas.get(item.slug)
    return peca ? [{ item, peca }] : []
  })
  const indisponiveis = itens.filter((item) => !mapaPecas.has(item.slug))

  const subtotalCheio = detalhados.reduce((total, d) => total + d.peca.preco * d.item.quantidade, 0)
  const subtotal = detalhados.reduce((total, d) => total
    + (precos.get(d.item.slug)?.precoAtual ?? precoComDesconto(d.peca)) * d.item.quantidade, 0)
  const economia = cotacao.valido ? 0 : subtotalCheio - subtotal
  const frete = fretes[0]?.valor ?? 0

  function removerItem(slug: string, nome: string) {
    if (conflito) { removerParaMesclar(slug); return }
    const posicao = itens.findIndex((i) => i.slug === slug)
    const item = itens[posicao]
    remover(slug)
    avisar.desfazivel(`${nome} saiu da sacola`, () => repor(item, posicao))
  }

  if (!pronto || carregando || carregandoFretes) return <EstadoCarregando />
  if (erroSacola && !conflito) return <EstadoErro mensagem={erroSacola} aoTentarNovamente={recarregar} />
  if ((erro || erroFretes || !fretes.length) && !conflito)
    return <EstadoErro mensagem={erro ?? erroFretes ?? 'Nenhuma opção de entrega disponível.'} />

  if (itens.length === 0) {
    return (
      <>
      {aviso && <p className="aviso abaixo-4" role="alert">{aviso}</p>}
      <EstadoVazio
        icone={<IconeSacola tamanho={34} />}
        titulo="Sua sacola está vazia"
        descricao="As peças que você adicionar aparecem aqui, prontas para finalizar a compra."
        acao={
          <Link href="/" className="botao botao-primario">
            Explorar o catálogo
          </Link>
        }
      />
      </>
    )
  }

  return (
    <>
      {aviso && <p className="aviso abaixo-4" role="alert">{aviso}</p>}
      {conflito && <div className="aviso abaixo-4" role="alert">
        <p>Não foi possível mesclar a sacola: {erroSacola} Retire o item indisponível ou tente novamente.</p>
        <button type="button" className="botao-texto" onClick={recarregar}>Tentar novamente</button>
      </div>}
      {sessao && !conflito && <div className="aviso abaixo-4" role={cotacao.erro ? 'alert' : 'status'}>
        <p>{cotacao.consultando ? 'Conferindo preços e disponibilidade atuais…'
          : cotacao.erro ? `Não foi possível revalidar a sacola: ${cotacao.erro} Os valores exibidos são apenas referência.`
            : cotacao.dados?.podeProsseguir ? 'Preços e disponibilidade conferidos agora. A reserva ocorre no checkout.'
              : 'Há peça indisponível. Remova-a antes de continuar.'}</p>
        {!cotacao.consultando && <button type="button" className="botao-texto" onClick={() => void cotacao.revalidar()}>
          Conferir novamente
        </button>}
      </div>}
      <p className="subtitulo-pagina">
        {itens.length} {itens.length === 1 ? 'peça na sacola' : 'peças na sacola'}.
      </p>

      <div className="duas-colunas">
        <section className="cartao">
          {indisponiveis.map((item) => (
            <article className="item-sacola" key={item.slug}>
              <div className="item-sacola-figura">
                <Foto nome="Peça indisponível" decorativa />
              </div>
              <div className="encolhivel">
                <p className="texto-forte">{item.slug.replace(/-/g, ' ')}</p>
                <p className="autoria">Esta peça não está disponível no catálogo.</p>
                <p className="campo-ajuda">Quantidade: {item.quantidade}</p>
                <button
                  type="button"
                  className="botao-texto botao-texto-perigo acima-3"
                  onClick={() => removerItem(item.slug, item.slug.replace(/-/g, ' '))}
                >
                  {conflito ? 'Retirar e tentar mesclar' : 'Remover'}
                </button>
              </div>
            </article>
          ))}
          {detalhados.map(({ peca, item }) => {
            const artesao = artesaos.find((a) => a.slug === peca.artesao)
            const cotado = precos.get(item.slug)
            const disponibilidade = cotado?.disponibilidade && cotado.disponibilidade !== 'indisponivel'
              ? cotado.disponibilidade : peca.disponibilidade
            return (
              <article className="item-sacola" key={peca.slug}>
                <div className="item-sacola-figura">
                  <Foto nome={peca.nome} imagem={peca.imagem} decorativa />
                </div>
                <div className="encolhivel">
                  <div className="linha-flex linha-entre" style={{ alignItems: 'flex-start' }}>
                    <div className="encolhivel">
                      <Link href={`/pieces/${peca.slug}`} className="texto-forte" style={{ color: 'var(--tinta)' }}>
                        {peca.nome}
                      </Link>
                      <p className="autoria">
                        por {artesao?.nome} · {peca.territorio}
                      </p>
                    </div>
                    <span className="linha-preco">
                      {peca.desconto && !cotacao.valido && (
                        <span className="preco-riscado">{emReais(peca.preco * item.quantidade)}</span>
                      )}
                      <strong className="preco">{emReais((cotado?.precoAtual ?? precoComDesconto(peca)) * item.quantidade)}</strong>
                    </span>
                  </div>

                  {cotado?.situacao === 'indisponivel' &&
                    <p className="aviso acima-3" role="status">Peça indisponível na revalidação.</p>}
                  {cotado?.precoAtual !== null && cotado?.precoAtual !== undefined
                    && cotado.precoAtual !== precoComDesconto(peca) &&
                    <p className="campo-ajuda">Preço atualizado: {emReais(cotado.precoAtual)} por unidade.</p>}

                  <div className="linha-flex acima-3">
                    {cotado?.situacao !== 'indisponivel' &&
                      <SeloDisponibilidade tipo={disponibilidade}
                        prazoDias={peca.prazoProducaoDias} />}
                    {peca.desconto && !cotacao.valido && (
                      <span className="etiqueta-desconto">
                        {peca.desconto}%<span className="so-leitor"> de desconto da plataforma</span>
                      </span>
                    )}
                    {peca.disponibilidade !== 'unica' && !conflito && (
                      <div className="linha-flex" style={{ gap: 8, fontSize: 14 }}>
                        <span id={`quantidade-${peca.slug}`}>Quantidade</span>
                        <Seletor
                          compacto
                          className="seletor-quantidade"
                          aria-labelledby={`quantidade-${peca.slug}`}
                          opcoes={QUANTIDADES}
                          value={String(item.quantidade)}
                          onChange={(valor) => alterarQuantidade(peca.slug, Number(valor))}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      className="botao-texto botao-texto-perigo"
                      onClick={() => removerItem(peca.slug, peca.nome)}
                    >
                      {conflito ? 'Retirar e tentar mesclar' : 'Remover'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          <p className="acima-4">
            <Link href="/" className="ver-peca">
              ← Continuar explorando o catálogo
            </Link>
          </p>
        </section>

        {detalhados.length > 0 ? <aside className="cartao coluna-compra">
          <h2 className="secao-titulo">Resumo do pedido</h2>

          {indisponiveis.length > 0 && <p className="aviso abaixo-4" role="status">Há peças indisponíveis na sacola. Remova-as para revisar os itens disponíveis.</p>}

          <p className="resumo">
            <span>Subtotal</span>
            <strong>{emReais(cotacao.valido ? subtotal : subtotalCheio)}</strong>
          </p>
          {economia > 0 && (
            <p className="resumo resumo-desconto">
              <span>Desconto da plataforma</span>
              <strong>{emReais(economia)}</strong>
            </p>
          )}
          <p className="resumo">
            <span>Frete de origem</span>
            <strong>{emReais(frete)}</strong>
          </p>
          <p className="resumo resumo-total">
            <span>Total</span>
            <span className="preco-destaque">{emReais(subtotal + frete)}</span>
          </p>

          <div className="barra-fixa barra-fixa-total">
            <p className="barra-fixa-info">
              <span className="barra-fixa-rotulo">Total</span>
              <span className="barra-fixa-valor">{emReais(subtotal + frete)}</span>
            </p>
            {!conflito && indisponiveis.length === 0 && (!sessao || (cotacao.valido && cotacao.dados?.podeProsseguir)) && <Link href="/checkout" className="botao botao-primario botao-largo">
              Ir para o pagamento
              <IconeSetaDireita />
            </Link>}
          </div>

          <p className="campo-ajuda acima-3" style={{ textAlign: 'center' }}>
            O pagamento de teste é processado pelo Mercado Pago; acompanhe o estado no pedido.
          </p>
        </aside> : <aside className="cartao">
          <h2 className="secao-titulo">Peças indisponíveis</h2>
          <p className="texto-suave abaixo-4">As peças desta sacola não estão disponíveis no catálogo. Você pode removê-las e continuar explorando.</p>
          <Link href="/" className="botao botao-primario">Explorar o catálogo</Link>
        </aside>}
      </div>
    </>
  )
}
