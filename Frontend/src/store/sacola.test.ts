import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { gravarChaveLocal, lerChaveLocal, mesclar, validar } from './sacola'

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
