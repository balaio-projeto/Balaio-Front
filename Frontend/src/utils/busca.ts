export type EstadoDaBusca = 'erro' | 'vazio' | 'resultados'

/**
 * Falha de rede ou de contrato não pode ser apresentada como lista vazia (TC14):
 * o erro tem precedência sobre a ausência de itens.
 */
export function estadoDaBusca(dados: unknown[] | null | undefined, erro: unknown): EstadoDaBusca {
  if (erro) return 'erro'
  if (!dados || dados.length === 0) return 'vazio'
  return 'resultados'
}
