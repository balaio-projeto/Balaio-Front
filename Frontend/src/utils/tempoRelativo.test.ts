import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tempoRelativo } from './tempoRelativo'

const AGORA = new Date('2026-11-25T15:00:00Z')

test('descreve o tempo passado de forma curta', () => {
  assert.equal(tempoRelativo('2026-11-25T14:59:40Z', AGORA), 'agora')
  assert.equal(tempoRelativo('2026-11-25T14:45:00Z', AGORA), 'há 15 min')
  assert.equal(tempoRelativo('2026-11-25T12:00:00Z', AGORA), 'há 3 h')
  assert.equal(tempoRelativo('2026-11-24T12:00:00Z', AGORA), 'ontem')
  assert.equal(tempoRelativo('2026-11-21T12:00:00Z', AGORA), 'há 4 dias')
  assert.match(tempoRelativo('2026-10-02T12:00:00Z', AGORA), /^02 de out/)
  assert.equal(tempoRelativo('data invalida', AGORA), '')
})
