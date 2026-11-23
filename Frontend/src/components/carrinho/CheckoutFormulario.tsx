'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Campo, Foto, Migalhas } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeCadeado, IconeCaminhao, IconeCheck, IconeSacola, IconeSetaDireita } from '@/components/ui/Icones'
import { avisar } from '@/components/feedback/Avisos'
import { concluirCheckoutPendente, finalizarCompra } from '@/services/api/pedidos.servico'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import { useRevalidacaoSacola, useSacola } from '@/store/sacola'
import { usePecas } from '@/hooks/usePecas'
import { validarCEP, validarEstado, validarObrigatorio } from '@/utils/validacao'
import { useCotacaoFrete } from '@/hooks/useCotacaoFrete'
import { opcaoEscolhida, origemDaCotacao } from '@/utils/frete'
import { emReais, precoComDesconto } from '@/utils/formato'
import { listarEnderecos } from '@/services/api/conta.servico'
import type { EnderecoUsuario } from '@/types/dominio'
import { useBuscaCep } from '@/hooks/useBuscaCep'
import { entregaDoEnderecoSalvo, entregaPeloCep, formatarCep, type EnderecoPorCep, type EntregaDoCheckout } from '@/utils/cep'
import SeletorEnderecoSalvo, { OUTRO_ENDERECO } from './SeletorEnderecoSalvo'
import SeletorEstado from '@/components/forms/SeletorEstado'
import { abrirPagamentoAposLimpeza, linkDePagamentoConfiavel } from './abrirPagamento'

