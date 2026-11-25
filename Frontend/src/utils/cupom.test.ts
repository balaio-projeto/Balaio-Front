import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cupomParaFormulario, FORMULARIO_CUPOM_VAZIO, formularioParaCupom, normalizarCodigoCupom, totaisDoCheckout,
  usosDoCupom, validarCodigoCupom, valorDoCupom, type CupomAdmin, type PreviaCupom,
} from './cupom'
import { entregaCombinada, origemDaCotacao, valorDoFreteEmTexto } from './frete'

const previaPercentual: PreviaCupom = {
  codigo: 'BALAIO10', descricao: 'Dez por cento', tipo: 'percentual', automatico: false,
  subtotalProdutos: 120, descontoProdutos: 12, descontoFrete: 0, custeadoPor: 'plataforma',
}

test('código do cupom é normalizado e validado antes de ir ao servidor', () => {
  assert.equal(normalizarCodigoCupom('  natal10 '), 'NATAL10')
  assert.equal(validarCodigoCupom(' natal10 '), null)
  assert.match(validarCodigoCupom('') ?? '', /Digite/)
  assert.match(validarCodigoCupom('ÇÃO10') ?? '', /sem acento/)
})

test('totais do checkout descontam peças e frete sem passar do frete escolhido', () => {
  assert.deepEqual(totaisDoCheckout(120, 30, previaPercentual), { descontoProdutos: 12, descontoFrete: 0, freteCobrado: 30, total: 138 })
  const freteGratis = { ...previaPercentual, tipo: 'frete_gratis' as const, descontoProdutos: 0, descontoFrete: 45.9 }
  assert.deepEqual(totaisDoCheckout(80.1, 21.3, freteGratis), { descontoProdutos: 0, descontoFrete: 21.3, freteCobrado: 0, total: 80.1 })
  assert.deepEqual(totaisDoCheckout(80.1, 21.3, null), { descontoProdutos: 0, descontoFrete: 0, freteCobrado: 21.3, total: 101.4 })
})

test('formulário do admin vira o contrato do servidor com valores em reais', () => {
  const { dados, erros } = formularioParaCupom({
    ...FORMULARIO_CUPOM_VAZIO, codigo: ' natal ', descricao: 'Natal no Balaio', tipo: 'valor_fixo', valor: '1.250,50',
    pedidoMinimo: '80', limiteUsos: '100', limitePorComprador: '1',
  })
  assert.deepEqual(erros, {})
  assert.equal(dados?.codigo, 'NATAL')
  assert.equal(dados?.valor, 1250.5)
  assert.equal(dados?.pedidoMinimo, 80)
  assert.equal(dados?.limiteUsos, 100)
  assert.equal(dados?.descontoMaximo, null)

  const automatica = formularioParaCupom({ ...FORMULARIO_CUPOM_VAZIO, descricao: 'Frete grátis de dezembro', tipo: 'frete_gratis' })
  assert.equal(automatica.dados?.codigo, null)
  assert.equal(automatica.dados?.valor, null)
})

test('formulário do admin aponta cada campo inválido', () => {
  const { dados, erros } = formularioParaCupom({
    ...FORMULARIO_CUPOM_VAZIO, codigo: 'a b', descricao: 'x', tipo: 'percentual', valor: '120', descontoMaximo: '10,999',
    inicio: '2026-12-10T10:00', fim: '2026-12-01T10:00', limiteUsos: '0', limitePorComprador: '1,5',
  })
  assert.equal(dados, null)
  assert.deepEqual(Object.keys(erros).sort(),
    ['codigo', 'descontoMaximo', 'descricao', 'fim', 'limitePorComprador', 'limiteUsos', 'valor'])
})

test('lista do admin descreve valor, usos e reabre o cupom para edição', () => {
  const cupom: CupomAdmin = {
    id: '1', codigo: 'DEZ', automatico: false, descricao: 'Dez', tipo: 'percentual', valor: 12.5, descontoMaximo: 30,
    pedidoMinimo: 50, inicio: null, fim: '2026-12-31T23:59:00Z', limiteUsos: 100, limitePorComprador: 1, usos: 3,
    ativo: true, situacao: 'ativo', custeadoPor: 'plataforma', criadoEm: '', atualizadoEm: '',
  }
  assert.match(valorDoCupom(cupom), /^12,5% nas peças \(até R\$\s30,00\) · pedidos a partir de R\$\s50,00$/)
  assert.equal(usosDoCupom(cupom), '3 de 100 usos · até 1 por comprador')
  assert.equal(usosDoCupom({ usos: 1, limiteUsos: null, limitePorComprador: null }), '1 uso (sem limite)')
  const formulario = cupomParaFormulario(cupom)
  assert.equal(formulario.valor, '12,5')
  assert.equal(formulario.pedidoMinimo, '50')
  assert.equal(formularioParaCupom(formulario).dados?.fim, '2026-12-31T23:59:00.000Z')
})

test('opções locais aparecem como grátis e não mudam a origem da cotação', () => {
  const opcoes = [
    { id: 'me-1', nome: 'Correios PAC', prazo: '5 dias úteis', valor: 21.5, provedor: 'melhor_envio_sandbox' },
    { id: 'retirada-atelie', nome: 'Retirar no ateliê', prazo: 'Combinado', valor: 0, provedor: 'balaio_local', modalidade: 'retirada' as const },
  ]
  assert.equal(entregaCombinada(opcoes[1]), true)
  assert.equal(entregaCombinada(opcoes[0]), false)
  assert.equal(valorDoFreteEmTexto(0), 'Grátis')
  assert.match(origemDaCotacao([...opcoes].reverse()) ?? '', /Melhor Envio Sandbox/)
  assert.equal(origemDaCotacao([opcoes[1]]), null)
})
