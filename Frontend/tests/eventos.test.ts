import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer, type IncomingMessage } from 'node:http'
import {
  criarEvento, decidirEvento, ehEstadoModeracaoEvento, filtrosDeProximidade, listarEventos, listarEventosEmModeracao,
  obterEventoEmModeracao, type SubmissaoEvento,
} from '../src/services/api/eventos.servico'
import { encaminharApi } from '../src/services/api/proxy'
import { errosDeCampoDaSubmissao, mensagemErroSubmissao, MENSAGEM_EVENTO_REPETIDO } from '../src/components/eventos/mensagensSubmissao'
import { coordenadasValidas, pontoDeConsulta } from '../src/utils/eventos'
import { resumoDaFilaDeEventos } from '../src/components/admin/resumoFilaEventos'

const chamadas: { url: string; method: string; headers: IncomingMessage['headers']; body: unknown }[] = []
let resposta: { status: number; corpo: unknown } = { status: 200, corpo: { dados: [], erro: null } }
const servidor = createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  chamadas.push({ url: req.url!, method: req.method!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined })
  res.writeHead(resposta.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(resposta.corpo))
})

before(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/api/v1`
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})
after(async () => { await new Promise<void>((resolve) => servidor.close(() => resolve())) })
beforeEach(() => {
  chamadas.length = 0
  resposta = { status: 200, corpo: { dados: [], erro: null } }
})

const submissao: SubmissaoEvento = {
  slug: 'feira-teste', nome: 'Feira Teste', tipo: 'feira', organizador: 'Associação', descricao: 'Descrição',
  periodo: '12 de setembro', horario: '', entrada: 'Gratuita', cidade: 'Recife', local: 'Pátio', endereco: 'Recife, Pernambuco',
  lat: -8, lng: -35, artesaos: [], coletivos: [],
}

test('coordenadas finitas e dentro do intervalo são aceitas; o resto cai no ponto padrão', () => {
  assert.equal(coordenadasValidas({ lat: -8.06, lng: -34.87 }), true)
  assert.equal(coordenadasValidas({ lat: 91, lng: 0 }), false)
  assert.equal(coordenadasValidas({ lat: 0, lng: -181 }), false)
  assert.equal(coordenadasValidas({ lat: Number.NaN, lng: 0 }), false)
  assert.equal(coordenadasValidas({ lat: Number.POSITIVE_INFINITY, lng: 0 }), false)
  assert.equal(coordenadasValidas(null), false)
  const recife = { lat: -8.0631, lng: -34.8711 }
  assert.deepEqual(pontoDeConsulta({ lat: Number.NaN, lng: 1 }, recife), recife)
  assert.deepEqual(pontoDeConsulta({ lat: -8.28, lng: -35.97 }, recife), { lat: -8.28, lng: -35.97 })
})

test('agenda envia lat e lng válidos ao backend e omite coordenadas inválidas', async () => {
  await listarEventos({ lat: -8.2829, lng: -35.9722 })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/eventos?lat=-8.2829&lng=-35.9722')
  await listarEventos({ lat: 120, lng: -35 })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/eventos')
  await listarEventos({ lat: -8 })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/eventos')
  assert.deepEqual(filtrosDeProximidade({ lat: Number.NaN, lng: -35 }), {})
})

test('submissão aceita a resposta 201 pendente do events-service', async () => {
  resposta = { status: 201, corpo: { dados: { slug: 'feira-teste', status: 'PENDENTE' }, erro: null } }
  const resultado = await criarEvento(submissao)
  assert.deepEqual(resultado.dados, { slug: 'feira-teste', status: 'PENDENTE' })
})

test('400 do servidor vira erro por campo do formulário', async () => {
  resposta = {
    status: 400,
    corpo: { dados: null, erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: "Campo 'nome': Dê um nome ao evento.",
      campos: { nome: 'Dê um nome ao evento.', lat: 'Marque um ponto válido no mapa.', 'artesaos[0]': 'Participante inválido.', slug: 'x' } } },
  }
  const resultado = await criarEvento(submissao)
  assert.equal(resultado.erro?.status, 400)
  assert.deepEqual(errosDeCampoDaSubmissao(resultado.erro), {
    nome: 'Dê um nome ao evento.',
    mapa: 'Marque um ponto válido no mapa.',
    participantes: 'Participante inválido.',
  })
  assert.match(mensagemErroSubmissao('REQUISICAO_INVALIDA').titulo, /Confira/)
})

test('409 de evento existente aponta para o nome', async () => {
  resposta = { status: 409, corpo: { dados: null, erro: { codigo: 'EVENTO_JA_EXISTENTE', mensagem: 'Já existe um evento com esse slug.' } } }
  const resultado = await criarEvento(submissao)
  assert.equal(resultado.erro?.status, 409)
  assert.deepEqual(errosDeCampoDaSubmissao(resultado.erro), { nome: MENSAGEM_EVENTO_REPETIDO })
  assert.equal(mensagemErroSubmissao('EVENTO_JA_EXISTENTE').titulo, 'Evento já cadastrado')
  assert.deepEqual(errosDeCampoDaSubmissao(null), {})
})

test('fila administrativa consulta pendentes por padrão com a sessão do servidor', async () => {
  await listarEventosEmModeracao('sessao-admin')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/eventos?estado=PENDENTE')
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer sessao-admin')
  await listarEventosEmModeracao('sessao-admin', 'REJEITADO')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/eventos?estado=REJEITADO')
  await obterEventoEmModeracao('feira de barro', 'sessao-admin')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/eventos/feira%20de%20barro')
  assert.equal(ehEstadoModeracaoEvento('APROVADO'), true)
  assert.equal(ehEstadoModeracaoEvento('PUBLICADO'), false)
})

test('aprovar envia só a decisão e rejeitar envia o motivo sem espaços nas pontas', async () => {
  resposta = { status: 200, corpo: { dados: { status: 'APROVADO' }, erro: null } }
  await decidirEvento('feira-teste', 'aprovar', 'ignorado')
  assert.equal(chamadas.at(-1)?.method, 'POST')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/eventos/feira-teste/decisao')
  assert.deepEqual(chamadas.at(-1)?.body, { decisao: 'aprovar' })
  await decidirEvento('feira-teste', 'rejeitar', '  Sem data confirmada  ')
  assert.deepEqual(chamadas.at(-1)?.body, { decisao: 'rejeitar', motivo: 'Sem data confirmada' })
})

test('conflito de decisão e erro de motivo são preservados para a tela', async () => {
  resposta = { status: 409, corpo: { dados: null, erro: { codigo: 'EVENTO_JA_DECIDIDO', mensagem: 'Este evento já recebeu outra decisão.' } } }
  const conflito = await decidirEvento('feira-teste', 'aprovar')
  assert.equal(conflito.erro?.codigo, 'EVENTO_JA_DECIDIDO')
  resposta = { status: 400, corpo: { dados: null, erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: 'x', campos: { motivo: 'Explique o motivo.' } } } }
  const semMotivo = await decidirEvento('feira-teste', 'rejeitar', ' ')
  assert.equal(semMotivo.erro?.campos?.motivo, 'Explique o motivo.')
  resposta = { status: 403, corpo: { dados: null, erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Operação não permitida.' } } }
  const negado = await listarEventosEmModeracao('sessao-comprador')
  assert.equal(negado.erro?.status, 403)
  assert.equal(negado.dados, null)
})

test('proxy encaminha a decisão com o cookie HttpOnly como Bearer', async () => {
  resposta = { status: 200, corpo: { dados: { status: 'APROVADO' }, erro: null } }
  const saida = await encaminharApi(new Request('http://localhost:4321/api/v1/admin/eventos/feira-teste/decisao', {
    method: 'POST', headers: { Cookie: 'balaio_sessao=sessao-privada', Origin: 'http://localhost:4321', 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: 'aprovar' }),
  }))
  assert.equal(saida.status, 200)
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/eventos/feira-teste/decisao')
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer sessao-privada')
  assert.doesNotMatch(await saida.text(), /sessao-privada/)
})

test('resumo da fila descreve a quantidade por estado', () => {
  assert.equal(resumoDaFilaDeEventos(0, 'PENDENTE'), 'Nenhum evento aguardando análise')
  assert.equal(resumoDaFilaDeEventos(1, 'PENDENTE'), '1 evento aguardando análise')
  assert.equal(resumoDaFilaDeEventos(3, 'APROVADO'), '3 eventos aprovados')
  assert.equal(resumoDaFilaDeEventos(1, 'REJEITADO'), '1 evento rejeitado')
})
