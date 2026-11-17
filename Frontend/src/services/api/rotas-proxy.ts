import { COLECOES } from './colecoes'

type Regra = [string[], RegExp]

const LEITURA = ['GET', 'HEAD']
const SEGMENTO = '[^/]+'
const LIMITE_JSON_COMMUNITY = 64 * 1024
export const LIMITE_MIDIA = 100 * 1024 * 1024

export const CAMINHOS_DE_AUTENTICACAO = ['/auth/cadastro', '/auth/login', '/auth/entrar', '/auth/logout']

function rota(padrao: string): RegExp {
  return new RegExp(`^${padrao.replaceAll(':id', SEGMENTO)}$`)
}

const ROTAS_SIMULADAS: Regra[] = [
  [LEITURA, /^\/(pecas|artesaos|coletivos|eventos)(\/[^/]+)?$/],
  [['GET'], rota('/pecas/:id/(historico|relacionadas)')],
  [['HEAD'], /^\/(referencias|fretes)$/],
  [['GET'], /^\/estado$/],
  [['POST'], /^\/(eventos|auth\/recuperacao)$/],
]

const ROTAS_PROFILE: Regra[] = [
  [['POST'], new RegExp(`^(${CAMINHOS_DE_AUTENTICACAO.join('|')})$`)],
  [['GET'], /^\/(usuario|artesao\/me)$/],
]

const ROTAS_CATALOG: Regra[] = [
  [['GET'], /^\/(referencias|pecas)$/],
  [['GET'], rota('/pecas/:id')],
  [['GET'], rota('/artesaos/:id/pecas')],
  [LEITURA, rota('/arquivos/pecas/:id')],
  [['POST'], /^\/pecas$/],
  [['PATCH', 'DELETE'], rota('/pecas/:id')],
]

const ROTAS_COMMERCE: Regra[] = [
  [['GET', 'PUT'], /^\/estado\/sacola$/],
  [['GET'], /^\/(fretes|pedidos)$/],
  [['GET'], rota('/pedidos/:id')],
  [['GET'], /^\/artesao\/(vendas|pedidos-pendentes)$/],
  [['POST'], /^\/checkout$/],
  [['POST', 'PATCH'], rota('/pedidos/:id/(cancelar|recusar|estado)')],
]

const ROTA_DE_MIDIA = rota('/videos/:id/(arquivo|capa)')

const ROTAS_COMMUNITY: Regra[] = [
  [['GET', 'POST'], rota('/pecas/:id/perguntas')],
  [['PATCH'], rota('/pecas/:id/perguntas/:id')],
  [['GET', 'PUT'], rota(`/estado/(${COLECOES.join('|')})`)],
  [[...LEITURA, 'POST'], /^\/videos$/],
  [[...LEITURA, 'PATCH', 'DELETE'], rota('/videos/:id')],
  [[...LEITURA, 'PUT'], ROTA_DE_MIDIA],
  [['GET', 'POST'], rota('/videos/:id/comentarios')],
  [['GET', 'POST'], rota('/pedidos/:id/avaliacao')],
  [['GET'], rota('/artesaos/:id/reputacao')],
  [['GET', 'POST'], /^\/admin\/mediacoes$/],
  [['PATCH'], rota('/admin/mediacoes/:id')],
  [['POST'], rota('/admin/mediacoes/:id/decisao')],
]

const ROTAS_REAIS = [...ROTAS_PROFILE, ...ROTAS_CATALOG, ...ROTAS_COMMERCE, ...ROTAS_COMMUNITY]

function atende(regras: Regra[], metodo: string, caminho: string): boolean {
  return regras.some(([metodos, padrao]) => metodos.includes(metodo) && padrao.test(caminho))
}

export function usaBackendReal(metodo: string, caminho: string): boolean {
  return atende(ROTAS_REAIS, metodo, caminho)
}

export function ehRotaDeMidia(caminho: string): boolean {
  return ROTA_DE_MIDIA.test(caminho)
}

export function limiteDoCorpo(metodo: string, caminho: string): number | null {
  if (ehRotaDeMidia(caminho)) return LIMITE_MIDIA
  return atende(ROTAS_COMMUNITY, metodo, caminho) ? LIMITE_JSON_COMMUNITY : null
}

export function rotaPublicaFake(metodo: string, caminho: string): boolean {
  return atende(ROTAS_SIMULADAS, metodo, caminho)
}

export function rotaContaFake(metodo: string, caminho: string): boolean {
  return (metodo === 'GET' && (caminho === '/conta/perfil' || /^\/pedidos(?:\/[^/]+)?$/.test(caminho)))
    || (metodo === 'PATCH' && caminho === '/usuario')
    || (['GET', 'POST'].includes(metodo) && caminho === '/usuario/enderecos')
    || (['PATCH', 'DELETE'].includes(metodo) && /^\/usuario\/enderecos\/[^/]+$/.test(caminho))
}
