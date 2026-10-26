import { defineTool } from '@deepseek-ai/dsh-tools'
import { researchTopic } from './research.js'

export const name = 'sebulansaja-research-tool'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'research_recent_sources',
    description: 'Search public Hacker News, Reddit, and GitHub results within a recent time window for a topic. Returns source URLs, publication timestamps, source-specific engagement values, partial-source errors, and limitations. Use as a discovery pass; open primary sources and distinguish evidence from interpretation. Do not treat search snippets or engagement as proof.',
    parameters: {
      query: { type: 'string', required: true, description: 'Specific topic or phrase to research (2–240 characters).' },
      days: { type: 'number', description: 'Lookback window in days, integer 1–90. Defaults to 30.' },
      sources: { type: 'array', items: { type: 'string', enum: ['hacker_news', 'reddit', 'github'] }, description: 'Unique subset of public sources to query. Defaults to all three.' },
      limit: { type: 'number', description: 'Maximum results per source, integer 1–20. Defaults to 10.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      return researchTopic(args, exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Recent source research', rawInput: args }),
  }))
}
