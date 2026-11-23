import { buscar, enviar, montarQuery } from './cliente'
import type { RespostaApi } from './tipos'

export type PerguntaPublica = {
  id: string
  pecaSlug: string
  pergunta: string
  autor: string
  usuarioId?: string
  criadaEm?: string | null
  resposta?: string | null
  respondidaEm?: string | null
}

export const TAMANHO_PAGINA_PERGUNTAS = 50

const caminhoDasPerguntas = (slug: string) => `/pecas/${encodeURIComponent(slug)}/perguntas`

export const listarPerguntas = (slug: string, pagina = 0): Promise<RespostaApi<PerguntaPublica[]>> =>
  buscar(`${caminhoDasPerguntas(slug)}${montarQuery({ pagina: pagina > 0 ? pagina : undefined })}`)
export const criarPergunta = (slug: string, pergunta: string): Promise<RespostaApi<PerguntaPublica>> => enviar(caminhoDasPerguntas(slug), { pergunta })
export const responderPergunta = (slug: string, id: string, resposta: string): Promise<RespostaApi<PerguntaPublica>> => enviar(`${caminhoDasPerguntas(slug)}/${encodeURIComponent(id)}`, { resposta }, 'PATCH')
