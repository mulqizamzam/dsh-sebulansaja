import test from 'node:test'
import assert from 'node:assert/strict'
import { compareResearchSnapshots, rankResearchResults, trackEvidence } from '../src/features.js'

const results = [
  { source: 'GitHub', title: 'Official agent memory implementation', summary: 'Repository with implementation docs', url: 'https://github.com/example/agent-memory', publishedAt: new Date().toISOString(), engagement: 12 },
  { source: 'Reddit', title: 'Discussion about agent memory', summary: 'Community opinions about memory tools', url: 'https://www.reddit.com/r/example/post1', publishedAt: new Date().toISOString(), engagement: 400 },
]
test('ranks results with explainable quality fields', () => {
  const output = rankResearchResults({ query: 'agent memory', results })
  assert.equal(output.resultCount, 2)
  assert.equal(output.results[0].rank, 1)
  assert.ok(output.results.every(item => item.quality && Array.isArray(item.quality.reasons)))
  assert.equal(output.rankingMethod, 'heuristic-v1')
})
test('evidence tracker returns candidates without asserting truth', () => {
  const output = trackEvidence({ claims: ['Official agent memory implementation exists', 'Quantum batteries are commercially available'], results })
  assert.equal(output.claimCount, 2)
  assert.equal(output.claims[0].status, 'evidence_found_review_required')
  assert.equal(output.claims[1].status, 'no_matching_evidence_found')
  assert.match(output.limitations.join(' '), /verdict/i)
})
test('evidence tracker can restrict candidates to supplied URLs', () => {
  const output = trackEvidence({ claims: [{ text: 'agent memory', evidenceUrls: ['https://github.com/example/agent-memory'] }], results })
  assert.equal(output.claims[0].evidence.length, 1)
  assert.equal(output.claims[0].evidence[0].source, 'GitHub')
})
test('snapshot comparison detects added, removed and changed URLs', () => {
  const previous = { results: [results[0], { ...results[1], url: 'https://reddit.com/old' }] }
  const current = { results: [{ ...results[0], engagement: 15 }, results[1], { title: 'New item', url: 'https://example.com/new', publishedAt: new Date().toISOString() }] }
  const output = compareResearchSnapshots({ previous, current })
  assert.equal(output.addedCount, 1)
  assert.equal(output.removedCount, 1)
  assert.equal(output.changedCount, 1)
  assert.deepEqual(output.changed[0].changedFields, ['engagement'])
})
test('feature functions reject malformed input', () => {
  assert.throws(() => rankResearchResults({ results: 'nope' }), /results must/)
  assert.throws(() => trackEvidence({ claims: [], results: 'nope' }), /claims and results/)
  assert.throws(() => compareResearchSnapshots({ previous: {}, current: {} }), /previous.results/)
})
