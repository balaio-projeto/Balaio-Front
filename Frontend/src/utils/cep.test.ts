import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validarCEP } from './validacao'
import {
  cepCompleto, comporBairro, consultarViaCep, entregaDoEnderecoSalvo, entregaPeloCep, formatarCep,
  mapearViaCep, mensagemDaBuscaCep, normalizarCep, separarBairro,
} from './cep'

const RESPOSTA_RECIFE = {
  cep: '50050-000', logradouro: 'Rua da Aurora', complemento: 'até 600 - lado par', bairro: 'Boa Vista',
  localidade: 'Recife', uf: 'PE', ibge: '2611606', ddd: '81',
}

test('normaliza e formata o CEP enquanto o comprador digita', () => {
  assert.equal(normalizarCep(' 50.050-000 '), '50050000')
  assert.equal(normalizarCep('500500001234'), '50050000')
  assert.equal(formatarCep('5005'), '5005')
  assert.equal(formatarCep('50050'), '50050')
  assert.equal(formatarCep('500500'), '50050-0')
  assert.equal(formatarCep('50050000'), '50050-000')
  assert.equal(formatarCep('abc'), '')
})

test('só considera completo o CEP com 8 dígitos e não nulo', () => {
  assert.equal(cepCompleto('50050-000'), '50050000')
  assert.equal(cepCompleto('50050000'), '50050000')
  assert.equal(cepCompleto('5005-000'), null)
  assert.equal(cepCompleto('00000-000'), null)
  assert.equal(cepCompleto(''), null)
})

test('mapeia a resposta da ViaCEP para rua, bairro, cidade e UF', () => {
  assert.deepEqual(mapearViaCep(RESPOSTA_RECIFE), { cep: '50050-000', rua: 'Rua da Aurora', bairro: 'Boa Vista', cidade: 'Recife', uf: 'PE' })
  assert.deepEqual(mapearViaCep({ cep: '56800000', logradouro: '', bairro: '', localidade: 'Afogados da Ingazeira', uf: 'pe' }),
    { cep: '56800-000', rua: '', bairro: '', cidade: 'Afogados da Ingazeira', uf: 'PE' })
})

test('resposta de CEP inexistente ou malformada não vira endereço', () => {
  assert.equal(mapearViaCep({ erro: true }), null)
  assert.equal(mapearViaCep({ erro: 'true' }), null)
  assert.equal(mapearViaCep({ ...RESPOSTA_RECIFE, uf: 'XX' }), null)
  assert.equal(mapearViaCep({ ...RESPOSTA_RECIFE, localidade: '' }), null)
  assert.equal(mapearViaCep([RESPOSTA_RECIFE]), null)
  assert.equal(mapearViaCep(null), null)
})

test('compõe e separa o bairro no formato aceito pelo profile-service', () => {
  assert.equal(comporBairro({ bairro: 'Boa Vista', cidade: 'Recife', uf: 'pe' }), 'Boa Vista, Recife, PE')
  assert.equal(comporBairro({ bairro: '', cidade: 'Olinda', uf: 'PE' }), 'Olinda, PE')
  assert.deepEqual(separarBairro('Boa Vista, Recife, PE'), { bairro: 'Boa Vista', cidade: 'Recife', uf: 'PE' })
  assert.deepEqual(separarBairro('Olinda, pe'), { bairro: '', cidade: 'Olinda', uf: 'PE' })
  assert.deepEqual(separarBairro('Centro'), { bairro: 'Centro', cidade: '', uf: '' })
})

test('converte endereço salvo e resultado da ViaCEP para os campos do checkout', () => {
  assert.deepEqual(entregaDoEnderecoSalvo({ rua: 'Rua da Aurora, 240', bairro: 'Boa Vista, Recife, PE', cep: '50050-000' }),
    { cep: '50050-000', endereco: 'Rua da Aurora, 240, Boa Vista', cidade: 'Recife', estado: 'PE' })
  const atual = { cep: '', endereco: 'Sítio Lagoa, s/n', cidade: '', estado: '' }
  assert.deepEqual(entregaPeloCep(atual, { cep: '56800-000', rua: '', bairro: '', cidade: 'Afogados da Ingazeira', uf: 'PE' }),
    { cep: '56800-000', endereco: 'Sítio Lagoa, s/n', cidade: 'Afogados da Ingazeira', estado: 'PE' })
  assert.deepEqual(entregaPeloCep(atual, { cep: '50050-000', rua: 'Rua da Aurora', bairro: 'Boa Vista', cidade: 'Recife', uf: 'PE' }),
    { cep: '50050-000', endereco: 'Rua da Aurora, Boa Vista', cidade: 'Recife', estado: 'PE' })
})

test('consulta a ViaCEP pelo navegador e distingue encontrado, inexistente e falha', async () => {
  const chamadas: string[] = []
  const responder = (status: number, corpo: unknown): typeof fetch => async (url) => {
    chamadas.push(String(url))
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  }
  assert.deepEqual(await consultarViaCep('50050-000', { buscar: responder(200, RESPOSTA_RECIFE) }),
    { situacao: 'encontrado', endereco: { cep: '50050-000', rua: 'Rua da Aurora', bairro: 'Boa Vista', cidade: 'Recife', uf: 'PE' } })
  assert.equal(chamadas.at(-1), 'https://viacep.com.br/ws/50050000/json/')
  assert.deepEqual(await consultarViaCep('99999-999', { buscar: responder(200, { erro: 'true' }) }), { situacao: 'inexistente' })
  assert.deepEqual(await consultarViaCep('99999-999', { buscar: responder(400, {}) }), { situacao: 'inexistente' })
  assert.deepEqual(await consultarViaCep('50050-000', { buscar: responder(503, {}) }), { situacao: 'erro' })
  assert.deepEqual(await consultarViaCep('50050-000', { buscar: async () => { throw new TypeError('offline') } }), { situacao: 'erro' })
  const antes = chamadas.length
  assert.deepEqual(await consultarViaCep('5005', { buscar: responder(200, RESPOSTA_RECIFE) }), { situacao: 'invalido' })
  assert.equal(chamadas.length, antes)
})

test('cada estado da busca tem mensagem visível, exceto o ocioso', () => {
  assert.equal(mensagemDaBuscaCep('ocioso'), null)
  for (const situacao of ['carregando', 'encontrado', 'inexistente', 'erro'] as const) {
    assert.ok(mensagemDaBuscaCep(situacao))
  }
  assert.match(mensagemDaBuscaCep('inexistente')!, /manualmente/)
})

test('validarCEP segue o commerce e recusa CEP com todos os dígitos iguais', () => {
  assert.equal(validarCEP('50050-000'), null)
  assert.equal(validarCEP(' 50050000 '), null)
  assert.notEqual(validarCEP('00000-000'), null)
  assert.notEqual(validarCEP('11111111'), null)
  assert.notEqual(validarCEP('99999-999'), null)
  assert.notEqual(validarCEP('5005-0000'), null)
  assert.notEqual(validarCEP('50050.000'), null)
})
