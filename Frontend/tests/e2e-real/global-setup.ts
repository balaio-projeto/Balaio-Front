import { URL_FRONT, URL_GATEWAY } from './apoio/pilha'
import { prepararDados } from './dados/preparar-dados'

async function exigirSaudavel(url: string, nome: string) {
  const resposta = await fetch(url).catch(() => null)
  if (!resposta?.ok) throw new Error(`${nome} indisponível em ${url}. Suba a pilha com platform/scripts/start-local.ps1.`)
}

export default async function globalSetup() {
  await exigirSaudavel(`${URL_GATEWAY}/actuator/health`, 'api-gateway')
  await exigirSaudavel(`${URL_FRONT}/healthz`, 'frontend')
  await prepararDados()
}
