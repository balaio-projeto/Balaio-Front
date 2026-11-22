import { urlDoGateway } from './gateway'
import { CAMINHOS_DE_AUTENTICACAO, ehLeituraDeImagemPerfil, ehRotaDeMidia, limiteDoCorpo } from './rotas-proxy'

const AUTENTICACAO = new Set(CAMINHOS_DE_AUTENTICACAO)
const PREFIXO_DA_API = '/api/v1'
const COOKIE_DE_SESSAO = 'balaio_sessao='
const PRAZO_PADRAO_MS = 10_000
const PRAZO_CABECALHOS_MIDIA_MS = 10 * 60_000
const CABECALHOS_ENCAMINHADOS = ['accept', 'content-type', 'origin', 'idempotency-key']
const CABECALHOS_DE_RESPOSTA = ['content-type', 'content-disposition', 'www-authenticate']
const CABECALHOS_DE_MIDIA = ['content-range', 'accept-ranges', 'content-length']

function erro(status: number, codigo: string, mensagem: string) {
  return Response.json({ dados: null, erro: { codigo, mensagem } }, {
    status, headers: { 'Cache-Control': 'no-store' },
  })
}

function destinoDoGateway() {
  const url = new URL(urlDoGateway())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Destino da API inválido')
  }
  return url.href.replace(/\/$/, '')
}

function origemPermitida(requisicao: Request) {
  const origem = requisicao.headers.get('origin')
  const origens = (process.env.AUTH_ALLOWED_ORIGINS ?? 'http://localhost:4321,http://127.0.0.1:4321')
    .split(',').map((item) => item.trim()).filter(Boolean)
  if (origem !== null && !origens.includes(origem)) return false
  const porCookie = /(?:^|;)\s*balaio_sessao=/.test(requisicao.headers.get('cookie') ?? '')
  return ['GET', 'HEAD'].includes(requisicao.method) || !porCookie || origem !== null
}

function cookieDeSessaoNaRaiz(cookie: string) {
  if (!/^balaio_sessao=/i.test(cookie)) return cookie
  const atributos = cookie.split(';').map((parte) => parte.trim()).filter((parte) => !/^path=/i.test(parte))
  return [...atributos, 'Path=/'].join('; ')
}

function cookiesDeSessao(requisicao: Request): string[] {
  return (requisicao.headers.get('cookie') ?? '').split(';').map((item) => item.trim())
    .filter((item) => item.startsWith(COOKIE_DE_SESSAO))
}

function tokenDoCookie(requisicao: Request): string | null {
  const token = cookiesDeSessao(requisicao)[0]?.slice(COOKIE_DE_SESSAO.length)
  return token ? token : null
}

function caminhoInvalido(url: URL, caminho: string) {
  return !url.pathname.startsWith(`${PREFIXO_DA_API}/`) || /%2f|%5c|%2e|\\|\/\//i.test(caminho)
    || [...url.searchParams.keys()].some((chave) => chave.startsWith('_'))
}

async function buscarComPrazoNosCabecalhos(url: string, opcoes: RequestInit, prazoMs: number): Promise<Response> {
  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), prazoMs)
  try {
    return await fetch(url, { ...opcoes, signal: controle.signal })
  } finally {
    clearTimeout(temporizador)
  }
}

function cabecalhosParaOGateway(requisicao: Request, midia: boolean): Headers {
  const headers = new Headers()
  for (const nome of [...CABECALHOS_ENCAMINHADOS, ...(midia ? ['range'] : [])]) {
    const valor = requisicao.headers.get(nome)
    if (valor) headers.set(nome, valor)
  }
  const sessao = cookiesDeSessao(requisicao)
  if (sessao.length) headers.set('cookie', sessao.join('; '))
  const autorizacao = requisicao.headers.get('authorization')
  const token = autorizacao ? null : tokenDoCookie(requisicao)
  if (autorizacao) headers.set('authorization', autorizacao)
  else if (token) headers.set('authorization', `Bearer ${token}`)
  return headers
}

