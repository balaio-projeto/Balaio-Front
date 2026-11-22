import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { PAPEIS_CADASTRO } from '../src/services/api/auth.servico'
import { criarEvento, type SubmissaoEvento } from '../src/services/api/eventos.servico'
import {
  destinoInicial, podeOrganizarEventos, sessaoAtualizadaDoUsuario, sessaoDoUsuario, type Sessao,
} from '../src/services/sessao/cookie'
import { mensagemErroSubmissao, TEXTO_PENDENCIA } from '../src/components/eventos/mensagensSubmissao'

const usuarioBase = { id: 'conta-1', nome: 'Ana', email: 'ana@example.test', imagem: '' }
const sessaoComum: Sessao = { id: 'conta-1', nome: 'Ana', email: 'ana@example.test', imagem: '', papel: 'comprador' }

test('cadastro público não oferece organizador', () => {
  assert.deepEqual([...PAPEIS_CADASTRO], ['comprador', 'artesao'])
})

test('organizador é aceito como papel de sessão e tem destino seguro', () => {
  const sessao = sessaoDoUsuario({ ...usuarioBase, papel: 'organizador' })
  assert.equal(sessao?.papel, 'organizador')
  assert.equal(destinoInicial(sessao!), '/events/new')
  assert.equal(podeOrganizarEventos(sessao), true)
})

test('papel desconhecido não vira sessão', () => {
  assert.equal(sessaoDoUsuario({ ...usuarioBase, papel: 'root' as never }), null)
  assert.equal(podeOrganizarEventos(sessaoComum), false)
  assert.equal(podeOrganizarEventos(null), false)
})

test('papel persistido do servidor atualiza a sessão somente do mesmo usuário', () => {
  const atualizada = sessaoAtualizadaDoUsuario(sessaoComum, { ...usuarioBase, papel: 'organizador' })
  assert.equal(atualizada?.papel, 'organizador')
  assert.equal(sessaoAtualizadaDoUsuario(sessaoComum, { ...usuarioBase, id: 'outra', papel: 'organizador' }), null)
  assert.equal(sessaoAtualizadaDoUsuario(sessaoComum, null), null)
})

test('mensagem de permissão orienta novo login sem repetir a tentativa', () => {
  const mensagem = mensagemErroSubmissao('SEM_PERMISSAO')
  assert.match(mensagem.mensagem, /Entre novamente/)
})

test('confirmação de submissão indica análise e não aponta para a página pública do evento', () => {
  assert.match(TEXTO_PENDENCIA, /análise/)
  assert.doesNotMatch(TEXTO_PENDENCIA, /\/events\//)
})

const chamadas: { method: string; url: string; body: Record<string, unknown> | undefined }[] = []
let respostaProxima: { status: number; corpo: unknown } = { status: 200, corpo: null }
const servidor: Server = createServer(async (req: IncomingMessage, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  chamadas.push({ method: req.method!, url: req.url!, body: raw ? JSON.parse(raw) : undefined })
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = respostaProxima.status
  res.end(JSON.stringify(respostaProxima.corpo))
})

before(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${(servidor.address() as { port: number }).port}/api/v1`
  process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:4321'
})

after(() => new Promise<void>((resolve) => servidor.close(() => resolve())))

beforeEach(() => {
  chamadas.length = 0
})

const submissao: SubmissaoEvento = {
  slug: 'feira-teste', nome: 'Feira Teste', tipo: 'feira', organizador: 'Associação', descricao: 'Descrição',
  periodo: '12 de setembro', horario: '', entrada: 'Gratuita', cidade: 'Recife', local: 'Pátio', endereco: 'Recife, Pernambuco',
  lat: -8, lng: -35, artesaos: [], coletivos: [],
}

test('submissão envia dados sem marcador de publicação e aceita confirmação pendente', async () => {
  respostaProxima = { status: 202, corpo: { dados: { slug: 'feira-teste', status: 'PENDENTE' }, erro: null } }
  const resposta = await criarEvento(submissao)
  assert.equal(resposta.erro, null)
  assert.equal(resposta.dados?.status, 'PENDENTE')
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].method, 'POST')
  assert.equal(chamadas[0].url, '/api/v1/eventos')
  assert.equal('criadoPorVoce' in (chamadas[0].body ?? {}), false)
})

test('403 retorna SEM_PERMISSAO uma única vez, sem nova tentativa automática', async () => {
  respostaProxima = { status: 403, corpo: { dados: null, erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Operação não permitida.' } } }
  const resposta = await criarEvento(submissao)
  assert.equal(resposta.erro?.codigo, 'SEM_PERMISSAO')
  assert.equal(chamadas.length, 1)
})
