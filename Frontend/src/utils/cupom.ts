import { emReais } from './formato'
import { numeroDoPreco } from './validacao'

export type TipoCupom = 'percentual' | 'valor_fixo' | 'frete_gratis'
export type SituacaoCupom = 'ativo' | 'agendado' | 'expirado' | 'esgotado' | 'inativo'

export type PreviaCupom = {
  codigo: string | null
  descricao: string
  tipo: TipoCupom
  automatico: boolean
  subtotalProdutos: number
  descontoProdutos: number
  descontoFrete: number
  custeadoPor: string
}

export type CupomAdmin = {
  id: string
  codigo: string | null
  automatico: boolean
  descricao: string
  tipo: TipoCupom
  valor: number
  descontoMaximo: number | null
  pedidoMinimo: number
  inicio: string | null
  fim: string | null
  limiteUsos: number | null
  limitePorComprador: number | null
  usos: number
  ativo: boolean
  situacao: SituacaoCupom
  custeadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export type DadosCupom = {
  codigo: string | null
  descricao: string
  tipo: TipoCupom
  valor: number | null
  descontoMaximo: number | null
  pedidoMinimo: number
  inicio: string | null
  fim: string | null
  limiteUsos: number | null
  limitePorComprador: number | null
  ativo: boolean
}

export type FormularioCupom = {
  codigo: string
  descricao: string
  tipo: TipoCupom
  valor: string
  descontoMaximo: string
  pedidoMinimo: string
  inicio: string
  fim: string
  limiteUsos: string
  limitePorComprador: string
  ativo: boolean
}

export const FORMULARIO_CUPOM_VAZIO: FormularioCupom = {
  codigo: '', descricao: '', tipo: 'percentual', valor: '', descontoMaximo: '', pedidoMinimo: '',
  inicio: '', fim: '', limiteUsos: '', limitePorComprador: '', ativo: true,
}

export const ROTULO_TIPO_CUPOM: Record<TipoCupom, string> = {
  percentual: 'Porcentagem nas peças',
  valor_fixo: 'Valor fixo nas peças',
  frete_gratis: 'Frete grátis',
}

export const ROTULO_SITUACAO_CUPOM: Record<SituacaoCupom, string> = {
  ativo: 'Ativo',
  agendado: 'Agendado',
  expirado: 'Expirado',
  esgotado: 'Esgotado',
  inativo: 'Desativado',
}

const FORMATO_CODIGO = /^[A-Z0-9][A-Z0-9_-]{2,39}$/
const TEXTO_PERCENTUAL = /^\d{1,3}([.,]\d{1,2})?$/
const INTEIRO_POSITIVO = /^\d{1,7}$/

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

export function normalizarCodigoCupom(valor: string): string {
  return valor.trim().toUpperCase()
}

export function validarCodigoCupom(valor: string): string | null {
  const codigo = normalizarCodigoCupom(valor)
  if (!codigo) return 'Digite o código do cupom'
  if (!FORMATO_CODIGO.test(codigo)) return 'Use de 3 a 40 letras sem acento, números, hífen ou sublinhado'
  return null
}

export function totaisDoCheckout(subtotal: number, frete: number, previa: PreviaCupom | null) {
  const descontoFrete = previa ? centavos(Math.min(previa.descontoFrete, frete)) : 0
  const descontoProdutos = previa ? centavos(Math.min(previa.descontoProdutos, subtotal)) : 0
  return {
    descontoProdutos,
    descontoFrete,
    freteCobrado: centavos(frete - descontoFrete),
    total: centavos(subtotal + frete - descontoProdutos - descontoFrete),
  }
}

export function resumoDaPrevia(previa: PreviaCupom): string {
  if (previa.tipo === 'frete_gratis') return previa.descontoFrete > 0 ? 'Frete grátis aplicado' : 'Frete grátis na entrega escolhida'
  return `${emReais(previa.descontoProdutos)} de desconto nas peças`
}

export function valorDoCupom(cupom: Pick<CupomAdmin, 'tipo' | 'valor' | 'descontoMaximo' | 'pedidoMinimo'>): string {
  const teto = cupom.descontoMaximo ? ` (até ${emReais(cupom.descontoMaximo)})` : ''
  const minimo = cupom.pedidoMinimo > 0 ? ` · pedidos a partir de ${emReais(cupom.pedidoMinimo)}` : ''
  if (cupom.tipo === 'percentual') return `${String(cupom.valor).replace('.', ',')}% nas peças${teto}${minimo}`
  if (cupom.tipo === 'valor_fixo') return `${emReais(cupom.valor)} nas peças${minimo}`
  return `Frete grátis${teto}${minimo}`
}

export function usosDoCupom(cupom: Pick<CupomAdmin, 'usos' | 'limiteUsos' | 'limitePorComprador'>): string {
  const total = cupom.limiteUsos ? `${cupom.usos} de ${cupom.limiteUsos} usos` : `${cupom.usos} ${cupom.usos === 1 ? 'uso' : 'usos'} (sem limite)`
  const porPessoa = cupom.limitePorComprador
    ? ` · até ${cupom.limitePorComprador} por comprador`
    : ''
  return total + porPessoa
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function validadeDoCupom(cupom: Pick<CupomAdmin, 'inicio' | 'fim'>): string {
  if (cupom.inicio && cupom.fim) return `De ${dataCurta(cupom.inicio)} até ${dataCurta(cupom.fim)}`
  if (cupom.inicio) return `A partir de ${dataCurta(cupom.inicio)}`
  if (cupom.fim) return `Até ${dataCurta(cupom.fim)}`
  return 'Sem prazo definido'
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0')
}

export function isoParaDataHoraLocal(iso: string | null): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
    + `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

export function dataHoraLocalParaIso(valor: string): string | null {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function numeroEmTexto(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',')
}

export function cupomParaFormulario(cupom: CupomAdmin): FormularioCupom {
  return {
    codigo: cupom.codigo ?? '',
    descricao: cupom.descricao,
    tipo: cupom.tipo,
    valor: cupom.tipo === 'frete_gratis' ? '' : numeroEmTexto(cupom.valor),
    descontoMaximo: numeroEmTexto(cupom.descontoMaximo),
    pedidoMinimo: cupom.pedidoMinimo > 0 ? numeroEmTexto(cupom.pedidoMinimo) : '',
    inicio: isoParaDataHoraLocal(cupom.inicio),
    fim: isoParaDataHoraLocal(cupom.fim),
    limiteUsos: cupom.limiteUsos === null ? '' : String(cupom.limiteUsos),
    limitePorComprador: cupom.limitePorComprador === null ? '' : String(cupom.limitePorComprador),
    ativo: cupom.ativo,
  }
}

function dinheiroOpcional(texto: string, erros: Record<string, string>, campo: string, mensagem: string): number | null {
  if (!texto.trim()) return null
  const numero = numeroDoPreco(texto)
  const foraDeCentavos = Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-6
  if (Number.isNaN(numero) || numero <= 0 || foraDeCentavos || /[^\d.,\sR$]/.test(texto)) {
    erros[campo] = mensagem
    return null
  }
  return numero
}

function inteiroOpcional(texto: string, erros: Record<string, string>, campo: string, mensagem: string): number | null {
  if (!texto.trim()) return null
  if (!INTEIRO_POSITIVO.test(texto.trim()) || Number(texto) < 1) {
    erros[campo] = mensagem
    return null
  }
  return Number(texto)
}

export function formularioParaCupom(formulario: FormularioCupom): { dados: DadosCupom | null; erros: Record<string, string> } {
  const erros: Record<string, string> = {}
  const codigo = normalizarCodigoCupom(formulario.codigo)
  if (codigo && !FORMATO_CODIGO.test(codigo)) erros.codigo = 'Use de 3 a 40 letras sem acento, números, hífen ou sublinhado'
  const descricao = formulario.descricao.trim()
  if (descricao.length < 3 || descricao.length > 200) erros.descricao = 'Descreva o desconto em 3 a 200 caracteres'

  let valor: number | null = null
  if (formulario.tipo === 'percentual') {
    const texto = formulario.valor.trim()
    const numero = Number(texto.replace(',', '.'))
    if (!TEXTO_PERCENTUAL.test(texto) || numero <= 0 || numero > 100) erros.valor = 'Informe uma porcentagem maior que 0 e até 100'
    else valor = numero
  } else if (formulario.tipo === 'valor_fixo') {
    valor = dinheiroOpcional(formulario.valor, erros, 'valor', 'Informe um valor em reais, como 20,00')
    if (valor === null && !erros.valor) erros.valor = 'Informe um valor em reais, como 20,00'
  }

  const descontoMaximo = dinheiroOpcional(formulario.descontoMaximo, erros, 'descontoMaximo', 'Informe um teto em reais ou deixe em branco')
  const pedidoMinimo = dinheiroOpcional(formulario.pedidoMinimo, erros, 'pedidoMinimo', 'Informe um valor em reais ou deixe em branco') ?? 0
  const inicio = dataHoraLocalParaIso(formulario.inicio)
  const fim = dataHoraLocalParaIso(formulario.fim)
  if (inicio && fim && new Date(fim) <= new Date(inicio)) erros.fim = 'O fim precisa ser depois do início'
  const limiteUsos = inteiroOpcional(formulario.limiteUsos, erros, 'limiteUsos', 'Informe um número inteiro ou deixe em branco')
  const limitePorComprador = inteiroOpcional(formulario.limitePorComprador, erros, 'limitePorComprador',
    'Informe um número inteiro ou deixe em branco')

  if (Object.keys(erros).length > 0) return { dados: null, erros }
  return {
    dados: {
      codigo: codigo || null, descricao, tipo: formulario.tipo, valor, descontoMaximo, pedidoMinimo, inicio, fim,
      limiteUsos, limitePorComprador, ativo: formulario.ativo,
    },
    erros,
  }
}
