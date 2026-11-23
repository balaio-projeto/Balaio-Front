import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const URL_FRONT = process.env.E2E_REAL_FRONT_URL ?? 'http://localhost:4321'
export const URL_GATEWAY = process.env.E2E_REAL_GATEWAY_URL ?? 'http://localhost:8080'
export const CONTAINER_COMMERCE_DB = process.env.E2E_REAL_COMMERCE_DB ?? 'balaio-local-commerce-db-1'

export type Envelope<T> = { dados: T | null; erro: { codigo: string; mensagem: string; campos?: Record<string, string> } | null }
export type RespostaHttp<T> = { status: number; corpo: Envelope<T> | null }
export type UsuarioApi = { id: string; nome: string; email: string; papel: string }

const COOKIE_SESSAO = 'balaio_sessao'

export class SessaoApi {
  private cookie: string | null = null
  usuario: UsuarioApi | null = null

  get jwt() { return this.cookie }

  async requisitar<T>(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}): Promise<RespostaHttp<T>> {
    const resposta = await fetch(`${URL_GATEWAY}/api/v1${caminho}`, {
      method: metodo,
      headers: {
        Origin: URL_FRONT,
        Accept: 'application/json',
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: `${COOKIE_SESSAO}=${this.cookie}` } : {}),
        ...cabecalhos,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
    for (const linha of resposta.headers.getSetCookie()) {
      const [par] = linha.split(';')
      const [nome, ...valor] = par.split('=')
      if (nome.trim() === COOKIE_SESSAO) this.cookie = valor.join('=') || null
    }
    const texto = await resposta.text()
    let envelope: Envelope<T> | null = null
    try { envelope = texto ? JSON.parse(texto) as Envelope<T> : null } catch { envelope = null }
    return { status: resposta.status, corpo: envelope }
  }

  async entrar(email: string, senha: string) {
    const resposta = await this.requisitar<UsuarioApi>('POST', '/auth/login', { email, senha })
    if (resposta.status === 200 && resposta.corpo?.dados) this.usuario = resposta.corpo.dados
    return resposta
  }
}

export async function exigir<T>(promessa: Promise<RespostaHttp<T>>, esperado: number[], contexto: string): Promise<T> {
  const resposta = await promessa
  if (!esperado.includes(resposta.status)) {
    throw new Error(`${contexto}: HTTP ${resposta.status} ${JSON.stringify(resposta.corpo?.erro ?? resposta.corpo)}`)
  }
  return resposta.corpo?.dados as T
}

export async function contaComSessao(conta: { nome: string; email: string; senha: string; perfil: 'comprador' | 'artesao' }) {
  const sessao = new SessaoApi()
  const login = await sessao.entrar(conta.email, conta.senha)
  if (login.status === 200) return sessao
  const cadastro = await sessao.requisitar<UsuarioApi>('POST', '/auth/cadastro', conta)
  if (cadastro.status !== 201) throw new Error(`cadastro de ${conta.email}: HTTP ${cadastro.status} ${JSON.stringify(cadastro.corpo?.erro)}`)
  await exigir(sessao.entrar(conta.email, conta.senha), [200], `login de ${conta.email}`)
  return sessao
}

function lerArquivoEnv(arquivo: string): Record<string, string> {
  if (!existsSync(arquivo)) return {}
  const valores: Record<string, string> = {}
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#') || !limpa.includes('=')) continue
    const indice = limpa.indexOf('=')
    valores[limpa.slice(0, indice).trim()] = limpa.slice(indice + 1).trim()
  }
  return valores
}

const arquivoEnvPlataforma = () => process.env.BALAIO_PLATFORM_ENV ?? path.resolve(__dirname, '../../../../../platform/.env')

export const URL_CATALOG_INTERNO = process.env.E2E_REAL_CATALOG_URL ?? 'http://127.0.0.1:8081'

export function tokenInterno() {
  const token = process.env.BALAIO_INTERNAL_TOKEN ?? lerArquivoEnv(arquivoEnvPlataforma()).BALAIO_INTERNAL_TOKEN ?? 'balaio-local-internal-token-1234567890'
  return token
}

