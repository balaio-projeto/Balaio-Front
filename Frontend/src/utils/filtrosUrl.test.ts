import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  filtrosAtivos,
  hrefSem,
  lerFiltros,
  lerPreco,
  hrefListagem,
  parametrosPreservadosNaFaixaDePreco,
  referenciasDeReserva,
  referenciasParaFiltros,
} from './filtrosUrl'

const REFERENCIAS_DA_API = {
  tecnicas: ['Cerâmica & Barro', 'Cestaria'],
  territorios: ['Sertão do Pajeú'],
  categorias: ['Casa & Mesa'],
  tipos: ['Cestos'],
  etiquetas: ['cestaria'],
}

test('usa as referências do catálogo quando a API responde', () => {
  const referencias = referenciasParaFiltros({ dados: REFERENCIAS_DA_API, erro: null })
  assert.deepEqual(referencias.tecnicas, ['Cerâmica & Barro', 'Cestaria'])
  assert.deepEqual(referencias.tipos, ['Cestos'])
  const filtros = lerFiltros({ tecnica: 'Cestaria', tipo: 'Cestos', territorio: 'Mata Norte' }, referencias)
  assert.equal(filtros.tecnica, 'Cestaria')
  assert.equal(filtros.tipo, 'Cestos')
  assert.equal(filtros.territorio, undefined)
})

test('recai nas referências locais quando a API falha ou responde fora do contrato', () => {
  const falhas = [
    { dados: null, erro: { codigo: 'ERRO_REDE', mensagem: 'Sem rede.' } },
    { dados: { ...REFERENCIAS_DA_API, tipos: 'Cestos' }, erro: null },
    { dados: { tecnicas: [1, 2], territorios: [], categorias: [], tipos: [] }, erro: null },
    null,
  ]
  for (const resposta of falhas) assert.equal(referenciasParaFiltros(resposta), referenciasDeReserva)
  assert.equal(lerFiltros({ tecnica: 'Xilogravura' }).tecnica, 'Xilogravura')
})

test('lista vazia vinda da API é respeitada sem inventar opções', () => {
  const referencias = referenciasParaFiltros({ dados: { tecnicas: [], territorios: [], categorias: [], tipos: [] }, erro: null })
  assert.deepEqual(referencias.tecnicas, [])
  assert.equal(lerFiltros({ tecnica: 'Xilogravura' }, referencias).tecnica, undefined)
})

test('lê a faixa de preço da URL aceitando apenas valores válidos', () => {
  assert.equal(lerPreco('49.90'), 49.9)
  assert.equal(lerPreco('120,5'), 120.5)
  for (const invalido of ['', '0', '-10', 'abc', '1e3', '10.999', '2000000', undefined]) {
    assert.equal(lerPreco(invalido), undefined, String(invalido))
  }
  const filtros = lerFiltros({ precoMin: '50', precoMax: '200' })
  assert.equal(filtros.precoMin, 50)
  assert.equal(filtros.precoMax, 200)
  const invertidos = lerFiltros({ precoMin: '300', precoMax: '100' })
  assert.equal(invertidos.precoMin, 100)
  assert.equal(invertidos.precoMax, 300)
})

test('faixa de preço sobrevive na URL compartilhada e sai junto ao remover o chip', () => {
  const filtros = lerFiltros({ q: 'jarra', tecnica: 'Cerâmica & Barro', precoMin: '50', precoMax: '200', pagina: '3' })
  const href = hrefListagem(filtros)
  assert.match(href, /precoMin=50/)
  assert.match(href, /precoMax=200/)
  assert.match(href, /pagina=3/)
  const recarregado = lerFiltros(Object.fromEntries(new URLSearchParams(href.split('?')[1])))
  assert.deepEqual(recarregado, filtros)
  const chip = filtrosAtivos(filtros).find((filtro) => filtro.chave === 'preco')
  assert.ok(chip)
  assert.match(chip.valor, /50,00 a .*200,00/)
  const semFaixa = hrefSem(filtros, 'preco')
  assert.doesNotMatch(semFaixa, /preco(Min|Max)/)
  assert.match(semFaixa, /tecnica=/)
  assert.doesNotMatch(semFaixa, /pagina=/)
})

test('formulário de faixa preserva os demais filtros e reinicia a paginação', () => {
  const filtros = lerFiltros({ q: 'jarra', desconto: 'true', ordenar: 'preco-asc', precoMin: '10', pagina: '2' })
  assert.deepEqual(parametrosPreservadosNaFaixaDePreco(filtros), [
    ['q', 'jarra'],
    ['desconto', 'true'],
    ['ordenar', 'preco-asc'],
  ])
  assert.equal(filtrosAtivos(lerFiltros({ precoMax: '80' })).find((filtro) => filtro.chave === 'preco')?.valor.startsWith('Até'), true)
})
