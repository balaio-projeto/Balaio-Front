import type { Ponto } from '@/types/dominio'

export type EnderecoParaMapa = {
  rua: string
  numero?: string
  bairro?: string
  cidade: string
  cep?: string
}

export type ResultadoGeocodificacao =
  | { situacao: 'encontrado'; ponto: Ponto; precisao: 'endereco' | 'rua' | 'cidade' }
  | { situacao: 'nao-encontrado' }
  | { situacao: 'erro' }

const ENDERECO_NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const PRAZO_MS = 8000
const LIMITES_PERNAMBUCO = { sul: -9.49, norte: -3.82, oeste: -41.36, leste: -32.38 }

function dentroDePernambuco({ lat, lng }: Ponto): boolean {
  const { sul, norte, oeste, leste } = LIMITES_PERNAMBUCO
  return lat >= sul && lat <= norte && lng >= oeste && lng <= leste
}

function numeroUtil(numero?: string): string {
  const limpo = numero?.trim() ?? ''
  return /^s\/?n$/i.test(limpo) ? '' : limpo
}

export function consultasDoEndereco(endereco: EnderecoParaMapa): { precisao: 'endereco' | 'rua' | 'cidade'; parametros: Record<string, string> }[] {
  const base = { city: endereco.cidade.trim(), state: 'Pernambuco', country: 'Brasil' }
  const rua = endereco.rua.trim()
  const numero = numeroUtil(endereco.numero)
  const consultas: { precisao: 'endereco' | 'rua' | 'cidade'; parametros: Record<string, string> }[] = []
  if (rua && numero) consultas.push({ precisao: 'endereco', parametros: { ...base, street: `${numero} ${rua}` } })
  if (rua) consultas.push({ precisao: 'rua', parametros: { ...base, street: rua } })
  if (rua && endereco.bairro?.trim()) {
    consultas.push({ precisao: 'rua', parametros: { q: `${rua}, ${endereco.bairro.trim()}, ${base.city}, Pernambuco, Brasil` } })
  }
  consultas.push({ precisao: 'cidade', parametros: base })
  return consultas
}

function lerPonto(corpo: unknown): Ponto | null {
  if (!Array.isArray(corpo) || corpo.length === 0) return null
  const primeiro = corpo[0] as { lat?: unknown; lon?: unknown }
  const lat = Number(primeiro.lat)
  const lng = Number(primeiro.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const ponto = { lat, lng }
  return dentroDePernambuco(ponto) ? ponto : null
}

export async function geocodificarEndereco(
  endereco: EnderecoParaMapa,
  opcoes: { buscar?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ResultadoGeocodificacao> {
  if (!endereco.cidade.trim()) return { situacao: 'nao-encontrado' }
  const buscar = opcoes.buscar ?? fetch
  let falhou = false
  for (const consulta of consultasDoEndereco(endereco)) {
    const parametros = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br', 'accept-language': 'pt-BR', ...consulta.parametros })
    try {
      const resposta = await buscar(`${ENDERECO_NOMINATIM}?${parametros}`, {
        headers: { Accept: 'application/json' },
        signal: opcoes.signal ?? AbortSignal.timeout(PRAZO_MS),
      })
      if (!resposta.ok) {
        falhou = true
        continue
      }
      const ponto = lerPonto(await resposta.json().catch(() => null))
      if (ponto) return { situacao: 'encontrado', ponto, precisao: consulta.precisao }
    } catch {
      falhou = true
    }
  }
  return falhou ? { situacao: 'erro' } : { situacao: 'nao-encontrado' }
}