export default function CheckoutFormulario() {
  const { itens, pronto, erro: erroSacola, aviso, conflito, recarregar, limparConfirmado } = useSacola()
  const cotacao = useRevalidacaoSacola(itens, pronto && !erroSacola && !conflito)
  const precos = new Map(cotacao.valido ? cotacao.dados?.itens.map((item) => [item.slug, item] as const) : [])
  const { mapaPecas, carregando, erro } = usePecas()
  const [freteId, definirFrete] = useState<string | null>(null)
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [salvando, definirSalvando] = useState(false)
  const [concluido, definirConcluido] = useState(false)
  const [destinoPendente, definirDestinoPendente] = useState<string | null>(null)
  const [erroConfirmacao, definirErroConfirmacao] = useState<string | null>(null)
  const [entrega, definirEntrega] = useState({ cep: '', endereco: '', cidade: '', estado: '' })
  const entregaEditada = useRef(false)
  const enderecoSalvoId = useRef<string | null>(null)
  const [enderecosSalvos, definirEnderecosSalvos] = useState<EnderecoUsuario[]>([])
  const [enderecoEscolhido, definirEnderecoEscolhido] = useState(OUTRO_ENDERECO)
  const buscaCep = useBuscaCep(preencherPeloCep)
  const cotacaoFrete = useCotacaoFrete(entrega.cep, itens, pronto && !erroSacola && !conflito)
  const opcoesFrete = cotacaoFrete.opcoes
  const frete = opcaoEscolhida(opcoesFrete, freteId)

  function limparErrosDaEntrega(carregada: EntregaDoCheckout) {
    definirErros((atuais) => {
      const proximos = { ...atuais }
      if (!validarCEP(carregada.cep)) delete proximos['cep-checkout']
      if (!validarObrigatorio(carregada.endereco)) delete proximos.endereco
      if (!validarObrigatorio(carregada.cidade)) delete proximos.cidade
      if (!validarEstado(carregada.estado)) delete proximos.estado
      return proximos
    })
  }

  function preencherPeloCep(encontrado: EnderecoPorCep) {
    definirEntrega((atual) => entregaPeloCep(atual, encontrado))
    limparErrosDaEntrega(entregaPeloCep({ cep: '', endereco: '', cidade: '', estado: '' }, encontrado))
  }

  function escolherEnderecoSalvo(id: string) {
    const salvo = enderecosSalvos.find((item) => item.id === id)
    definirEnderecoEscolhido(salvo ? salvo.id : OUTRO_ENDERECO)
    buscaCep.esquecerCep()
    entregaEditada.current = true
    enderecoSalvoId.current = salvo?.id ?? null
    const proxima = salvo ? entregaDoEnderecoSalvo(salvo) : { cep: '', endereco: '', cidade: '', estado: '' }
    definirEntrega(proxima)
    if (salvo) limparErrosDaEntrega(proxima)
  }

  function atualizarEntrega(campo: keyof typeof entrega, valor: string) {
    entregaEditada.current = true
    enderecoSalvoId.current = null
    definirEnderecoEscolhido(OUTRO_ENDERECO)
    if (campo === 'cep') {
      void buscaCep.buscarCep(valor)
    }
    definirEntrega((atual) => ({ ...atual, [campo]: valor }))
    const id = campo === 'cep' ? 'cep-checkout' : campo
    definirErros((atuais) => {
      if (!atuais[id]) return atuais
      const problema = campo === 'cep'
        ? validarCEP(valor)
        : campo === 'estado'
          ? validarEstado(valor)
          : validarObrigatorio(valor, campo === 'endereco' ? 'Informe o endereço de entrega' : 'Informe a cidade')
      if (problema === atuais[id]) return atuais
      const proximos = { ...atuais }
      if (problema) proximos[id] = problema
      else delete proximos[id]
      return proximos
    })
  }

  useEffect(() => {
    let vivo = true
    listarEnderecos().then(({ dados: enderecos }) => {
      if (!vivo) return
      definirEnderecosSalvos(enderecos ?? [])
      if (entregaEditada.current) return
      const principal = enderecos?.find((item) => item.principal) ?? enderecos?.[0]
      if (!principal) return
      enderecoSalvoId.current = principal.id
      definirEnderecoEscolhido(principal.id)
      const enderecoCarregado = entregaDoEnderecoSalvo(principal)
      definirEntrega((atual) => entregaEditada.current ? atual : enderecoCarregado)
      if (!entregaEditada.current) limparErrosDaEntrega(enderecoCarregado)
    })
    return () => { vivo = false }
  }, [])

  const detalhados = itens.flatMap((item) => {
    const peca = mapaPecas.get(item.slug)
    return peca ? [{ item, peca }] : []
  })
  const indisponiveis = itens.filter((item) => !mapaPecas.has(item.slug))

  const subtotalCheio = detalhados.reduce((total, d) => total + d.peca.preco * d.item.quantidade, 0)
  const subtotal = detalhados.reduce((total, d) => total
    + (precos.get(d.item.slug)?.precoAtual ?? precoComDesconto(d.peca)) * d.item.quantidade, 0)
  const economia = cotacao.valido ? 0 : subtotalCheio - subtotal
  const total = subtotal + (frete?.valor ?? 0)

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (destinoPendente) { await abrirPagamento(destinoPendente); return }
    if (salvando || !detalhados.length || !frete || !cotacao.valido || !cotacao.dados?.podeProsseguir) return
    const dados = new FormData(evento.currentTarget)
    const proximosErros: Record<string, string> = {}

    const problemaCep = validarCEP(String(dados.get('cep') ?? ''))
    if (problemaCep) proximosErros['cep-checkout'] = problemaCep

    const problemaEndereco = validarObrigatorio(String(dados.get('endereco') ?? ''), 'Informe o endereço de entrega')
    if (problemaEndereco) proximosErros['endereco'] = problemaEndereco

    const problemaCidade = validarObrigatorio(String(dados.get('cidade') ?? ''), 'Informe a cidade')
    if (problemaCidade) proximosErros['cidade'] = problemaCidade

    const problemaEstado = validarEstado(String(dados.get('estado') ?? ''))
    if (problemaEstado) proximosErros['estado'] = problemaEstado

    definirErros(proximosErros)
    const primeiro = Object.keys(proximosErros)[0]
    if (primeiro) {
      document.getElementById(primeiro)?.focus()
      avisar.erro('Confira os campos destacados')
      return
    }

    definirSalvando(true)
    definirErroConfirmacao(null)
    const atual = await cotacao.revalidar()
    if (!atual || !atual.podeProsseguir) {
      definirSalvando(false)
      definirErroConfirmacao('Não foi possível confirmar preço e disponibilidade atuais. Confira a sacola e tente novamente.')
      return
    }
    if (JSON.stringify(atual.itens.map((item) => [item.slug, item.precoAtual, item.situacao]))
        !== JSON.stringify(cotacao.dados.itens.map((item) => [item.slug, item.precoAtual, item.situacao]))) {
      definirSalvando(false)
      definirErroConfirmacao('O preço ou a disponibilidade mudou. Revise os valores atuais antes de confirmar.')
      return
    }
    const resposta = await finalizarCompra({
      itens, freteId: frete.id, meio: 'checkout_pro',
      endereco: { cep: String(dados.get('cep')), endereco: String(dados.get('endereco')), cidade: String(dados.get('cidade')), estado: String(dados.get('estado')) },
      ...(enderecoSalvoId.current ? { enderecoId: enderecoSalvoId.current } : {}),
    })
    definirSalvando(false)
    if (resposta.erro || !resposta.dados) {
      const mensagem = resposta.erro?.mensagem ?? 'Tente novamente em instantes.'
      if (resposta.erro?.codigo === 'FRETE_INDISPONIVEL') cotacaoFrete.tentarNovamente()
      definirErroConfirmacao(mensagem)
      avisar.erro('Não foi possível registrar o pedido', mensagem)
      return
    }
    if (!resposta.dados.checkoutUrl) {
      definirErroConfirmacao('Pedido registrado; a página de pagamento ainda está sendo preparada. Tente novamente com os mesmos dados.')
      return
    }
    const destino = linkDePagamentoConfiavel(resposta.dados.checkoutUrl)
    if (!destino) {
      definirErroConfirmacao('A página de pagamento retornada é inválida. Tente novamente mais tarde.')
      return
    }
    await abrirPagamento(destino.href)
  }

  async function abrirPagamento(destino: string) {
    if (salvando) return
    definirSalvando(true)
    const limpeza = await abrirPagamentoAposLimpeza(limparConfirmado, destino, (url) => {
      concluirCheckoutPendente()
      definirConcluido(true)
      avisar.sucesso('Pedido registrado', 'Abrindo o checkout de teste do Mercado Pago.')
      window.location.assign(url)
    })
    definirSalvando(false)
    if (!limpeza.ok) {
      definirDestinoPendente(destino)
      definirErroConfirmacao(`Pedido registrado, mas a sacola da conta ainda não foi limpa. ${limpeza.mensagem ?? 'Tente novamente.'}`)
      return
    }
    definirDestinoPendente(null)
  }

  if ((!pronto || carregando) && !concluido) {
    return (
      <>
        <Migalhas
          trilha={[{ texto: 'Início', href: '/' }, { texto: 'Sacola', href: '/cart' }, { texto: 'Revisão da compra' }]}
        />
        <h1 className="titulo-pagina">Finalizar compra</h1>
        <EstadoCarregando rotulo="Carregando sua sacola…" cartoes={2} />
      </>
    )
  }

  if (concluido) return <EstadoCarregando rotulo="Abrindo o pagamento de teste…" cartoes={1} />

  if (erroSacola && !conflito) return <EstadoErro mensagem={erroSacola} aoTentarNovamente={recarregar} />
  if (conflito) return <EstadoVazio
    icone={<IconeSacola tamanho={34} />}
    titulo="Revise sua sacola"
    descricao="Há um item que impede a mesclagem da sacola. Retire o item na sacola para continuar."
    acao={<Link href="/cart" className="botao botao-primario">Corrigir sacola</Link>}
  />
  if (erro) return <EstadoErro mensagem={erro} />

  if (pronto && detalhados.length === 0 && !concluido) {
    return (
      <>
        <Migalhas
          trilha={[{ texto: 'Início', href: '/' }, { texto: 'Sacola', href: '/cart' }, { texto: 'Revisão da compra' }]}
        />
        <h1 className="titulo-pagina">Finalizar compra</h1>
        <EstadoVazio
          icone={<IconeSacola tamanho={34} />}
          titulo={itens.length ? 'As peças da sacola estão indisponíveis' : 'Sua sacola está vazia'}
          descricao={itens.length ? 'Volte à sacola para remover as peças indisponíveis e continuar explorando.' : 'Adicione uma peça à sacola para revisar sua compra.'}
          acao={
            <Link href={itens.length ? '/cart' : '/'} className="botao botao-primario">
              {itens.length ? 'Rever sacola' : 'Explorar o catálogo'}
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <Migalhas
        trilha={[{ texto: 'Início', href: '/' }, { texto: 'Sacola', href: '/cart' }, { texto: 'Revisão da compra' }]}
      />

      <h1 className="titulo-pagina">Finalizar compra</h1>
      {aviso && <p className="aviso abaixo-4" role="alert">{aviso}</p>}
      <div className="aviso abaixo-4" role={cotacao.erro ? 'alert' : 'status'}>
        <p>{cotacao.consultando ? 'Conferindo preço e disponibilidade atuais…'
          : cotacao.erro ? `Não foi possível revalidar a sacola: ${cotacao.erro} Os preços abaixo são apenas referência.`
            : cotacao.dados?.podeProsseguir ? 'Preços conferidos agora. A disponibilidade será confirmada pela reserva no checkout.'
              : 'Há peça indisponível. Revise a sacola antes de continuar.'}</p>
        {!cotacao.consultando && <button type="button" className="botao-texto" onClick={() => void cotacao.revalidar()}>
          Conferir novamente
        </button>}
      </div>
      <p className="subtitulo-pagina">
        O pagamento de teste acontece no site seguro do Mercado Pago. Os dados do cartão não passam pelo Balaio.
      </p>

      <ol className="etapas-compra">
        <li className="etapa-compra etapa-compra-feita">
          <span className="etapa-compra-numero" aria-hidden>
            <IconeCheck tamanho={14} />
          </span>
          <span className="etapa-compra-texto">Sacola</span>
        </li>
        <li className="etapas-compra-seta" aria-hidden>
          →
        </li>
        <li className="etapa-compra etapa-compra-atual" aria-current="step">
          <span className="etapa-compra-numero" aria-hidden>
            2
          </span>
          <span className="etapa-compra-texto">Entrega e pagamento</span>
        </li>
        <li className="etapas-compra-seta" aria-hidden>
          →
        </li>
        <li className="etapa-compra">
          <span className="etapa-compra-numero" aria-hidden>
            3
          </span>
          <span className="etapa-compra-texto">Confirmação</span>
        </li>
      </ol>

      <form className="duas-colunas" onSubmit={confirmar} noValidate>
        <div>
          <section className="cartao abaixo-5">
            <h2 className="secao-titulo">Endereço de entrega</h2>
            <SeletorEnderecoSalvo enderecos={enderecosSalvos} selecionado={enderecoEscolhido} aoSelecionar={escolherEnderecoSalvo} />
            <Campo rotulo="CEP" erro={erros['cep-checkout']} id="cep-checkout">
              <input id="cep-checkout" name="cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="50000-000" value={entrega.cep} onChange={(e) => atualizarEntrega('cep', formatarCep(e.target.value))} />
            </Campo>
            {buscaCep.mensagem && (
              <p className={buscaCep.situacao === 'inexistente' || buscaCep.situacao === 'erro' ? 'aviso abaixo-4' : 'campo-ajuda abaixo-4'} role="status" aria-live="polite" data-busca-cep={buscaCep.situacao}>
                {buscaCep.mensagem}
              </p>
            )}
            <Campo rotulo="Endereço" erro={erros['endereco']} id="endereco">
              <input id="endereco" name="endereco" value={entrega.endereco} onChange={(e) => atualizarEntrega('endereco', e.target.value)} />
            </Campo>
            <div className="grade-dois">
              <Campo rotulo="Cidade" erro={erros['cidade']} id="cidade">
                <input id="cidade" name="cidade" value={entrega.cidade} onChange={(e) => atualizarEntrega('cidade', e.target.value)} />
              </Campo>
              <SeletorEstado
                erro={erros['estado']}
                id="estado"
                value={entrega.estado}
                onChange={(valor) => atualizarEntrega('estado', valor)}
              />
            </div>
          </section>

          <section className="cartao abaixo-5">
            <h2 className="secao-titulo">Como você quer receber</h2>
            {!cotacaoFrete.cepValido ? (
              <p className="texto-suave" role="status">Informe o CEP de entrega para ver as opções de frete.</p>
            ) : cotacaoFrete.consultando ? (
              <p className="texto-suave" role="status">Cotando o frete para o CEP informado…</p>
            ) : cotacaoFrete.erro ? (
              <div className="aviso" role="alert">
                <p>Não foi possível cotar o frete: {cotacaoFrete.erro}</p>
                <button type="button" className="botao-texto" onClick={cotacaoFrete.tentarNovamente}>Cotar novamente</button>
              </div>
            ) : opcoesFrete.length === 0 ? (
              <p className="aviso" role="status">Nenhuma transportadora atende este CEP com as peças da sacola.</p>
            ) : (
              <p className="campo-ajuda abaixo-3" role="status">{origemDaCotacao(opcoesFrete)}</p>
            )}
            <div className="opcoes">
              {opcoesFrete.map((opcao) => (
                <label className="opcao opcao-topo" key={opcao.id}>
                  <input type="radio" name="frete" checked={frete?.id === opcao.id} onChange={() => definirFrete(opcao.id)} />
                  <span className="encolhivel">
                    <span className="linha-flex" style={{ gap: 8, fontWeight: 600 }}>
                      <IconeCaminhao />
                      {opcao.nome}
                    </span>
                    <span className="campo-ajuda">
                      {opcao.prazo} · {emReais(opcao.valor)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="cartao">
            <h2 className="secao-titulo">Pagamento</h2>
            <p className="texto-suave">Você escolherá o meio de pagamento no Checkout Pro de teste do Mercado Pago.</p>
          </section>
        </div>

        <aside className="cartao coluna-compra">
          <h2 className="secao-titulo">Seu pedido</h2>

          {indisponiveis.length > 0 && (
            <div className="aviso abaixo-4" role="status">
              <p>Estas peças não estão disponíveis no catálogo:</p>
              <ul>{indisponiveis.map((item) => <li key={item.slug}>{item.slug.replace(/-/g, ' ')} · Quantidade: {item.quantidade}</li>)}</ul>
              <Link href="/cart" className="botao-texto">Rever sacola e remover peças indisponíveis</Link>
            </div>
          )}

          {detalhados.map(({ peca, item }) => {
            const cotado = precos.get(item.slug)
            return (
            <div className="item-sacola" key={peca.slug} style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}>
              <div className="item-sacola-figura">
                <Foto nome={peca.nome} imagem={peca.imagem} decorativa />
              </div>
              <div className="encolhivel">
                <p style={{ fontWeight: 600 }}>
                  {peca.nome}
                  {item.quantidade > 1 ? ` × ${item.quantidade}` : ''}
                </p>
                <p className="autoria linha-preco">
                  {peca.desconto && !cotacao.valido && <span className="preco-riscado">{emReais(peca.preco * item.quantidade)}</span>}
                  {emReais((cotado?.precoAtual ?? precoComDesconto(peca)) * item.quantidade)}
                </p>
                {cotado?.situacao === 'indisponivel' &&
                  <p className="aviso" role="status">Peça indisponível.</p>}
                {cotado?.precoAtual !== null && cotado?.precoAtual !== undefined
                  && cotado.precoAtual !== precoComDesconto(peca) &&
                  <p className="campo-ajuda">Preço atualizado: {emReais(cotado.precoAtual)} por unidade.</p>}
              </div>
            </div>
          )})}

          <p className="resumo acima-3">
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
            <span>Frete</span>
            <strong>{frete ? emReais(frete.valor) : 'A cotar'}</strong>
          </p>
          <p className="resumo resumo-total">
            <span>Total</span>
            <span className="preco-destaque">{emReais(total)}</span>
          </p>

          {erroConfirmacao && (
            <p className="aviso acima-3" role="alert">{erroConfirmacao}</p>
          )}

          <div className="barra-fixa barra-fixa-total">
            <p className="barra-fixa-info">
              <span className="barra-fixa-rotulo">Total</span>
              <span className="barra-fixa-valor">{emReais(total)}</span>
            </p>
            <button disabled={salvando || concluido || (!destinoPendente && (!frete || !cotacao.valido || !cotacao.dados?.podeProsseguir))} type="submit" className="botao botao-sucesso botao-largo">
              {salvando ? 'Aguarde…' : destinoPendente ? 'Tentar abrir pagamento' : 'Confirmar compra'} <span className="esconde-mobile">{emReais(total)}</span>
              <IconeSetaDireita />
            </button>
          </div>

          <p className="nota-fiscal acima-4" style={{ display: 'flex', gap: 10 }}>
            <IconeCadeado />
            <span>
              Esta etapa registra o pedido e abre um pagamento em ambiente de teste. <strong>A confirmação depende do provedor.</strong>
            </span>
          </p>
        </aside>
      </form>
    </>
  )
}
