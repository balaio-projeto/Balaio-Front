import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consultasDoEndereco, geocodificarEndereco } from './geocodificacao'

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

test('tenta do endereço completo até a cidade e ignora S/N', () => {
  const completas = consultasDoEndereco({ rua: 'Rua da Aurora', numero: '240', bairro: 'Boa Vista', cidade: 'Recife' })
  assert.deepEqual(completas.map((c) => c.precisao), ['endereco', 'rua', 'rua', 'cidade'])
  assert.equal(completas[0].parametros.street, '240 Rua da Aurora')
  const semNumero = consultasDoEndereco({ rua: 'Sítio Lagoa', numero: 's/n', cidade: 'Tracunhaém' })
  assert.deepEqual(semNumero.map((c) => c.precisao), ['rua', 'cidade'])
})

test('usa o primeiro resultado em Pernambuco e informa a precisão', async () => {
  const chamadas: string[] = []
  const buscar = (async (url: string) => {
    chamadas.push(url)
    return chamadas.length === 1 ? respostaJson([]) : respostaJson([{ lat: '-8.0587', lon: '-34.8812' }])
  }) as unknown as typeof fetch
  const resultado = await geocodificarEndereco({ rua: 'Rua da Aurora', numero: '240', cidade: 'Recife' }, { buscar })
  assert.deepEqual(resultado, { situacao: 'encontrado', ponto: { lat: -8.0587, lng: -34.8812 }, precisao: 'rua' })
  assert.match(chamadas[0], /street=240\+Rua\+da\+Aurora/)
})

test('descarta pontos fora de Pernambuco e diferencia erro de não encontrado', async () => {
  const foraDoEstado = (async () => respostaJson([{ lat: '-23.55', lon: '-46.63' }])) as unknown as typeof fetch
  assert.deepEqual(await geocodificarEndereco({ rua: 'Rua A', cidade: 'Recife' }, { buscar: foraDoEstado }), { situacao: 'nao-encontrado' })
  const fora = (async () => { throw new Error('rede') }) as unknown as typeof fetch
  assert.deepEqual(await geocodificarEndereco({ rua: 'Rua A', cidade: 'Recife' }, { buscar: fora }), { situacao: 'erro' })
})
