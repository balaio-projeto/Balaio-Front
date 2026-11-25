import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer, type IncomingMessage } from 'node:http'
import {
  consultarPendentesCuradoria, decidirSolicitacaoSelo, listarFilaCuradoria, obterMeuSelo, solicitarSelo, totalDaFila,
} from '../src/services/api/curadoria.servico'
import { encaminharApi } from '../src/services/api/proxy'
import { montarFilaCuradoria } from '../src/components/admin/montarFilaCuradoria'
import type { Peca, SolicitacaoSeloNaFila } from '../src/types/dominio'

const chamadas: { url: string; method: string; headers: IncomingMessage['headers']; body: unknown }[] = []
let status = 200
let corpoFixo: unknown = null
const servidor = createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  chamadas.push({ url: req.url!, method: req.method!, headers: req.headers, body: raw ? JSON.parse(raw) : undefined })
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(corpoFixo ?? (status === 200
    ? { dados: { selo: false, solicitacao: { id: 'solicitacao-1', situacao: 'pendente' } }, erro: null }
    : { dados: null, erro: { codigo: 'CATALOGO_INDISPONIVEL', mensagem: 'Não foi possível conferir as peças publicadas.' } })))
})
before(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/api/v1`
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})
after(async () => { await new Promise<void>((resolve) => servidor.close(() => resolve())) })

test('consulta do próprio selo e fila SSR encaminham a sessão explicitamente', async () => {
  await obterMeuSelo('sessao-servidor')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/artesao/selo')
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer sessao-servidor')
  await listarFilaCuradoria('sessao-admin')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/curadoria')
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer sessao-admin')
})
test('solicitação envia somente mensagem e preserva o contrato de resposta', async () => {
  const resposta = await solicitarSelo('Confirmar minha autoria')
  assert.deepEqual(chamadas.at(-1)?.body, { mensagem: 'Confirmar minha autoria' })
  assert.equal(chamadas.at(-1)?.method, 'POST')
  assert.equal(resposta.dados?.solicitacao?.situacao, 'pendente')
})
test('aprovação e ajuste usam a decisão existente sem novos endpoints', async () => {
  await decidirSolicitacaoSelo('solicitacao-1', 'aprovada')
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/curadoria/solicitacao-1/decisao')
  assert.deepEqual(chamadas.at(-1)?.body, { decisao: 'aprovada', motivo: '' })
  await decidirSolicitacaoSelo('solicitacao-1', 'ajuste', 'Informe a associação')
  assert.deepEqual(chamadas.at(-1)?.body, { decisao: 'ajuste', motivo: 'Informe a associação' })
})
test('falha da consulta é preservada como erro, sem fabricar estado sem solicitação', async () => {
  status = 503
  try {
    const resposta = await obterMeuSelo('sessao-servidor')
    assert.equal(resposta.dados, null)
    assert.equal(resposta.erro?.status, 503)
    assert.equal(resposta.erro?.codigo, 'CATALOGO_INDISPONIVEL')
  } finally { status = 200 }
})
test('proxy usa cookie HttpOnly como Bearer nas decisões e não expõe token no JSON', async () => {
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/admin/curadoria/solicitacao-1/decisao', {
    method: 'POST', headers: { Cookie: 'balaio_sessao=sessao-privada', Origin: 'http://localhost:4321', 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: 'ajuste', motivo: 'Revisar fotos' }),
  }))
  assert.equal(resposta.status, 200)
  assert.equal(chamadas.at(-1)?.headers.authorization, 'Bearer sessao-privada')
  assert.ok(!(await resposta.text()).includes('sessao-privada'))
})
test('proxy recusa Origin externo antes de encaminhar uma decisão', async () => {
  const antes = chamadas.length
  const resposta = await encaminharApi(new Request('http://localhost:4321/api/v1/artesao/selo', {
    method: 'POST', headers: { Cookie: 'balaio_sessao=sessao-privada', Origin: 'https://evil.example' }, body: '{}',
  }))
  assert.equal(resposta.status, 403)
  assert.equal(chamadas.length, antes)
})
test('fila de curadoria distingue catálogo indisponível de artesão sem peças', () => {
  const solicitacao = (id: string, artesaoSlug: string, solicitadoEm: string): SolicitacaoSeloNaFila => ({
    id, artesaoSlug, artesao: artesaoSlug, atelie: `Ateliê ${artesaoSlug}`, mensagem: '', situacao: 'pendente',
    solicitadoEm, territorio: 'Recife', tecnica: 'renda', imagem: '', pecasPublicadas: 0,
  })
  const pecaPublicada = { slug: 'toalha', nome: 'Toalha', imagem: '/toalha.jpg', situacao: 'publicada' } as Peca
  const fila = montarFilaCuradoria(
    [
      solicitacao('s1', 'ana', '2026-11-01T10:00:00Z'),
      solicitacao('s2', 'bia', '2026-11-02T10:00:00Z'),
      solicitacao('s3', 'caio', '2026-11-03T10:00:00Z'),
    ],
    [null, [], [pecaPublicada]],
    [],
  )
  assert.deepEqual(fila.map(({ id, pecasIndisponiveis, pecas }) => ({ id, pecasIndisponiveis, total: pecas.length })), [
    { id: 's1', pecasIndisponiveis: true, total: 0 },
    { id: 's2', pecasIndisponiveis: false, total: 0 },
    { id: 's3', pecasIndisponiveis: false, total: 1 },
  ])
})
test('fila envia filtros, busca e página na query e omite o que não foi informado', async () => {
  await listarFilaCuradoria('sessao-admin', { situacao: 'ajuste', busca: '  Casa da Renda ', pagina: 2, tamanho: 10 })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/curadoria?situacao=ajuste&busca=Casa+da+Renda&pagina=2&tamanho=10')
  await listarFilaCuradoria('sessao-admin', { situacao: 'todas', busca: '   ' })
  assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/curadoria?situacao=todas')
})
test('contador da fila usa o total paginado dos pendentes, não o tamanho da página', async () => {
  corpoFixo = { dados: [{ id: 's1' }], erro: null, paginacao: { pagina: 1, tamanho: 1, total: 37, totalPaginas: 37 } }
  try {
    const resposta = await consultarPendentesCuradoria('sessao-admin')
    assert.equal(chamadas.at(-1)?.url, '/api/v1/admin/curadoria?situacao=pendente&tamanho=1&apenasTotal=true')
    assert.equal(totalDaFila(resposta), 37)
  } finally { corpoFixo = null }
  assert.equal(totalDaFila({ dados: [], erro: null }), 0)
  assert.equal(totalDaFila({ dados: null, erro: { codigo: 'FALHA', mensagem: 'x' } }), undefined)
})
test('fila montada preserva a ordem do servidor (decididas pela decisão mais recente)', () => {
  const base = { artesaoSlug: 'ana', artesao: 'Ana', atelie: 'Ateliê', mensagem: '', territorio: '', tecnica: '', imagem: '', pecasPublicadas: 2 }
  const fila = montarFilaCuradoria(
    [
      { ...base, id: 'recente', situacao: 'ajuste', solicitadoEm: '2026-01-02T00:00:00Z', decididoEm: '2026-03-01T00:00:00Z', motivo: 'Fotos' },
      { ...base, id: 'antiga', situacao: 'aprovada', solicitadoEm: '2026-01-01T00:00:00Z', decididoEm: '2026-02-01T00:00:00Z' },
    ],
    [null, null],
    [],
  )
  assert.deepEqual(fila.map(({ id }) => id), ['recente', 'antiga'])
})