function respostaAoNavegador(resposta: Response, url: URL, midia: boolean, imagemPerfil: boolean, semCorpo: boolean): Response {
  const saida = new Headers({ 'Cache-Control': 'no-store' })
  for (const nome of [...CABECALHOS_DE_RESPOSTA, ...(midia ? CABECALHOS_DE_MIDIA : [])]) {
    const valor = resposta.headers.get(nome)
    if (valor) saida.set(nome, valor)
  }
  if (imagemPerfil) {
    for (const nome of ['content-length', 'cache-control', 'x-content-type-options']) {
      const valor = resposta.headers.get(nome)
      if (valor) saida.set(nome, valor)
    }
  }
  const cookies = resposta.headers.getSetCookie()
  for (const cookie of cookies) saida.append('set-cookie', cookieDeSessaoNaRaiz(cookie))
  const secure = url.protocol === 'https:' || cookies.some((cookie) => /;\s*Secure(?:;|$)/i.test(cookie))
  const sufixo = `Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`
  saida.append('set-cookie', `balaio_sessao=; HttpOnly; Path=${PREFIXO_DA_API}; ${sufixo}`)
  saida.append('set-cookie', `balaio-sessao=; Path=/; ${sufixo}`)
  return new Response(semCorpo ? null : resposta.body, { status: resposta.status, headers: saida })
}

export async function encaminharApi(requisicao: Request): Promise<Response> {
  const url = new URL(requisicao.url)
  const caminho = url.pathname.slice(PREFIXO_DA_API.length)
  if (caminhoInvalido(url, caminho)) return erro(400, 'REQUISICAO_INVALIDA', 'Requisição inválida.')
  const metodo = requisicao.method.toUpperCase()
  if (AUTENTICACAO.has(caminho) && metodo !== 'POST') {
    return erro(405, 'METODO_NAO_PERMITIDO', 'Método não permitido.')
  }
  const semCorpo = ['GET', 'HEAD'].includes(metodo)
  const imagemPerfil = ehLeituraDeImagemPerfil(metodo, caminho)
  if (caminho.startsWith('/arquivos/perfis') && !imagemPerfil) {
    return erro(404, 'RECURSO_NAO_ENCONTRADO', 'Arquivo não encontrado.')
  }
  if (!semCorpo && tokenDoCookie(requisicao) && !requisicao.headers.get('authorization') && !origemPermitida(requisicao)) {
    return erro(403, 'SEM_PERMISSAO', 'Origem não permitida.')
  }
  const midia = ehRotaDeMidia(caminho)
  const limite = semCorpo ? null : limiteDoCorpo(metodo, caminho)
  if (limite !== null && Number(requisicao.headers.get('content-length')) > limite) {
    return erro(413, 'REQUISICAO_INVALIDA', 'O conteúdo enviado é grande demais.')
  }
  const headers = cabecalhosParaOGateway(requisicao, midia)
  if (imagemPerfil) {
    headers.delete('cookie')
    headers.delete('authorization')
  }

  try {
    const destino = `${destinoDoGateway()}${caminho}${url.search}`
    let corpo: ArrayBuffer | undefined
    if (!semCorpo && !midia) {
      corpo = await requisicao.arrayBuffer()
      if (limite !== null && corpo.byteLength > limite) {
        return erro(413, 'REQUISICAO_INVALIDA', 'O conteúdo enviado é grande demais.')
      }
    }
    const resposta = midia
      ? await buscarComPrazoNosCabecalhos(destino, {
        method: metodo, headers, cache: 'no-store', redirect: 'manual',
        body: semCorpo ? undefined : requisicao.body, duplex: 'half',
      } as RequestInit, PRAZO_CABECALHOS_MIDIA_MS)
      : await fetch(destino, {
        method: metodo, headers, cache: 'no-store', redirect: 'manual',
        body: corpo,
        signal: AbortSignal.timeout(PRAZO_PADRAO_MS),
      })
    if (resposta.status >= 300 && resposta.status < 400) {
      return erro(502, 'API_INDISPONIVEL', 'A API retornou um redirecionamento inesperado.')
    }
    return respostaAoNavegador(resposta, url, midia, imagemPerfil, metodo === 'HEAD')
  } catch {
    return erro(502, 'API_INDISPONIVEL', 'Não foi possível falar com o servidor.')
  }
}
