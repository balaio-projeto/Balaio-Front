import { falha, type RespostaApi } from './tipos'
import { usaBackendReal } from './rotas-proxy'

function baseDaRota(caminho: string, metodo: string): string {
  if (typeof window !== 'undefined') return '/api/v1'
  const rota = caminho.split('?')[0]
  return process.env.API_GATEWAY_URL && usaBackendReal(metodo, rota)
    ? process.env.API_GATEWAY_URL
    : process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1'
}

export async function buscar<T>(caminho: string, opcoes?: RequestInit, baseUrl?: string): Promise<RespostaApi<T>> {
  try {
    const resposta = await fetch(`${baseUrl ?? baseDaRota(caminho, (opcoes?.method ?? 'GET').toUpperCase())}${caminho}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...opcoes,
      headers: { 'Content-Type': 'application/json', ...opcoes?.headers },
      signal: opcoes?.signal ?? AbortSignal.timeout(10000),
    })
    const corpo = await resposta.json().catch(() => null)
    if (!resposta.ok) {
      const resultado = falha(corpo?.erro?.codigo ?? `HTTP_${resposta.status}`,
        corpo?.erro?.mensagem ?? 'Não foi possível concluir a solicitação.',
        corpo?.erro?.campos, corpo?.erro?.campo)
      resultado.erro!.status = resposta.status
      return resultado
    }
    if (resposta.status === 204) return { dados: null, erro: null }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || !('dados' in corpo) || !('erro' in corpo)) return falha('RESPOSTA_INVALIDA', 'O servidor retornou uma resposta inválida.')
    return corpo as RespostaApi<T>
  } catch {
    return falha('ERRO_REDE', 'Não foi possível falar com o servidor.')
  }
}

export function comToken(token?: string): RequestInit | undefined {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
}

export function enviar<T>(caminho: string, corpo: unknown, metodo = 'POST'): Promise<RespostaApi<T>> {
  return buscar<T>(caminho, { method: metodo, body: JSON.stringify(corpo) })
}

export function montarQuery(filtros: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '') params.set(chave, String(valor))
  }
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}
