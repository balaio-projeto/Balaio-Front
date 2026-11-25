import { COLECOES } from './colecoes'

type Regra = [string[], RegExp]

const LEITURA = ['GET', 'HEAD']
const SEGMENTO = '[^/]+'
const LIMITE_JSON_COMMUNITY = 64 * 1024
export const LIMITE_MIDIA = 100 * 1024 * 1024
const LIMITE_IMAGEM_PERFIL = 3 * 1024 * 1024
const ROTAS_DE_IMAGEM_PERFIL = ['/artesao/me/imagem', '/usuario/imagem']

export const CAMINHOS_DE_AUTENTICACAO = ['/auth/cadastro', '/auth/login', '/auth/entrar', '/auth/logout']

function rota(padrao: string): RegExp {
  return new RegExp(`^${padrao.replaceAll(':id', SEGMENTO)}$`)
}

const ROTA_DE_MIDIA = rota('/videos/:id/(arquivo|capa)')

const ROTAS_COMMUNITY: Regra[] = [
  [['GET', 'POST'], rota('/pecas/:id/perguntas')],
  [['PATCH'], rota('/pecas/:id/perguntas/:id')],
  [['GET', 'PUT', 'PATCH'], rota(`/estado/(${COLECOES.join('|')})`)],
  [[...LEITURA, 'POST'], /^\/videos$/],
  [[...LEITURA, 'PATCH', 'DELETE'], rota('/videos/:id')],
  [[...LEITURA, 'PUT'], ROTA_DE_MIDIA],
  [['GET', 'POST'], rota('/videos/:id/comentarios')],
  [['POST'], rota('/videos/:id/visualizacoes')],
  [['GET', 'POST'], rota('/pedidos/:id/avaliacao')],
  [['GET', 'POST'], rota('/pedidos/:id/conversa')],
  [['POST'], rota('/pedidos/:id/conversa/leitura')],
  [['GET'], /^\/artesao\/conversas$/],
  [['GET'], rota('/artesaos/:id/reputacao')],
  [['GET', 'POST'], /^\/admin\/mediacoes$/],
  [['PATCH'], rota('/admin/mediacoes/:id')],
  [['POST'], rota('/admin/mediacoes/:id/decisao')],
  [['POST'], rota('/admin/mediacoes/:id/reprocessar-entrega')],
  [['POST'], rota('/admin/mediacoes/:id/cancelamento')],
  [['GET'], /^\/admin\/videos$/],
  [['POST'], rota('/admin/videos/:id/(suspensao|reativacao)')],
]

function atende(regras: Regra[], metodo: string, caminho: string): boolean {
  return regras.some(([metodos, padrao]) => metodos.includes(metodo) && padrao.test(caminho))
}

export function ehRotaDeMidia(caminho: string): boolean {
  return ROTA_DE_MIDIA.test(caminho)
}

export function ehLeituraDeImagemPerfil(metodo: string, caminho: string): boolean {
  return LEITURA.includes(metodo) && /^\/arquivos\/perfis\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caminho)
}

export function ehLeituraDeFotoDePeca(metodo: string, caminho: string): boolean {
  return LEITURA.includes(metodo)
    && /^\/arquivos\/pecas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(caminho)
}

export function limiteDoCorpo(metodo: string, caminho: string): number | null {
  if (metodo === 'PUT' && ROTAS_DE_IMAGEM_PERFIL.includes(caminho)) return LIMITE_IMAGEM_PERFIL
  if (ehRotaDeMidia(caminho)) return LIMITE_MIDIA
  return atende(ROTAS_COMMUNITY, metodo, caminho) ? LIMITE_JSON_COMMUNITY : null
}
