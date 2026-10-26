import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSourceLineage, buildClaimVerificationMatrix, manageTopicWatchProfiles } from '../src/advanced.js'

const results = [
  { source: 'GitHub', title: 'Official agent memory implementation', summary: 'Repository with implementation docs', url: 'https://github.com/example/agent-memory', publishedAt: '2026-10-20T00:00:00.000Z' },
  { source: 'Reddit', title: 'Official agent memory implementation', summary: 'Community discussion about the repository', url: 'https://reddit.com/r/example/post1', publishedAt: '2026-10-21T00:00:00.000Z' },
  { source: 'Hacker News', title: 'A completely unrelated discussion', summary: 'Other topic', url: 'https://news.ycombinator.com/item?id=123' },
]

test('source lineage groups near duplicate titles and exposes likely primary candidates', () => {
  const output = analyzeSourceLineage({ results })
  assert.equal(output.resultCount, 3)
  assert.equal(output.likelyDuplicateClusters, 1)
  const duplicate = output.clusters.find(cluster => cluster.duplicateLikely)
  assert.equal(duplicate.itemCount, 2)
  assert.ok(duplicate.primaryCandidates.some(item => item.host === 'github.com'))
})

test('source lineage rejects non-HTTPS and oversized input', () => {
  assert.equal(analyzeSourceLineage({ results: [{ title: 'bad', url: 'http://example.com' }] }).resultCount, 0)
  assert.throws(() => analyzeSourceLineage({ results: Array.from({ length: 201 }, () => results[0]) }), /at most 200/)
})

test('claim matrix summarizes explicitly classified evidence without browsing claims', () => {
  const output = buildClaimVerificationMatrix({ claims: [
    { id: 'c1', claim: 'Library A is faster', evidence: [
      { relation: 'supports', url: 'https://example.com/bench-a', title: 'Benchmark A', excerpt: 'A was faster', independenceGroup: 'lab-a' },
      { relation: 'contradicts', url: 'https://example.org/bench-b', title: 'Benchmark B', excerpt: 'B was faster', independenceGroup: 'lab-b' },
    ] },
    { claim: 'A second claim without evidence', evidence: [] },
  ] })
  assert.equal(output.claims[0].status, 'mixed')
  assert.equal(output.claims[0].independentEvidenceGroups, 2)
  assert.equal(output.claims[1].status, 'insufficient_evidence')
  assert.equal(output.summary.mixed, 1)
})

test('claim matrix validates claim text and evidence URLs', () => {
  assert.throws(() => buildClaimVerificationMatrix({ claims: [''] }), /must contain text/)
  assert.throws(() => buildClaimVerificationMatrix({ claims: [{ claim: 'Claim', evidence: [{ relation: 'supports', url: 'http://bad.example' }] }] }), /https URL/)
})

test('topic watch profiles support create, update, record, list, and delete with caller-managed persistence', () => {
  const created = manageTopicWatchProfiles({ action: 'create', profiles: [], id: 'agent-memory', profile: { name: 'Agent memory watch', query: 'agent memory' } })
  assert.equal(created.profile.id, 'agent-memory')
  assert.equal(created.profile.intervalHours, 24)
  const updated = manageTopicWatchProfiles({ action: 'update', profiles: created.profiles, id: 'agent-memory', profile: { intervalHours: 12 } })
  assert.equal(updated.profile.intervalHours, 12)
  const recorded = manageTopicWatchProfiles({ action: 'record_run', profiles: updated.profiles, id: 'agent-memory', snapshot: { results } })
  assert.equal(recorded.profile.lastSnapshot.results.length, 3)
  assert.ok(recorded.profile.lastRunAt)
  assert.equal(manageTopicWatchProfiles({ action: 'list', profiles: recorded.profiles }).profileCount, 1)
  const deleted = manageTopicWatchProfiles({ action: 'delete', profiles: recorded.profiles, id: 'agent-memory' })
  assert.equal(deleted.profileCount, 0)
})

test('topic watch profiles reject duplicate ids, invalid cadence, and missing profiles', () => {
  const profile = { id: 'x', name: 'X', query: 'topic' }
  assert.throws(() => manageTopicWatchProfiles({ action: 'list', profiles: [profile, profile] }), /unique/)
  assert.throws(() => manageTopicWatchProfiles({ action: 'create', profiles: [], id: 'x', profile: { name: 'X', query: 'topic', intervalHours: 0 } }), /intervalHours/)
  assert.throws(() => manageTopicWatchProfiles({ action: 'delete', profiles: [], id: 'missing' }), /not found/)
})
