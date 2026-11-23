import assert from 'node:assert/strict'
import { test } from 'node:test'
import { destinoInicial, destinoSeguro, type Sessao } from './cookie'

// TC07 (TS02): após o login, o visitante volta ao destino interno que pediu.
test('destino interno é preservado para retorno após login', () => {
  assert.equal(destinoSeguro('/checkout'), '/checkout')
  assert.equal(destinoSeguro('/pieces/vaso-do-sertao'), '/pieces/vaso-do-sertao')
  assert.equal(destinoSeguro('/search?tipo=Cer%C3%A2mica'), '/search?tipo=Cer%C3%A2mica')
})

// TC08 (TS02): destino externo forjado é descartado.
test('destino externo ou ambíguo é descartado', () => {
  for (const forjado of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)',
    '/%2f%2fevil.example', '/%5cevil.example', ' /checkout', '/checkout\n']) {
    assert.equal(destinoSeguro(forjado), undefined, forjado)
  }
  assert.equal(destinoSeguro(undefined), undefined)
  assert.equal(destinoSeguro(42), undefined)
})

test('destino inicial depende do papel da sessão', () => {
  const comprador = destinoInicial({ papel: 'comprador' } as Sessao)
  const artesao = destinoInicial({ papel: 'artesao' } as Sessao)
  assert.ok(comprador.startsWith('/'))
  assert.ok(artesao.startsWith('/'))
  assert.notEqual(comprador, artesao)
})
