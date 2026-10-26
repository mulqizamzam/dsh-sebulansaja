import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResearchInput } from '../src/research.js'

test('defaults to a 30-day search over all sources', () => {
  assert.deepEqual(validateResearchInput({ query: 'agent memory' }), { query: 'agent memory', days: 30, limit: 10, sources: ['hacker_news', 'reddit', 'github'] })
})

test('trims query and enforces window bounds', () => {
  assert.equal(validateResearchInput({ query: '  DSH  ', days: 7 }).query, 'DSH')
  assert.throws(() => validateResearchInput({ query: 'DSH', days: 0 }), /days must/)
  assert.throws(() => validateResearchInput({ query: 'DSH', days: 91 }), /days must/)
})

test('rejects empty queries and invalid result counts', () => {
  assert.throws(() => validateResearchInput({ query: ' ' }), /query must/)
  assert.throws(() => validateResearchInput({ query: 'DSH', limit: 0 }), /limit must/)
  assert.throws(() => validateResearchInput({ query: 'DSH', limit: 21 }), /limit must/)
})

test('rejects unknown, empty, or duplicate source lists', () => {
  assert.throws(() => validateResearchInput({ query: 'DSH', sources: [] }), /sources must/)
  assert.throws(() => validateResearchInput({ query: 'DSH', sources: ['reddit', 'reddit'] }), /sources must/)
  assert.throws(() => validateResearchInput({ query: 'DSH', sources: ['x'] }), /sources must/)
})

test('truncates excessively long query text to safe limit', () => {
  assert.equal(validateResearchInput({ query: 'a'.repeat(400) }).query.length, 240)
})