export function credenciaisAdmin() {
  const arquivo = arquivoEnvPlataforma()
  const env = lerArquivoEnv(arquivo)
  const email = process.env.QA_ADMIN_EMAIL ?? env.ADMIN_EMAIL
  const senhaInicial = process.env.QA_ADMIN_SENHA_INICIAL ?? env.ADMIN_SENHA_INICIAL
  const senha = process.env.QA_ADMIN_SENHA ?? env.QA_ADMIN_SENHA
  if (!email || !senha) {
    throw new Error(`Admin de QA ausente: defina ADMIN_EMAIL, ADMIN_SENHA_INICIAL e QA_ADMIN_SENHA em ${arquivo} ou exporte QA_ADMIN_EMAIL/QA_ADMIN_SENHA.`)
  }
  return { email, senha, senhaInicial }
}

export async function sessaoAdmin() {
  const { email, senha, senhaInicial } = credenciaisAdmin()
  const sessao = new SessaoApi()
  const login = await sessao.entrar(email, senha)
  if (login.status === 200) return sessao
  if (!senhaInicial) throw new Error(`login do admin de QA: HTTP ${login.status}`)
  await exigir(sessao.entrar(email, senhaInicial), [200], 'login do admin com a senha inicial')
  await exigir(sessao.requisitar('POST', '/auth/alterar-senha', { senhaAtual: senhaInicial, novaSenha: senha }), [200], 'troca obrigatória da senha do admin')
  await exigir(sessao.entrar(email, senha), [200], 'login do admin após a troca')
  return sessao
}

export function executarSqlCommerce(sql: string): string {
  return execFileSync('docker', ['exec', '-i', CONTAINER_COMMERCE_DB, 'sh', '-c',
    'psql -v ON_ERROR_STOP=1 -qAt -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: sql, encoding: 'utf8' })
}

const literal = (valor: string) => `'${valor.replaceAll("'", "''")}'`

export type PedidoDeTeste = {
  id: string
  compradorId: string
  artesaoId: string
  slug: string
  preco: number
  disponibilidade: string
  estado: 'confirmado' | 'producao' | 'enviado' | 'entregue'
  rastreio?: string
}

const SEQUENCIA_ESTADOS = ['confirmacao_pendente', 'confirmado', 'producao', 'enviado', 'entregue'] as const

export function inserirPedidoPago(pedido: PedidoDeTeste) {
  const frete = 38.9
  const total = (pedido.preco + frete).toFixed(2)
  const endereco = JSON.stringify({ cep: '01310-100', endereco: 'Avenida Paulista, 1000', cidade: 'São Paulo', estado: 'SP' })
  const cotacao = JSON.stringify({ id: 'padrao', nome: 'Entrega regional demonstrativa', prazo: '10 a 14 dias úteis', valor: frete, provedor: 'fixo_demonstrativo', cepDestino: '01310100' })
  const destino = SEQUENCIA_ESTADOS.indexOf(pedido.estado)
  const transicoes = SEQUENCIA_ESTADOS.slice(0, destino + 1).map((estado) => {
    const envio = estado === 'enviado' && pedido.rastreio ? `, rastreio = ${literal(pedido.rastreio)}, transportadora = 'Correios'` : ''
    return `UPDATE pedidos SET estado = ${literal(estado)}${envio}, atualizado_em = now() WHERE id = ${literal(pedido.id)};`
  })
  const sql = [
    'BEGIN;',
    `INSERT INTO pedidos(id, comprador_id, artesao_id, estado, chave_checkout, fingerprint_checkout, endereco, frete_id, frete, total, meio, frete_cotacao)
     VALUES (${literal(pedido.id)}, ${literal(pedido.compradorId)}, ${literal(pedido.artesaoId)}, 'aguardando_pagamento', ${literal(`e2e-real-${pedido.id}`)}, 'e2e-real',
     ${literal(endereco)}::jsonb, 'padrao', ${frete}, ${total}, 'checkout_pro', ${literal(cotacao)}::jsonb);`,
    `INSERT INTO pedido_itens(pedido_id, slug, quantidade, preco, disponibilidade) VALUES (${literal(pedido.id)}, ${literal(pedido.slug)}, 1, ${pedido.preco.toFixed(2)}, ${literal(pedido.disponibilidade)});`,
    ...transicoes,
    'COMMIT;',
  ].join('\n')
  executarSqlCommerce(sql)
}

export function pedidoExiste(id: string) {
  return executarSqlCommerce(`SELECT count(*) FROM pedidos WHERE id = ${literal(id)};`).trim() === '1'
}
