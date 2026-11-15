const regras: [string[], RegExp][] = [
  [['GET', 'HEAD'], /^\/(pecas|artesaos|coletivos|eventos|videos)(\/[^/]+)?$/],
  [['GET'], /^\/pecas\/[^/]+\/(historico|relacionadas|perguntas)$/],
  [['GET'], /^\/artesaos\/[^/]+\/pecas$/],
  [['GET', 'POST'], /^\/videos\/[^/]+\/comentarios$/],
  [['GET', 'HEAD'], /^\/(referencias|fretes)$/],
  [['GET', 'HEAD'], /^\/arquivos\/pecas\/[^/]+$/],
  [['GET'], /^\/estado$/],
  [['PUT'], /^\/estado\/(favoritos|sacola|historicoBusca|videosCurtidos|videosSalvos)$/],
  [['POST'], /^\/(eventos|auth\/recuperacao)$/],
]

const AUTENTICACAO_REAL = new Set(['/auth/cadastro', '/auth/login', '/auth/entrar', '/auth/logout'])

export function usaBackendReal(metodo: string, caminho: string): boolean {
  if (metodo === 'POST' && AUTENTICACAO_REAL.has(caminho)) return true
  if (metodo === 'GET' && (caminho === '/usuario' || caminho === '/fretes'
    || caminho === '/referencias' || caminho === '/artesao/me'
    || /^\/pedidos(?:\/[^/]+)?$/.test(caminho)
    || /^\/pecas(?:\/[^/]+)?$/.test(caminho)
    || /^\/artesaos\/[^/]+\/pecas$/.test(caminho)
    || /^\/artesao\/(vendas|pedidos-pendentes)$/.test(caminho))) return true
  if (['GET', 'HEAD'].includes(metodo) && /^\/arquivos\/pecas\/[^/]+$/.test(caminho)) return true
  if (metodo === 'POST' && (caminho === '/checkout' || caminho === '/pecas')) return true
  if (['PATCH', 'DELETE'].includes(metodo) && /^\/pecas\/[^/]+$/.test(caminho)) return true
  if (['POST', 'PATCH'].includes(metodo) && /^\/pedidos\/[^/]+\/(cancelar|recusar|estado)$/.test(caminho)) return true
  return false
}

export function rotaPublicaFake(metodo: string, caminho: string, query: URLSearchParams): boolean {
  if (caminho === '/videos' && query.getAll('painel').includes('true')) return false
  return regras.some(([metodos, padrao]) => metodos.includes(metodo) && padrao.test(caminho))
}

export function rotaContaFake(metodo: string, caminho: string): boolean {
  return (metodo === 'GET' && (caminho === '/conta/perfil' || /^\/pedidos(?:\/[^/]+)?$/.test(caminho)))
    || (metodo === 'PATCH' && caminho === '/usuario')
    || (['GET', 'POST'].includes(metodo) && caminho === '/usuario/enderecos')
    || (['PATCH', 'DELETE'].includes(metodo) && /^\/usuario\/enderecos\/[^/]+$/.test(caminho))
}
