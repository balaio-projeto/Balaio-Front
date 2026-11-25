import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import {
  hrefAdmin, lerBusca, lerFiltrosContas, lerFiltrosCuradoria, lerPagina, parametrosContas, parametrosCuradoria,
} from './filtrosAdmin'
import { listarContasAdmin } from '../services/api/contasAdmin.servico'

const urls: { url: string; authorization?: string }[] = []
const servidor = createServer((req, res) => {
  urls.push({ url: req.url!, authorization: req.headers.authorization })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    dados: [{ id: 'c1', nome: 'Ana', email: 'ana@example.test', papel: 'organizador', imagem: null }],
    erro: null,
    paginacao: { pagina: 2, tamanho: 10, total: 11, totalPaginas: 2 },
  }))
})
before(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/api/v1`
})
after(async () => { await new Promise<void>((resolve) => servidor.close(() => resolve())) })

test('página inválida ou ausente volta para 1', () => {
  assert.equal(lerPagina(undefined), 1)
  assert.equal(lerPagina('0'), 1)
  assert.equal(lerPagina('-3'), 1)
  assert.equal(lerPagina('abc'), 1)
  assert.equal(lerPagina('2.5'), 1)
  assert.equal(lerPagina(['3', '4']), 3)
  assert.equal(lerPagina(' 7 '), 7)
})

test('busca é aparada e limitada a 100 caracteres', () => {
  assert.equal(lerBusca('  Casa da Renda  '), 'Casa da Renda')
  assert.equal(lerBusca(undefined), '')
  assert.equal(lerBusca('x'.repeat(150)).length, 100)
})

test('filtros da curadoria aceitam só situações conhecidas e usam pendente por padrão', () => {
  assert.deepEqual(lerFiltrosCuradoria({}), { situacao: 'pendente', busca: '', pagina: 1 })
  assert.deepEqual(lerFiltrosCuradoria({ situacao: 'AJUSTE', busca: ' ana ', pagina: '2' }), { situacao: 'ajuste', busca: 'ana', pagina: 2 })
  assert.equal(lerFiltrosCuradoria({ situacao: 'recusada' }).situacao, 'pendente')
  assert.deepEqual(parametrosCuradoria({ situacao: 'pendente', busca: '' }), { situacao: undefined, busca: '' })
})

test('filtros de contas aceitam só comprador, organizador ou todos', () => {
  assert.deepEqual(lerFiltrosContas({}), { papel: 'todos', busca: '', pagina: 1 })
  assert.equal(lerFiltrosContas({ papel: 'organizador' }).papel, 'organizador')
  assert.equal(lerFiltrosContas({ papel: 'admin' }).papel, 'todos')
  assert.equal(lerFiltrosContas({ papel: 'artesao' }).papel, 'todos')
  assert.deepEqual(parametrosContas({ papel: 'todos', busca: 'ana' }), { papel: undefined, busca: 'ana' })
})

test('href do admin omite valores padrão e vazios e mantém os filtros', () => {
  assert.equal(hrefAdmin('/admin', { situacao: undefined, busca: '', pagina: 1 }), '/admin')
  assert.equal(hrefAdmin('/admin', { situacao: 'ajuste', busca: 'Casa da Renda', pagina: 3 }), '/admin?situacao=ajuste&busca=Casa+da+Renda&pagina=3')
  assert.equal(hrefAdmin('/admin/accounts', { papel: 'organizador', pagina: 1 }), '/admin/accounts?papel=organizador')
})

test('listagem de contas envia busca, papel e página e devolve a paginação', async () => {
  const resposta = await listarContasAdmin({ busca: ' ana@example.test ', papel: 'organizador', pagina: 2, tamanho: 10 }, 'sessao-admin')
  assert.equal(urls.at(-1)?.url, '/api/v1/admin/contas?busca=ana%40example.test&papel=organizador&pagina=2&tamanho=10')
  assert.equal(urls.at(-1)?.authorization, 'Bearer sessao-admin')
  assert.equal(resposta.paginacao?.total, 11)
  assert.equal(resposta.dados?.[0].papel, 'organizador')
  await listarContasAdmin({ busca: '  ' })
  assert.equal(urls.at(-1)?.url, '/api/v1/admin/contas')
})
