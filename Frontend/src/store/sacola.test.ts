import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  LIMITE_PECAS_DISTINTAS, MENSAGEM_LIMITE_PECAS, gravarChaveLocal, incluirItem, lerChaveLocal, mesclar, recortarRevalidacao,
  semItens, validar, type ItemSacola,
} from './sacola'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('descarta entradas locais inválidas e limita quantidade por slug', () => {
  assert.deepEqual(validar([
    { slug: 'peca-a', quantidade: 2 }, { slug: 'peca-a', quantidade: 2 },
    { slug: 'peca-b', quantidade: 0 }, { slug: '../invalido', quantidade: 1 },
  ]), [{ slug: 'peca-a', quantidade: 3 }])
})

test('mescla sacolas pelo catálogo, limita peça única e propaga conflito', async () => {
  globalThis.fetch = async (entrada) => {
    const slug = String(entrada).split('/').at(-1)
    if (slug === 'indisponivel') return Response.json({ dados: null, erro: { mensagem: 'Peça indisponível.' } }, { status: 404 })
    return Response.json({ dados: { slug, disponibilidade: slug === 'peca-unica' ? 'unica' : 'disponivel' }, erro: null })
  }
  assert.deepEqual(await mesclar(
    [{ slug: 'peca-unica', quantidade: 1 }, { slug: 'peca-comum', quantidade: 2 }],
    [{ slug: 'peca-unica', quantidade: 1 }, { slug: 'peca-comum', quantidade: 2 }, { slug: '../invalido', quantidade: 1 }],
  ), [{ slug: 'peca-unica', quantidade: 1 }, { slug: 'peca-comum', quantidade: 3 }])
  await assert.rejects(mesclar([], [{ slug: 'indisponivel', quantidade: 1 }]), /Peça indisponível/)
})

const pecasDistintas = (total: number): ItemSacola[] =>
  Array.from({ length: total }, (_, indice) => ({ slug: `peca-${indice + 1}`, quantidade: 1 }))

test('recusa a 21ª peça diferente, mas aceita mais unidades de uma peça já na sacola', () => {
  const cheia = pecasDistintas(LIMITE_PECAS_DISTINTAS)
  const recusada = incluirItem(cheia, 'peca-nova')
  assert.equal(recusada.resultado, 'limite')
  assert.equal(recusada.itens, cheia)
  const repetida = incluirItem(cheia, 'peca-1')
  assert.equal(repetida.resultado, 'adicionada')
  assert.equal(repetida.itens.length, LIMITE_PECAS_DISTINTAS)
  assert.equal(repetida.itens[0].quantidade, 2)
  assert.equal(incluirItem([{ slug: 'peca-unica', quantidade: 1 }], 'peca-unica', true).resultado, 'ja-esta')
  assert.deepEqual(incluirItem([], 'peca-a'), { itens: [{ slug: 'peca-a', quantidade: 1 }], resultado: 'adicionada' })
})

test('mesclar recusa juntar mais de 20 peças diferentes antes de consultar o catálogo', async () => {
  let consultas = 0
  globalThis.fetch = async () => { consultas++; return Response.json({ dados: null, erro: null }) }
  await assert.rejects(mesclar(pecasDistintas(15), pecasDistintas(21).slice(15)), (falha: Error) => falha.message === MENSAGEM_LIMITE_PECAS)
  assert.equal(consultas, 0)
})

test('retira da sacola só as peças do ateliê pago', () => {
  const itens = [{ slug: 'vaso', quantidade: 1 }, { slug: 'renda', quantidade: 2 }, { slug: 'cesto', quantidade: 1 }]
  assert.deepEqual(semItens(itens, ['vaso', 'cesto']), [{ slug: 'renda', quantidade: 2 }])
  assert.deepEqual(semItens(itens, []), itens)
})

test('recorta a revalidação para o ateliê escolhido sem herdar indisponibilidade de outro', () => {
  const dados = { revalidadoEm: '2026-11-23T00:00:00Z', podeProsseguir: false, itens: [
    { slug: 'vaso', quantidade: 1, precoAtual: 100, disponibilidade: 'disponivel' as const, situacao: 'disponivel' as const },
    { slug: 'renda', quantidade: 1, precoAtual: null, disponibilidade: 'indisponivel' as const, situacao: 'indisponivel' as const },
  ] }
  const doVaso = recortarRevalidacao(dados, ['vaso'])
  assert.deepEqual(doVaso.itens.map((item) => item.slug), ['vaso'])
  assert.equal(doVaso.podeProsseguir, true)
  assert.equal(recortarRevalidacao(dados, ['renda']).podeProsseguir, false)
  assert.equal(recortarRevalidacao(dados, []).podeProsseguir, false)
  assert.equal(recortarRevalidacao(dados), dados)
})

test('falhas de leitura e escrita do armazenamento são retornadas sem exceção', () => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('bloqueado') },
    setItem: () => { throw new Error('quota') },
    removeItem: () => { throw new Error('bloqueado') },
  } })
  try {
    assert.deepEqual(lerChaveLocal('teste'), { valor: null, falhou: true })
    assert.equal(gravarChaveLocal('teste', 'valor'), false)
    assert.equal(gravarChaveLocal('teste', null), false)
  } finally {
    if (anterior) Object.defineProperty(globalThis, 'localStorage', anterior)
    else delete (globalThis as { localStorage?: Storage }).localStorage
  }
})
