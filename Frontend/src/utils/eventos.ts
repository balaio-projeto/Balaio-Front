import type { Evento, Ponto } from '@/types/dominio'

export function coordenadasValidas(ponto: Partial<Ponto> | null | undefined): ponto is Ponto {
  if (!ponto) return false
  const { lat, lng } = ponto
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function pontoDeConsulta(posicao: Partial<Ponto> | null | undefined, padrao: Ponto): Ponto {
  return coordenadasValidas(posicao) ? { lat: posicao.lat, lng: posicao.lng } : padrao
}

export function distanciaKm(a: Ponto, b: Ponto): number {
  const raioTerraKm = 6371
  const emRad = (graus: number) => (graus * Math.PI) / 180
  const dLat = emRad(b.lat - a.lat)
  const dLng = emRad(b.lng - a.lng)
  const arco =
    Math.sin(dLat / 2) ** 2 + Math.cos(emRad(a.lat)) * Math.cos(emRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * raioTerraKm * Math.asin(Math.sqrt(arco))
}

export function distanciaLegivel(km: number): string {
  if (km < 1) return 'a menos de 1 km'
  return `a ${Math.round(km)} km`
}

export function resumoParticipantes(evento: Pick<Evento, 'artesaos' | 'coletivos'>): string {
  const partes: string[] = []
  if (evento.artesaos.length > 0) {
    partes.push(`${evento.artesaos.length} ${evento.artesaos.length === 1 ? 'artesão' : 'artesãos'}`)
  }
  if (evento.coletivos.length > 0) {
    partes.push(`${evento.coletivos.length} ${evento.coletivos.length === 1 ? 'coletivo' : 'coletivos'}`)
  }
  if (partes.length === 0) return 'Participantes a confirmar'
  return `${partes.join(' e ')} confirmados`
}
