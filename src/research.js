const DAY_MS = 86_400_000
const MAX_QUERY_LENGTH = 240
const MAX_RESULTS_PER_SOURCE = 20
const FETCH_TIMEOUT_MS = 8_000

function cleanText(value, limit = 1200) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, limit)
}

function withinWindow(timestamp, cutoff) {
  const parsed = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
  return Number.isFinite(parsed) && parsed >= cutoff && parsed <= Date.now() + 5 * 60_000
}

function makeResult({ source, title, url, date, score, summary }) {
  if (!url || !/^https:\/\//i.test(url)) return null
  return { source, title: cleanText(title, 240) || '(untitled result)', url, publishedAt: new Date(date).toISOString(), engagement: Number.isFinite(Number(score)) ? Number(score) : null, summary: cleanText(summary, 700) }
}

async function readBoundedText(response, maxBytes = 2_000_000) {
  if (!response.body) throw new Error('provider response had no body')
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) { await reader.cancel('response exceeded size limit'); throw new Error('response exceeded 2 MB limit') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder('utf-8', { fatal: true }).decode(merged)
}

async function fetchJson(url, signal) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('request timeout')), FETCH_TIMEOUT_MS)
  const abort = () => controller.abort(signal.reason)
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'dsh-sebulansaja/0.1.0 (public research tool)' }, signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > 2_000_000) throw new Error('response exceeded 2 MB limit')
    try { return JSON.parse(await readBoundedText(response)) } catch (error) {
      if (error instanceof SyntaxError) throw new Error('provider returned invalid JSON')
      throw error
    }
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
}

async function searchHackerNews(query, cutoff, limit, signal) {
  const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: String(limit), numericFilters: `created_at_i>${Math.floor(cutoff / 1000)}` })
  const data = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?${params}`, signal)
  return (data.hits ?? []).map(hit => makeResult({ source: 'Hacker News', title: hit.title, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, date: hit.created_at, score: hit.points, summary: hit.story_text || `${hit.num_comments ?? 0} comments` })).filter(Boolean)
}

async function searchReddit(query, cutoff, limit, signal) {
  const params = new URLSearchParams({ q: query, sort: 'new', t: 'year', limit: String(limit), type: 'link' })
  const data = await fetchJson(`https://www.reddit.com/search.json?${params}`, signal)
  return (data.data?.children ?? []).map(({ data: post }) => makeResult({ source: 'Reddit', title: post.title, url: post.permalink ? `https://www.reddit.com${post.permalink}` : post.url, date: Number(post.created_utc) * 1000, score: post.score, summary: post.selftext || `${post.subreddit_name_prefixed ?? 'r/unknown'} · ${post.num_comments ?? 0} comments` })).filter(item => item && withinWindow(item.publishedAt, cutoff))
}

async function searchGitHub(query, cutoff, limit, signal) {
  const q = `${query} pushed:>=${new Date(cutoff).toISOString().slice(0, 10)}`
  const params = new URLSearchParams({ q, sort: 'updated', order: 'desc', per_page: String(limit) })
  const data = await fetchJson(`https://api.github.com/search/repositories?${params}`, signal)
  return (data.items ?? []).map(repo => makeResult({ source: 'GitHub', title: repo.full_name, url: repo.html_url, date: repo.pushed_at, score: repo.stargazers_count, summary: repo.description || 'No repository description provided.' })).filter(Boolean)
}

export function validateResearchInput(input) {
  const query = cleanText(input?.query, MAX_QUERY_LENGTH)
  if (query.length < 2) throw new Error('query must contain at least 2 non-whitespace characters')
  const days = input?.days ?? 30
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('days must be an integer from 1 to 90')
  const limit = input?.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS_PER_SOURCE) throw new Error('limit must be an integer from 1 to 20')
  const allowed = new Set(['hacker_news', 'reddit', 'github'])
  const sources = input?.sources ?? ['hacker_news', 'reddit', 'github']
  if (!Array.isArray(sources) || sources.length < 1 || sources.some(source => !allowed.has(source)) || new Set(sources).size !== sources.length) throw new Error('sources must be a unique non-empty list drawn from hacker_news, reddit, github')
  return { query, days, limit, sources }
}

export async function researchTopic(input, signal) {
  const options = validateResearchInput(input)
  const cutoff = Date.now() - options.days * DAY_MS
  const providers = { hacker_news: () => searchHackerNews(options.query, cutoff, options.limit, signal), reddit: () => searchReddit(options.query, cutoff, options.limit, signal), github: () => searchGitHub(options.query, cutoff, options.limit, signal) }
  const settled = await Promise.all(options.sources.map(async source => {
    try { return { source, results: await providers[source]() } } catch (error) { return { source, results: [], error: cleanText(error?.message || error, 180) } }
  }))
  const results = settled.flatMap(row => row.results).filter(row => withinWindow(row.publishedAt, cutoff)).sort((a, b) => (Date.parse(b.publishedAt) - Date.parse(a.publishedAt)) || ((b.engagement ?? -1) - (a.engagement ?? -1)))
  const deduped = []
  const seen = new Set()
  for (const result of results) { const key = result.url.replace(/\/$/, '').toLowerCase(); if (!seen.has(key)) { seen.add(key); deduped.push(result) } }
  return {
    query: options.query,
    window: { days: options.days, since: new Date(cutoff).toISOString(), until: new Date().toISOString() },
    sources: settled.map(row => ({ source: row.source, status: row.error ? 'unavailable' : 'ok', resultCount: row.results.length, ...(row.error ? { error: row.error } : {}) })),
    resultCount: deduped.length, results: deduped,
    limitations: ['Search coverage depends on each provider’s public API, indexing, rate limits, and query semantics.', 'Engagement values are source-specific and are not comparable across platforms.', 'A result is a lead for review, not proof that its claims are true; open and verify the cited source.']
  }
}
