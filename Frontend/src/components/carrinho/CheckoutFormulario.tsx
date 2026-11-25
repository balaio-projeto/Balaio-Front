'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Campo, Foto, Migalhas } from '@/components/ui/Basicos'
import EstadoVazio from '@/components/feedback/EstadoVazio'
import { IconeCadeado, IconeCaminhao, IconeCasa, IconeCheck, IconeOferta, IconeSacola, IconeSetaDireita } from '@/components/ui/Icones'
import { avisar } from '@/components/feedback/Avisos'
import { concluirCheckoutPendente, finalizarCompra } from '@/services/api/pedidos.servico'
import EstadoErro from '@/components/feedback/EstadoErro'
import EstadoCarregando from '@/components/feedback/EstadoCarregando'
import { useRevalidacaoSacola, useSacola } from '@/store/sacola'
import { usePecas } from '@/hooks/usePecas'
import { validarCEP, validarComprimento, validarEstado, validarObrigatorio } from '@/utils/validacao'
import { useCotacaoFrete } from '@/hooks/useCotacaoFrete'
import { useDados } from '@/store/dados'
import { entregaCombinada, opcaoEscolhida, origemDaCotacao, valorDoFreteEmTexto } from '@/utils/frete'
import { normalizarCodigoCupom, resumoDaPrevia, totaisDoCheckout, validarCodigoCupom, type PreviaCupom } from '@/utils/cupom'
import { simularCupom } from '@/services/api/cupons.servico'
import { emReais, precoComDesconto } from '@/utils/formato'
import { listarEnderecos } from '@/services/api/conta.servico'
import type { EnderecoUsuario } from '@/types/dominio'
import { useBuscaCep } from '@/hooks/useBuscaCep'
import { enderecoComNumero, entregaDoEnderecoSalvo, entregaPeloCep, formatarCep, type EnderecoPorCep, type EntregaDoCheckout } from '@/utils/cep'
import SeletorEnderecoSalvo, { OUTRO_ENDERECO } from './SeletorEnderecoSalvo'
import SeletorEstado from '@/components/forms/SeletorEstado'
import { abrirPagamentoAposLimpeza, linkDePagamentoConfiavel } from './abrirPagamento'
import { agruparPorAtelie, grupoEscolhido } from './gruposAtelie'
import Preco from '@/components/ui/Preco'

const LIMITE_ENDERECO = 200
const LIMITE_CIDADE = 100

type PagamentoPendente = { destino: string; slugs: string[] }

function problemaDaEntrega(campo: keyof EntregaDoCheckout, valor: string): string | null {
  if (campo === 'cep') return validarCEP(valor)
  if (campo === 'estado') return validarEstado(valor)
  if (campo === 'endereco') return validarObrigatorio(valor, 'Informe o endereço de entrega')
    ?? validarComprimento(valor, LIMITE_ENDERECO, `Use até ${LIMITE_ENDERECO} caracteres no endereço`)
  return validarObrigatorio(valor, 'Informe a cidade')
    ?? validarComprimento(valor, LIMITE_CIDADE, `Use até ${LIMITE_CIDADE} caracteres na cidade`)
}

const LIMITE_NUMERO = 20
const LIMITE_COMPLEMENTO = 100

const ID_DO_CAMPO: Record<keyof EntregaDoCheckout, string> = {
  cep: 'cep-checkout', endereco: 'endereco', cidade: 'cidade', estado: 'estado',
}

