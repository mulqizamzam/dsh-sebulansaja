const MAX_RESULTS = 200
const STOP_WORDS = new Set(['about','after','also','been','from','have','into','more','most','that','their','there','these','they','this','through','under','using','what','when','where','which','with','will','would','your','the','and','for','are','was','were','has','had','not','but','can','could','should','than','then','its','our','out','new'])

function text(value, max = 1200) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}
function tokens(value) {
  return new Set((text(value, 3000).toLowerCase().match(/[a-z0-9][a-z0-9+.#_-]{1,}/g) ?? []).filter(token => !STOP_WORDS.has(token)))
}
function overlap(a, b) {
  const left = tokens(a), right = tokens(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / Math.max(1, Math.min(left.size, right.size))
}
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null } catch { return null }
}
function canonicalUrl(value) {
  const safe = safeUrl(value)
  if (!safe) return ''
  const url = new URL(safe)
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key)
  return url.toString().replace(/\/$/, '').toLowerCase()
}
function sourceSignals(result) {
  const url = safeUrl(result?.url)
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : ''
  const source = text(result?.source, 60).toLowerCase()
  let score = 0
  const reasons = []
  const primaryHosts = /(^|\.)(github\.com|gitlab\.com|arxiv\.org|doi\.org|acm\.org|ieee\.org|nist\.gov|docs\.[a-z0-9.-]+|developer\.[a-z0-9.-]+|learn\.[a-z0-9.-]+)$/
  if (primaryHosts.test(host) || /official|documentation|paper|journal/i.test(text(result?.title) + ' ' + text(result?.summary))) { score += 30; reasons.push('indikasi sumber primer atau dokumentasi resmi') }
  if (/github\.com|gitlab\.com/.test(host) || source === 'github') { score += 15; reasons.push('tautan ke repositori/proyek asli') }
  if (/reddit|news\.ycombinator|hacker.?news/.test(host) || /reddit|hacker news/.test(source)) { score -= 5; reasons.push('diskusi komunitas: petunjuk, bukan verifikasi final') }
  const published = Date.parse(result?.publishedAt ?? result?.date ?? '')
  if (Number.isFinite(published)) {
    const ageDays = Math.max(0, (Date.now() - published) / 86_400_000)
    score += Math.max(0, 20 - Math.min(20, ageDays / 3))
    reasons.push(ageDays <= 7 ? 'sangat baru (≤7 hari)' : ageDays <= 30 ? 'relatif baru (≤30 hari)' : 'sinyal kebaruan rendah')
  } else reasons.push('tanggal publikasi tidak tersedia/valid')
  const engagement = Number(result?.engagement)
  if (Number.isFinite(engagement) && engagement > 0) { score += Math.min(10, Math.log10(engagement + 1) * 3); reasons.push('engagement hanya sinyal sekunder') }
  const scoreOut = Math.round(Math.max(0, Math.min(100, score)))
  return { score: scoreOut, tier: scoreOut >= 55 ? 'high' : scoreOut >= 30 ? 'medium' : 'low', reasons, host: host || null }
}
export function rankResearchResults(input) {
  if (!Array.isArray(input?.results)) throw new Error('results must be an array')
  if (input.results.length > MAX_RESULTS) throw new Error(`results must contain at most ${MAX_RESULTS} items`)
  const query = text(input.query, 240)
  const ranked = input.results.map((item, index) => {
    const result = { ...item, title: text(item?.title, 240), summary: text(item?.summary, 700), url: safeUrl(item?.url) }
    const signals = sourceSignals(result)
    const relevance = query ? overlap(query, result.title + ' ' + result.summary) : 0.5
    const score = Math.round(Math.min(100, signals.score * 0.75 + relevance * 25))
    return { ...result, quality: { score, tier: score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low', relevance: Math.round(relevance * 100), host: signals.host, reasons: [...signals.reasons, query ? `kecocokan leksikal dengan query: ${Math.round(relevance * 100)}%` : 'query tidak diberikan; relevansi tidak dinilai'] }, _index: index }
  }).filter(item => item.url)
  ranked.sort((a, b) => b.quality.score - a.quality.score || (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0) || a._index - b._index)
  return { query: query || null, rankingMethod: 'heuristic-v1', resultCount: ranked.length, results: ranked.map(({ _index, ...item }, rank) => ({ ...item, rank: rank + 1 })), limitations: ['Skor adalah heuristik transparan, bukan kredibilitas tervalidasi.', 'Domain resmi/repository tidak otomatis membuktikan klaim.', 'Engagement hanya sinyal sekunder dan tidak dibandingkan lintas platform.'] }
}
export function trackEvidence(input) {
  if (!Array.isArray(input?.claims) || !Array.isArray(input?.results)) throw new Error('claims and results must both be arrays')
  if (input.claims.length > 100 || input.results.length > MAX_RESULTS) throw new Error('claims must contain at most 100 items and results at most 200 items')
  const claims = input.claims.map((claim, index) => {
    const item = typeof claim === 'string' ? { text: claim } : claim
    const claimText = text(item?.text ?? item?.claim, 500)
    if (!claimText) throw new Error(`claim at index ${index} must contain text`)
    const evidence = input.results.map(result => {
      const url = safeUrl(result?.url)
      if (!url) return null
      const match = overlap(claimText, text(result?.title) + ' ' + text(result?.summary))
      if (match < 0.2) return null
      return { title: text(result?.title, 240) || '(untitled)', url, source: text(result?.source, 60) || 'unknown', publishedAt: result?.publishedAt ?? null, lexicalMatch: Math.round(match * 100), relation: 'related_candidate' }
    }).filter(Boolean).sort((a, b) => b.lexicalMatch - a.lexicalMatch)
    const supplied = Array.isArray(item?.evidenceUrls) ? new Set(item.evidenceUrls.map(canonicalUrl).filter(Boolean)) : null
    const selected = supplied ? evidence.filter(row => supplied.has(canonicalUrl(row.url))) : evidence
    return { id: text(item?.id, 80) || `claim-${index + 1}`, claim: claimText, status: selected.length ? 'evidence_found_review_required' : 'no_matching_evidence_found', evidence: selected.slice(0, 20), evidenceCount: selected.length, note: selected.length ? 'Kandidat bukti dipilih lewat kemiripan kata; periksa konteks dan sumber asli.' : 'Tidak ditemukan kecocokan leksikal; ini bukan bukti bahwa klaim salah.' }
  })
  return { claimCount: claims.length, claims, limitations: ['Relasi bukti tidak diklasifikasikan otomatis sebagai mendukung/menyangkal.', 'Kemiripan kata dapat melewatkan sinonim atau mencocokkan konteks yang keliru.', 'Status ini melacak kandidat bukti, bukan verdict kebenaran.'] }
}
export function compareResearchSnapshots(input) {
  if (!Array.isArray(input?.previous?.results) || !Array.isArray(input?.current?.results)) throw new Error('previous.results and current.results must both be arrays')
  for (const [name, snapshot] of [['previous', input.previous], ['current', input.current]]) if (snapshot.results.length > MAX_RESULTS) throw new Error(`${name}.results must contain at most 200 items`)
  const indexByUrl = list => new Map(list.map(item => [canonicalUrl(item?.url), item]).filter(([url]) => url))
  const previous = indexByUrl(input.previous.results), current = indexByUrl(input.current.results)
  const added = [], removed = [], changed = []
  for (const [url, item] of current) {
    if (!previous.has(url)) { added.push(item); continue }
    const old = previous.get(url), fields = ['title', 'summary', 'publishedAt', 'engagement']
    const differences = fields.filter(field => String(old?.[field] ?? '') !== String(item?.[field] ?? ''))
    if (differences.length) changed.push({ url: safeUrl(item.url), title: text(item.title, 240), changedFields: differences, previous: Object.fromEntries(differences.map(field => [field, old?.[field] ?? null])), current: Object.fromEntries(differences.map(field => [field, item?.[field] ?? null])) })
  }
  for (const [url, item] of previous) if (!current.has(url)) removed.push(item)
  const byDate = (a, b) => (Date.parse(b?.publishedAt ?? '') || 0) - (Date.parse(a?.publishedAt ?? '') || 0)
  added.sort(byDate); removed.sort(byDate); changed.sort((a, b) => a.title.localeCompare(b.title))
  return { previousCount: previous.size, currentCount: current.size, addedCount: added.length, removedCount: removed.length, changedCount: changed.length, added, removed, changed, snapshotNote: 'Snapshot tidak disimpan oleh tool ini. Pemanggil harus menyimpan hasil sebelumnya dan mengirimkannya lagi untuk pemeriksaan berikutnya.', limitations: ['Perubahan field bukan penilaian bahwa perubahan penting secara substantif.', 'Item yang hilang dari hasil pencarian belum tentu dihapus dari sumber.'] }
}
