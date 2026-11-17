const GATEWAY_LOCAL = 'http://127.0.0.1:8080/api/v1'

export function urlDoGateway(): string {
  const configurada = process.env.API_GATEWAY_URL?.trim()
  return (configurada || GATEWAY_LOCAL).replace(/\/$/, '')
}