export default function CheckoutFormulario() {
  const { itens, pronto, erro: erroSacola, aviso, conflito, sincronizando, recarregar, removerConfirmado } = useSacola()
  const { mapaPecas, carregando, erro } = usePecas()
  const { artesaos } = useDados()
  const [atelieEscolhido, definirAtelieEscolhido] = useState<string | null>(null)
  const detalhados = itens.flatMap((item) => {
    const peca = mapaPecas.get(item.slug)
    return peca ? [{ item, peca }] : []
  })
  const indisponiveis = itens.filter((item) => !mapaPecas.has(item.slug))
  const grupos = agruparPorAtelie(detalhados, artesaos)
  const grupo = grupoEscolhido(grupos, atelieEscolhido)
  const doGrupo = grupo?.entradas ?? []
  const itensDoGrupo = doGrupo.map(({ item }) => item)
  const cotacao = useRevalidacaoSacola(itens, pronto && !erroSacola && !conflito && !sincronizando,
    itensDoGrupo.map((item) => item.slug))
  const precos = new Map(cotacao.valido ? cotacao.dados?.itens.map((item) => [item.slug, item] as const) : [])
  const [freteId, definirFrete] = useState<string | null>(null)
  const [erros, definirErros] = useState<Record<string, string>>({})
  const [salvando, definirSalvando] = useState(false)
  const [concluido, definirConcluido] = useState(false)
  const [pagamentoPendente, definirPagamentoPendente] = useState<PagamentoPendente | null>(null)
  const [erroConfirmacao, definirErroConfirmacao] = useState<string | null>(null)
  const [entrega, definirEntrega] = useState({ cep: '', endereco: '', cidade: '', estado: '' })
  const [numeroEntrega, definirNumeroEntrega] = useState('')
  const [complementoEntrega, definirComplementoEntrega] = useState('')
  const entregaEditada = useRef(false)
  const enderecoSalvoId = useRef<string | null>(null)
  const [enderecosSalvos, definirEnderecosSalvos] = useState<EnderecoUsuario[]>([])
  const [enderecoEscolhido, definirEnderecoEscolhido] = useState(OUTRO_ENDERECO)
  const buscaCep = useBuscaCep(preencherPeloCep)
  const cotacaoFrete = useCotacaoFrete(entrega.cep, itensDoGrupo, pronto && !erroSacola && !conflito)
  const opcoesFrete = cotacaoFrete.opcoes
  const frete = opcaoEscolhida(opcoesFrete, freteId)
  const [codigoCupom, definirCodigoCupom] = useState('')
  const [cupomAplicado, definirCupomAplicado] = useState<string | null>(null)
  const [previaCupom, definirPreviaCupom] = useState<{ chave: string; previa: PreviaCupom | null } | null>(null)
  const [erroCupom, definirErroCupom] = useState<string | null>(null)
  const [aplicandoCupom, definirAplicandoCupom] = useState(false)
  const [rodadaCupom, definirRodadaCupom] = useState(0)
  const itensDaSimulacao = itensDoGrupo.map((item) => ({ slug: item.slug, quantidade: item.quantidade }))
  const chaveSimulacao = JSON.stringify([itensDaSimulacao, cupomAplicado, frete?.valor ?? null, rodadaCupom])
  const simulacaoAtiva = pronto && !erroSacola && !conflito && itensDaSimulacao.length > 0

  function limparErrosDaEntrega(carregada: EntregaDoCheckout) {
    definirErros((atuais) => {
      const proximos = { ...atuais }
      for (const campo of Object.keys(ID_DO_CAMPO) as (keyof EntregaDoCheckout)[])
        if (!problemaDaEntrega(campo, carregada[campo])) delete proximos[ID_DO_CAMPO[campo]]
      return proximos
    })
  }

  function escolherAtelie(artesao: string) {
    if (salvando || pagamentoPendente) return
    definirAtelieEscolhido(artesao)
    definirFrete(null)
    definirErroConfirmacao(null)
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
    const id = ID_DO_CAMPO[campo]
    definirErros((atuais) => {
      if (!atuais[id]) return atuais
      const problema = problemaDaEntrega(campo, valor)
      if (problema === atuais[id]) return atuais
      const proximos = { ...atuais }
      if (problema) proximos[id] = problema
      else delete proximos[id]
      return proximos
    })
  }

  useEffect(() => {
    if (!simulacaoAtiva) return
    const controle = new AbortController()
    const [itensSimulados, cupomSimulado, freteSimulado] = JSON.parse(chaveSimulacao) as
      [{ slug: string; quantidade: number }[], string | null, number | null, number]
    const espera = setTimeout(() => {
      void simularCupom({
        itens: itensSimulados,
        ...(cupomSimulado ? { cupom: cupomSimulado } : {}),
        ...(freteSimulado !== null ? { frete: freteSimulado } : {}),
      }, controle.signal).then((resposta) => {
        if (controle.signal.aborted) return
        if (resposta.erro && cupomSimulado) {
          definirErroCupom(resposta.erro.mensagem)
          definirCupomAplicado(null)
          return
        }
        definirPreviaCupom({ chave: chaveSimulacao, previa: resposta.erro ? null : resposta.dados })
      })
    }, 300)
    return () => { clearTimeout(espera); controle.abort() }
  }, [chaveSimulacao, simulacaoAtiva])

  async function aplicarCupom() {
    const problema = validarCodigoCupom(codigoCupom)
    if (problema) { definirErroCupom(problema); return }
    if (!itensDaSimulacao.length || aplicandoCupom) return
    const codigo = normalizarCodigoCupom(codigoCupom)
    definirAplicandoCupom(true)
    definirErroCupom(null)
    const resposta = await simularCupom({ itens: itensDaSimulacao, cupom: codigo, ...(frete ? { frete: frete.valor } : {}) })
    definirAplicandoCupom(false)
    if (resposta.erro || !resposta.dados) {
      definirErroCupom(resposta.erro?.mensagem ?? 'Não foi possível validar o cupom agora.')
      return
    }
    definirCupomAplicado(codigo)
    definirCodigoCupom(codigo)
    avisar.sucesso('Cupom aplicado', resumoDaPrevia(resposta.dados))
  }

  function removerCupom() {
    definirCupomAplicado(null)
    definirCodigoCupom('')
    definirErroCupom(null)
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

  const subtotalCheio = doGrupo.reduce((total, d) => total + d.peca.preco * d.item.quantidade, 0)
  const subtotal = doGrupo.reduce((total, d) => total
    + (precos.get(d.item.slug)?.precoAtual ?? precoComDesconto(d.peca)) * d.item.quantidade, 0)
  const economia = cotacao.valido ? 0 : subtotalCheio - subtotal
  const previa = previaCupom?.chave === chaveSimulacao ? previaCupom.previa : null
  const totais = totaisDoCheckout(subtotal, frete?.valor ?? 0, previa)
  const total = totais.total

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (pagamentoPendente) { await abrirPagamento(pagamentoPendente); return }
    if (salvando || !itensDoGrupo.length || !frete || !cotacao.valido || !cotacao.dados?.podeProsseguir) return
    const dados = new FormData(evento.currentTarget)
    const enderecoManual = enderecoSalvoId.current === null
    const ruaEBairro = String(dados.get('endereco') ?? '').trim()
    const preenchida: EntregaDoCheckout = {
      cep: String(dados.get('cep') ?? '').trim(),
      endereco: enderecoManual && ruaEBairro && numeroEntrega.trim()
        ? enderecoComNumero(ruaEBairro, numeroEntrega, complementoEntrega) : ruaEBairro,
      cidade: String(dados.get('cidade') ?? '').trim(),
      estado: String(dados.get('estado') ?? '').trim(),
    }
    const proximosErros: Record<string, string> = {}
    for (const campo of Object.keys(ID_DO_CAMPO) as (keyof EntregaDoCheckout)[]) {
      const problema = problemaDaEntrega(campo, preenchida[campo])
      if (problema) proximosErros[ID_DO_CAMPO[campo]] = problema
    }
    if (enderecoManual) {
      const problemaNumero = validarObrigatorio(numeroEntrega, 'Informe o número ou S/N')
        ?? validarComprimento(numeroEntrega, LIMITE_NUMERO, `Use até ${LIMITE_NUMERO} caracteres no número`)
      if (problemaNumero) proximosErros['numero-checkout'] = problemaNumero
      const problemaComplemento = validarComprimento(complementoEntrega, LIMITE_COMPLEMENTO, `Use até ${LIMITE_COMPLEMENTO} caracteres no complemento`)
      if (problemaComplemento) proximosErros['complemento-checkout'] = problemaComplemento
    }

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
    const slugsDoGrupo = itensDoGrupo.map((item) => item.slug)
    const resposta = await finalizarCompra({
      itens: itensDoGrupo, freteId: frete.id, meio: 'checkout_pro',
      endereco: preenchida,
      ...(enderecoSalvoId.current ? { enderecoId: enderecoSalvoId.current } : {}),
      ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
    })
    definirSalvando(false)
    if (resposta.erro || !resposta.dados) {
      const mensagem = resposta.erro?.codigo === 'PEDIDO_CONFLITANTE'
        ? 'Cada ateliê é pago separadamente e alguma peça deste pagamento pertence a outro ateliê. Volte à sacola, confira as peças e tente novamente.'
        : resposta.erro?.mensagem ?? 'Tente novamente em instantes.'
      if (resposta.erro?.codigo === 'FRETE_INDISPONIVEL') cotacaoFrete.tentarNovamente()
      if (resposta.erro?.codigo?.startsWith('CUPOM_') || resposta.erro?.codigo === 'PROMOCAO_ENCERRADA') {
        if (resposta.erro.codigo.startsWith('CUPOM_')) { definirCupomAplicado(null); definirErroCupom(mensagem) }
        definirRodadaCupom((rodada) => rodada + 1)
      }
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
    await abrirPagamento({ destino: destino.href, slugs: slugsDoGrupo })
  }

  async function abrirPagamento(pendente: PagamentoPendente) {
    if (salvando) return
    definirSalvando(true)
    const restamOutrosAtelies = grupos.length > 1
    const limpeza = await abrirPagamentoAposLimpeza(() => removerConfirmado(pendente.slugs), pendente.destino, (url) => {
      concluirCheckoutPendente()
      definirConcluido(true)
      avisar.sucesso('Pedido registrado', restamOutrosAtelies
        ? 'Abrindo o checkout de teste do Mercado Pago. As peças dos outros ateliês continuam na sacola.'
        : 'Abrindo o checkout de teste do Mercado Pago.')
      window.location.assign(url)
    })
    definirSalvando(false)
    if (!limpeza.ok) {
      definirPagamentoPendente(pendente)
      definirErroConfirmacao(`Pedido registrado, mas as peças pagas ainda não saíram da sacola. ${limpeza.mensagem ?? 'Tente novamente.'}`)
      return
    }
    definirPagamentoPendente(null)
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
          {grupos.length > 1 && (
            <section className="cartao abaixo-5">
              <h2 className="secao-titulo" id="titulo-atelie-checkout">Qual ateliê finalizar agora</h2>
              <p className="campo-ajuda abaixo-3">
                Cada ateliê é pago separadamente. As peças dos outros ateliês continuam na sacola para o próximo pagamento.
              </p>
              <div className="opcoes" role="radiogroup" aria-labelledby="titulo-atelie-checkout">
                {grupos.map((opcao) => {
                  const pecas = opcao.entradas.reduce((soma, { item }) => soma + item.quantidade, 0)
                  return (
                    <label className="opcao opcao-topo" key={opcao.artesao}>
                      <input type="radio" name="atelie" checked={grupo?.artesao === opcao.artesao}
                        disabled={salvando || Boolean(pagamentoPendente)} onChange={() => escolherAtelie(opcao.artesao)} />
                      <span className="encolhivel">
                        <span style={{ fontWeight: 600 }}>{opcao.nome}</span>
                        <span className="campo-ajuda"> · {pecas} {pecas === 1 ? 'peça' : 'peças'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}
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
            <Campo rotulo={enderecoEscolhido === OUTRO_ENDERECO ? 'Rua e bairro' : 'Endereço'} erro={erros['endereco']} id="endereco">
              <input id="endereco" name="endereco" maxLength={LIMITE_ENDERECO} value={entrega.endereco} onChange={(e) => atualizarEntrega('endereco', e.target.value)} />
            </Campo>
            {enderecoEscolhido === OUTRO_ENDERECO && (
              <div className="grade-dois">
                <Campo rotulo="Número" erro={erros['numero-checkout']} id="numero-checkout">
                  <input id="numero-checkout" maxLength={LIMITE_NUMERO} placeholder="240 ou S/N" value={numeroEntrega}
                    onChange={(e) => { definirNumeroEntrega(e.target.value); definirErros((atuais) => { const resto = { ...atuais }; delete resto['numero-checkout']; return resto }) }} />
                </Campo>
                <Campo rotulo="Complemento (opcional)" erro={erros['complemento-checkout']} id="complemento-checkout">
                  <input id="complemento-checkout" maxLength={LIMITE_COMPLEMENTO} placeholder="Apto 302" value={complementoEntrega}
                    onChange={(e) => definirComplementoEntrega(e.target.value)} />
                </Campo>
              </div>
            )}
            <div className="grade-dois">
              <Campo rotulo="Cidade" erro={erros['cidade']} id="cidade">
                <input id="cidade" name="cidade" maxLength={LIMITE_CIDADE} value={entrega.cidade} onChange={(e) => atualizarEntrega('cidade', e.target.value)} />
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
                      {entregaCombinada(opcao) ? <IconeCasa /> : <IconeCaminhao />}
                      {opcao.nome}
                    </span>
                    <span className="campo-ajuda">
                      {opcao.prazo} · {valorDoFreteEmTexto(opcao.valor)}
                    </span>
                    {opcao.detalhe && <span className="campo-ajuda opcao-frete-detalhe">{opcao.detalhe}</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="cartao coluna-compra">
          <h2 className="secao-titulo">Seu pedido</h2>
          {grupos.length > 1 && grupo && <p className="campo-ajuda abaixo-3">Peças de {grupo.nome}</p>}

          {indisponiveis.length > 0 && (
            <div className="aviso abaixo-4" role="status">
              <p>Estas peças não estão disponíveis no catálogo:</p>
              <ul>{indisponiveis.map((item) => <li key={item.slug}>{item.slug.replace(/-/g, ' ')} · Quantidade: {item.quantidade}</li>)}</ul>
              <Link href="/cart" className="botao-texto">Rever sacola e remover peças indisponíveis</Link>
            </div>
          )}

          {doGrupo.map(({ peca, item }) => {
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
                  {(peca.desconto ?? 0) > 0 && !cotacao.valido && <span className="preco-riscado">{emReais(peca.preco * item.quantidade)}</span>}
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

          <div className="cupom-checkout acima-3">
            <Campo rotulo="Cupom de desconto" erro={erroCupom ?? undefined} id="cupom-checkout">
              <input id="cupom-checkout" value={codigoCupom} maxLength={40} autoComplete="off" spellCheck={false}
                readOnly={Boolean(cupomAplicado)} placeholder="Ex.: BALAIO10"
                onChange={(evento) => { definirCodigoCupom(evento.target.value.toUpperCase()); definirErroCupom(null) }}
                onKeyDown={(evento) => { if (evento.key === 'Enter') { evento.preventDefault(); void aplicarCupom() } }} />
            </Campo>
            {cupomAplicado ? (
              <button type="button" className="botao botao-fantasma" onClick={removerCupom} disabled={salvando}>Remover</button>
            ) : (
              <button type="button" className="botao botao-secundario" onClick={() => void aplicarCupom()}
                disabled={aplicandoCupom || salvando || !codigoCupom.trim()}>
                {aplicandoCupom ? 'Validando…' : 'Aplicar'}
              </button>
            )}
          </div>
          {previa && (
            <p className="cupom-aplicado" role="status">
              <IconeOferta tamanho={16} />
              <span>
                {previa.automatico ? 'Promoção aplicada automaticamente: ' : `Cupom ${previa.codigo} aplicado: `}
                {previa.descricao}. O desconto é por conta do Balaio.
              </span>
            </p>
          )}

          <p className="resumo acima-3">
            <span>Subtotal</span>
            <strong>{emReais(cotacao.valido ? subtotal : subtotalCheio)}</strong>
          </p>
          {economia > 0 && (
            <p className="resumo resumo-desconto">
              <span>Desconto do artesão</span>
              <strong>{emReais(economia)}</strong>
            </p>
          )}
          {totais.descontoProdutos > 0 && (
            <p className="resumo resumo-desconto">
              <span>Desconto do cupom</span>
              <strong>− {emReais(totais.descontoProdutos)}</strong>
            </p>
          )}
          <p className="resumo">
            <span>Frete</span>
            <strong>
              {!frete ? 'A cotar' : totais.descontoFrete > 0 ? (
                <>
                  <span className="preco-riscado">{emReais(frete.valor)}</span>{' '}
                  {totais.freteCobrado === 0 ? 'Grátis' : emReais(totais.freteCobrado)}
                </>
              ) : valorDoFreteEmTexto(frete.valor)}
            </strong>
          </p>
          {totais.descontoFrete > 0 && (
            <p className="resumo resumo-desconto">
              <span>Frete grátis do cupom</span>
              <strong>− {emReais(totais.descontoFrete)}</strong>
            </p>
          )}
          <p className="resumo resumo-total">
            <span>Total</span>
            <Preco valor={total} className="preco-destaque" />
          </p>

          {erroConfirmacao && (
            <p className="aviso acima-3" role="alert">{erroConfirmacao}</p>
          )}

          <div className="barra-fixa barra-fixa-total">
            <p className="barra-fixa-info">
              <span className="barra-fixa-rotulo">Total</span>
              <Preco valor={total} className="barra-fixa-valor" />
            </p>
            <button disabled={salvando || concluido || (!pagamentoPendente && (!frete || !cotacao.valido || !cotacao.dados?.podeProsseguir))} type="submit" className="botao botao-sucesso botao-largo">
              {salvando ? 'Aguarde…' : pagamentoPendente ? 'Tentar abrir pagamento' : 'Confirmar compra'} <span className="esconde-mobile">{emReais(total)}</span>
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
