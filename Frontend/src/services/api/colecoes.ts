export const COLECOES = ['favoritos', 'historicoBusca', 'videosCurtidos', 'videosSalvos'] as const
export type Colecao = typeof COLECOES[number]
export type ColecoesDoUsuario = Record<Colecao, string[]>
