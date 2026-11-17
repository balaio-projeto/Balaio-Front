export async function abrirPagamentoAposLimpeza(
  limpar: () => Promise<{ ok: boolean; mensagem?: string }>,
  destino: string,
  navegar: (url: string) => void,
): Promise<{ ok: boolean; mensagem?: string }> {
  const resultado = await limpar()
  if (resultado.ok) navegar(destino)
  return resultado
}
