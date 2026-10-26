import { defineTool } from '@deepseek-ai/dsh-tools'
import { researchTopic } from './research.js'
import { compareResearchSnapshots, rankResearchResults, trackEvidence } from './features.js'

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
    name: 'research_recent_sources',
    title: 'Recent source research',
    description: 'Search public Hacker News, Reddit, and GitHub results within a recent time window for a topic. Returns source URLs, publication timestamps, source-specific engagement values, partial-source errors, and limitations. Use as a discovery pass; open primary sources and distinguish evidence from interpretation. Do not treat search snippets or engagement as proof.',
    parameters: {
      query: { type: 'string', required: true, description: 'Specific topic or phrase to research (2–240 characters).' },
      days: { type: 'number', description: 'Lookback window in days, integer 1–90. Defaults to 30.' },
      sources: { type: 'array', items: { type: 'string', enum: ['hacker_news', 'reddit', 'github'] }, description: 'Unique subset of public sources to query. Defaults to all three.' },
      limit: { type: 'number', description: 'Maximum results per source, integer 1–20. Defaults to 10.' },
    },
    execute: (args, exec) => researchTopic(args, exec.signal),
  })
  register(ctx, {
    name: 'track_research_evidence',
    title: 'Track research evidence',
    description: 'Track candidate source links for user-supplied claims against research results. Uses lexical matching only; it does not decide whether a claim is true or whether a source supports or contradicts it.',
    parameters: {
      claims: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Claims to track; each item can contain text, optional id, and optional evidenceUrls.' },
      results: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Result objects from research_recent_sources.' },
    },
    execute: args => trackEvidence(args),
  })
  register(ctx, {
    name: 'rank_research_sources',
    title: 'Rank research sources',
    description: 'Rank results using transparent heuristic signals for likely primary sources, freshness, query overlap, and secondary engagement. Scores are not truth or validated credibility scores.',
    parameters: {
      query: { type: 'string', description: 'Topic/query used to estimate lexical relevance.' },
      results: { type: 'array', required: true, items: { type: 'object', additionalProperties: true }, description: 'Result objects from research_recent_sources.' },
    },
    execute: args => rankResearchResults(args),
  })
  register(ctx, {
    name: 'compare_research_snapshots',
    title: 'Compare research snapshots',
    description: 'Compare previous and current research result snapshots, reporting added, removed-from-results, and changed items. The caller must persist and supply snapshots; this tool does not schedule recurring checks or store state.',
    parameters: {
      previous: { type: 'object', required: true, additionalProperties: true, description: 'Previously saved snapshot containing a results array.' },
      current: { type: 'object', required: true, additionalProperties: true, description: 'New snapshot containing a results array.' },
    },
    execute: args => compareResearchSnapshots(args),
  })
}
