import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { carregarSugestoesDeBusca, filtrarSugestoes, type SugestaoBusca } from './sugestoesBusca'

const fetchOriginal = globalThis.fetch
const gatewayOriginal = process.env.API_GATEWAY_URL

beforeEach(() => { process.env.API_GATEWAY_URL = 'http://gateway.local/api/v1' })
afterEach(() => {
  globalThis.fetch = fetchOriginal
  if (gatewayOriginal === undefined) delete process.env.API_GATEWAY_URL
  else process.env.API_GATEWAY_URL = gatewayOriginal
})

const termo = (texto: string): SugestaoBusca => ({ texto, href: `/search?q=${encodeURIComponent(texto)}`, perfilDeArtesao: false })
const perfil = (texto: string, detalhe: string, slug: string): SugestaoBusca => ({
  texto, detalhe, href: `/artisans/${slug}`, perfilDeArtesao: true,
})

test('sugere artesãos pelo nome do ateliê, sem acento e com várias palavras', () => {
  const todas = [termo('Jarra de Cerâmica'), perfil('Severina Ramos', 'Ateliê Barro Vivo', 'artesao-1'), perfil('João', 'Couraria', 'artesao-2')]

  assert.deepEqual(filtrarSugestoes(todas, 'atelie barro', 8).map((s) => s.href), ['/artisans/artesao-1'])
  assert.deepEqual(filtrarSugestoes(todas, 'SEVERINA vivo', 8).map((s) => s.href), ['/artisans/artesao-1'])
  assert.deepEqual(filtrarSugestoes(todas, 'jarras ceramica', 8).map((s) => s.texto), ['Jarra de Cerâmica'])
  assert.deepEqual(filtrarSugestoes(todas, 'inexistente', 8), [])
})

test('reserva espaço para perfis mesmo com muitos termos parecidos', () => {
  const termos = Array.from({ length: 10 }, (_, i) => termo(`Barro ${i}`))
  const perfis = Array.from({ length: 5 }, (_, i) => perfil(`Artesã ${i}`, `Ateliê Barro ${i}`, `artesao-${i}`))

  const visiveis = filtrarSugestoes([...termos, ...perfis], 'barro', 8)

  assert.equal(visiveis.length, 8)
  assert.equal(visiveis.filter((s) => s.perfilDeArtesao).length, 3)
  assert.equal(visiveis.filter((s) => !s.perfilDeArtesao).length, 5)
})

test('carrega o ateliê como detalhe das sugestões de artesão', async () => {
  globalThis.fetch = (async (entrada: string | URL | Request) => {
    const url = String(entrada)
    const corpo = url.includes('/artesaos')
      ? { dados: [{ slug: 'artesao-1', nome: 'Severina Ramos', atelie: 'Ateliê Barro Vivo' }], erro: null }
      : url.includes('/referencias')
        ? { dados: { tipos: ['Jarras & Vasos'], tecnicas: [], territorios: ['Tracunhaém'], categorias: [] }, erro: null }
        : { dados: [{ nome: 'Jarra de Cerâmica' }], erro: null }
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  const sugestoes = await carregarSugestoesDeBusca()

  assert.deepEqual(sugestoes.find((s) => s.perfilDeArtesao), {
    texto: 'Severina Ramos', detalhe: 'Ateliê Barro Vivo', href: '/artisans/artesao-1', perfilDeArtesao: true,
  })
  assert.deepEqual(filtrarSugestoes(sugestoes, 'tracunhaem', 8).map((s) => s.texto), ['Tracunhaém'])
})
