import { defineTool } from '@deepseek-ai/dsh-tools'
import { researchTopic } from './research.js'
import { compareResearchSnapshots, rankResearchResults, trackEvidence } from './features.js'
import { analyzeSourceLineage, buildClaimVerificationMatrix, manageTopicWatchProfiles } from './advanced.js'

export const name = 'sebulansaja-research-tool'
export const inject = ['tools']

function register(ctx, { name, description, parameters, execute, title }) {
  ctx.tools.register(defineTool({
    name, description, parameters,
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) { exec?.signal?.throwIfAborted(); return execute(args, exec) },
    presentCall: args => ({ card: 'generic', title, rawInput: args }),
  }))
}

export function apply(ctx) {
  register(ctx, {
    name: 'research_recent_sources', title: 'Recent source research',
    description: 'Search public Hacker News, Reddit, and GitHub results within a recent time window for a topic. Returns source URLs, publication timestamps, source-specific engagement values, partial-source errors, and limitations. Treat results as discovery leads, not proof.',
    parameters: {
      query: { type: 'string', required: true, description: 'Specific topic or phrase to research (2–240 characters).' },
      days: { type: 'number', description: 'Lookback window in days, integer 1–90. Defaults to 30.' },
      sources: { type: 'array', items: { type: 'string', enum: ['hacker_news', 'reddit', 'github'] }, description: 'Unique subset of public sources. Defaults to all three.' },
      limit: { type: 'number', description: 'Maximum results per source, integer 1–20. Defaults to 10.' },
    },
    execute: (args, exec) => researchTopic(args, exec.signal),
  })
  register(ctx, {
    name: 'track_research_evidence', title: 'Track research evidence',
    description: 'Find candidate source links for claims using lexical overlap. Does not decide whether claims are true or sources support/contradict them.',
    parameters: {
      claims: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Claims with text, optional id, and optional evidenceUrls.' },
      results: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Result objects from research_recent_sources.' },
    },
    execute: args => trackEvidence(args),
  })
  register(ctx, {
    name: 'rank_research_sources', title: 'Rank research sources',
    description: 'Rank results using heuristics for likely primary sources, freshness, query overlap, and secondary engagement. Scores are not proof or validated credibility metrics.',
    parameters: {
      query: { type: 'string', description: 'Topic/query used to estimate lexical relevance.' },
      results: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Result objects from research_recent_sources.' },
    },
    execute: args => rankResearchResults(args),
  })
  register(ctx, {
    name: 'compare_research_snapshots', title: 'Compare research snapshots',
    description: 'Compare prior and current result snapshots. The caller must persist and supply snapshots; this tool does not schedule recurring checks.',
    parameters: {
      previous: { type: 'object', required: true, additionalProperties: true, description: 'Previously saved snapshot containing results.' },
      current: { type: 'object', required: true, additionalProperties: true, description: 'New snapshot containing results.' },
    },
    execute: args => compareResearchSnapshots(args),
  })
  register(ctx, {
    name: 'analyze_source_lineage', title: 'Analyze source lineage',
    description: 'Cluster canonical duplicate URLs and near-duplicate titles, show likely primary-source candidates, and warn against counting repeated coverage as independent evidence. Uses heuristics, not full-text provenance analysis.',
    parameters: {
      results: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Research result objects containing title, URL, source, and optional summary/date.' },
    },
    execute: args => analyzeSourceLineage(args),
  })
  register(ctx, {
    name: 'build_claim_verification_matrix', title: 'Build claim verification matrix',
    description: 'Summarize claims and manually reviewed evidence relations (supports, contradicts, mixed, unclear) into a transparent verification matrix. Evidence relations must be supplied by the caller after reviewing source content; this tool does not browse or verify URLs.',
    parameters: {
      claims: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Claims with claim/text and optional evidence array; each evidence item requires an HTTPS URL and relation.' },
    },
    execute: args => buildClaimVerificationMatrix(args),
  })
  register(ctx, {
    name: 'manage_topic_watch_profiles', title: 'Manage topic watch profiles',
    description: 'Create, update, list, delete, and record runs for reusable topic-watch profile objects. Returns the updated profiles array; the caller must persist it between calls. It does not schedule jobs itself.',
    parameters: {
      action: { type: 'string', required: true, enum: ['list', 'create', 'update', 'delete', 'record_run'], description: 'Operation to perform.' },
      profiles: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Current saved profiles array; pass back the previous call output to continue.' },
      id: { type: 'string', description: 'Profile id for update/delete/record_run or create.' },
      profile: { type: 'object', additionalProperties: true, description: 'Profile fields: id, name, query, days, limit, sources, intervalHours, enabled.' },
      snapshot: { type: 'object', additionalProperties: true, description: 'Snapshot with results array for record_run.' },
      runAt: { type: 'string', description: 'Optional ISO timestamp for record_run.' },
    },
    execute: args => manageTopicWatchProfiles(args),
  })
}
