const HOSTS_CHECKOUT_MERCADO_PAGO = new Set([
  'sandbox.mercadopago.com',
  'sandbox.mercadopago.com.br',
  'www.mercadopago.com',
  'www.mercadopago.com.br',
])

export function linkDePagamentoConfiavel(endereco: string): URL | null {
  let destino: URL
  try { destino = new URL(endereco) }
  catch { return null }
  if (destino.protocol !== 'https:' || destino.username || destino.password) return null
  return HOSTS_CHECKOUT_MERCADO_PAGO.has(destino.hostname) ? destino : null
}

export async function abrirPagamentoAposLimpeza(
  limpar: () => Promise<{ ok: boolean; mensagem?: string }>,
  destino: string,
  navegar: (url: string) => void,
): Promise<{ ok: boolean; mensagem?: string }> {
  const resultado = await limpar()
  if (resultado.ok) navegar(destino)
  return resultado
}
