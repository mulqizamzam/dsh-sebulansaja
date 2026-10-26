const MAX_RESULTS = 200
const MAX_PROFILES = 100

function clean(value, max = 1200) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}
function tokens(value) {
  return new Set((clean(value, 3000).toLowerCase().match(/[a-z0-9][a-z0-9+.#_-]{1,}/g) ?? []).filter(token => !new Set(['the','and','for','are','was','were','with','this','that','from','into','about','have','has','had','not','but','you','your','new','using']).has(token)))
}
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url : null } catch { return null }
}
function canonicalUrl(value) {
  const url = safeUrl(value)
  if (!url) return ''
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key)
  return url.toString().replace(/\/$/, '').toLowerCase()
}
function titleSimilarity(a, b) {
  const left = tokens(a), right = tokens(b)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / (left.size + right.size - shared)
}
function hostOf(value) {
  const url = safeUrl(value)
  return url ? url.hostname.replace(/^www\./, '').toLowerCase() : null
}

export function analyzeSourceLineage(input) {
  if (!Array.isArray(input?.results)) throw new Error('results must be an array')
  if (input.results.length > MAX_RESULTS) throw new Error(`results must contain at most ${MAX_RESULTS} items`)
  const results = input.results.map((item, index) => ({
    index, title: clean(item?.title, 240) || '(untitled)', summary: clean(item?.summary, 700),
    url: safeUrl(item?.url)?.toString() ?? null, canonicalUrl: canonicalUrl(item?.url),
    source: clean(item?.source, 60) || 'unknown', host: hostOf(item?.url),
    publishedAt: item?.publishedAt ?? null, engagement: Number.isFinite(Number(item?.engagement)) ? Number(item.engagement) : null,
    possiblePrimary: Boolean(hostOf(item?.url) && /(^|\.)(github\.com|gitlab\.com|arxiv\.org|doi\.org|acm\.org|ieee\.org|nist\.gov)$/.test(hostOf(item.url)) || /official|documentation|paper|specification/i.test(clean(item?.title) + ' ' + clean(item?.summary))),
  })).filter(item => item.url)
  const parent = results.map((_, i) => i)
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] } return i }
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra }
  const links = []
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i], b = results[j]
      if (a.canonicalUrl === b.canonicalUrl) {
        union(i, j); links.push({ left: a.index, right: b.index, reason: 'same_canonical_url', confidence: 1 })
      } else {
        const similarity = titleSimilarity(a.title, b.title)
        if (similarity >= 0.78) {
          union(i, j); links.push({ left: a.index, right: b.index, reason: 'near_duplicate_title', confidence: Math.round(similarity * 100) / 100 })
        }
      }
    }
  }
  const groups = new Map()
  results.forEach((item, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(item)
  })
  const clusters = [...groups.values()].map((members, index) => {
    const hosts = [...new Set(members.map(item => item.host))]
    const primaryCandidates = members.filter(item => item.possiblePrimary)
    return {
      clusterId: `cluster-${index + 1}`,
      duplicateLikely: members.length > 1,
      itemCount: members.length,
      distinctHostCount: hosts.length,
      hosts,
      primaryCandidates: primaryCandidates.map(({ index, title, url, host }) => ({ index, title, url, host })),
      items: members.map(({ index, title, url, host, source, publishedAt }) => ({ index, title, url, host, source, publishedAt })),
      note: members.length > 1 ? (hosts.length === 1 ? 'Kemungkinan duplikat pada host yang sama; verifikasi isi.' : 'Judul/URL mirip lintas host; jangan anggap sebagai bukti independen tanpa pemeriksaan asal-usul kutipan.') : 'Tidak ada duplikat yang terdeteksi pada ambang heuristik saat ini.'
    }
  }).sort((a, b) => b.itemCount - a.itemCount || a.clusterId.localeCompare(b.clusterId))
  return {
    resultCount: results.length, clusterCount: clusters.length,
    likelyDuplicateClusters: clusters.filter(cluster => cluster.duplicateLikely).length,
    links, clusters,
    limitations: ['Deteksi menggunakan URL kanonis dan kemiripan judul; duplikat isi dengan judul berbeda bisa terlewat.', 'Sumber pada domain berbeda belum tentu independen; asal-usul kutipan tidak diperiksa otomatis.', 'Indikasi sumber primer bersifat heuristik dan perlu verifikasi manusia.']
  }
}

const RELATIONS = new Set(['supports', 'contradicts', 'mixed', 'unclear'])
export function buildClaimVerificationMatrix(input) {
  if (!Array.isArray(input?.claims)) throw new Error('claims must be an array')
  if (input.claims.length > 100) throw new Error('claims must contain at most 100 items')
  const claims = input.claims.map((claim, index) => {
    const statement = clean(typeof claim === 'string' ? claim : claim?.claim ?? claim?.text, 500)
    if (!statement) throw new Error(`claim at index ${index} must contain text`)
    const evidenceInput = typeof claim === 'string' ? [] : (claim?.evidence ?? [])
    if (!Array.isArray(evidenceInput) || evidenceInput.length > 50) throw new Error(`claim at index ${index} evidence must be an array with at most 50 items`)
    const evidence = evidenceInput.map((item, evidenceIndex) => {
      const url = safeUrl(item?.url)?.toString()
      if (!url) throw new Error(`claim at index ${index} evidence at index ${evidenceIndex} must have an https URL`)
      const relation = RELATIONS.has(item?.relation) ? item.relation : 'unclear'
      return { relation, title: clean(item?.title, 240) || '(untitled)', url, source: clean(item?.source, 60) || hostOf(url), excerpt: clean(item?.excerpt, 700), rationale: clean(item?.rationale, 500), independenceGroup: clean(item?.independenceGroup, 120) || hostOf(url) }
    })
    const counts = Object.fromEntries([...RELATIONS].map(relation => [relation, evidence.filter(item => item.relation === relation).length]))
    const groups = new Set(evidence.filter(item => item.relation === 'supports' || item.relation === 'contradicts').map(item => item.independenceGroup))
    let status = 'insufficient_evidence'
    if (counts.supports && counts.contradicts) status = 'mixed'
    else if (counts.contradicts) status = 'contradicted'
    else if (counts.supports) status = 'supported'
    return {
      id: clean(typeof claim === 'string' ? '' : claim?.id, 80) || `claim-${index + 1}`,
      claim: statement, status, evidenceCount: evidence.length, evidenceCounts: counts,
      independentEvidenceGroups: groups.size, evidence,
      confidenceNote: status === 'insufficient_evidence' ? 'Bukti belum cukup atau belum diklasifikasikan.' : groups.size < 2 ? 'Hanya satu atau nol kelompok sumber independen; jangan menyimpulkan konsensus.' : 'Jumlah kelompok sumber adalah metadata yang diberikan pemanggil, bukan verifikasi independensi otomatis.'
    }
  })
  return {
    claimCount: claims.length,
    summary: { supported: claims.filter(c => c.status === 'supported').length, contradicted: claims.filter(c => c.status === 'contradicted').length, mixed: claims.filter(c => c.status === 'mixed').length, insufficientEvidence: claims.filter(c => c.status === 'insufficient_evidence').length },
    claims,
    methodology: 'Status diringkas dari relasi evidence yang diberikan pemanggil. Tool ini tidak membaca URL atau memverifikasi kutipan; relasi harus dinilai dari konten sumber yang telah diperiksa.',
    limitations: ['Status hanya seandal klasifikasi evidence yang diberikan.', 'Sumber yang berbeda tidak otomatis independen; independenceGroup harus diisi berdasarkan lineage yang ditinjau.', 'Ketiadaan bukti yang dimasukkan tidak membuktikan klaim salah.']
  }
}

function validateProfile(profile) {
  const id = clean(profile?.id, 80)
  const name = clean(profile?.name, 120)
  const query = clean(profile?.query, 240)
  if (!id || !name || query.length < 2) throw new Error('each profile requires id, name, and query (at least 2 characters)')
  const days = profile.days ?? 30
  const limit = profile.limit ?? 10
  const sources = profile.sources ?? ['hacker_news', 'reddit', 'github']
  const allowed = new Set(['hacker_news', 'reddit', 'github'])
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error(`profile ${id}: days must be an integer from 1 to 90`)
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error(`profile ${id}: limit must be an integer from 1 to 20`)
  if (!Array.isArray(sources) || !sources.length || sources.some(source => !allowed.has(source)) || new Set(sources).size !== sources.length) throw new Error(`profile ${id}: sources must be a unique non-empty list of supported sources`)
  const intervalHours = profile.intervalHours ?? 24
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24 * 30) throw new Error(`profile ${id}: intervalHours must be an integer from 1 to 720`)
  return { id, name, query, days, limit, sources: [...sources], intervalHours, enabled: profile.enabled !== false, createdAt: profile.createdAt ?? null, updatedAt: profile.updatedAt ?? null, lastRunAt: profile.lastRunAt ?? null, lastSnapshot: profile.lastSnapshot ?? null }
}
export function manageTopicWatchProfiles(input) {
  const profilesInput = input?.profiles ?? []
  if (!Array.isArray(profilesInput) || profilesInput.length > MAX_PROFILES) throw new Error('profiles must be an array containing at most 100 items')
  const profiles = profilesInput.map(validateProfile)
  if (new Set(profiles.map(profile => profile.id)).size !== profiles.length) throw new Error('profile ids must be unique')
  const action = input?.action
  if (!['list', 'create', 'update', 'delete', 'record_run'].includes(action)) throw new Error('action must be list, create, update, delete, or record_run')
  if (action === 'list') return { action, profiles, profileCount: profiles.length, persistence: 'caller_managed' }
  const id = clean(input?.id ?? input?.profile?.id, 80)
  if (!id) throw new Error('id or profile.id is required for this action')
  const index = profiles.findIndex(profile => profile.id === id)
  if (action === 'create') {
    if (index !== -1) throw new Error(`profile ${id} already exists`)
    const profile = validateProfile({ ...input.profile, id })
    const next = [...profiles, profile]
    if (next.length > MAX_PROFILES) throw new Error('profiles cannot exceed 100 items')
    return { action, profile, profiles: next, profileCount: next.length, persistence: 'caller_managed' }
  }
  if (index === -1) throw new Error(`profile ${id} was not found`)
  if (action === 'delete') {
    const next = profiles.filter(profile => profile.id !== id)
    return { action, deletedId: id, profiles: next, profileCount: next.length, persistence: 'caller_managed' }
  }
  const existing = profiles[index]
  let updated
  if (action === 'update') updated = validateProfile({ ...existing, ...input.profile, id, updatedAt: input.profile?.updatedAt ?? new Date().toISOString() })
  else {
    const snapshot = input.snapshot
    if (!snapshot || !Array.isArray(snapshot.results)) throw new Error('record_run requires snapshot.results array')
    if (snapshot.results.length > MAX_RESULTS) throw new Error('snapshot.results must contain at most 200 items')
    updated = { ...existing, lastRunAt: input.runAt ?? new Date().toISOString(), lastSnapshot: snapshot }
  }
  const next = profiles.map((profile, i) => i === index ? updated : profile)
  return { action, profile: updated, profiles: next, profileCount: next.length, persistence: 'caller_managed', note: 'Simpan array profiles yang dikembalikan jika ingin mempertahankan perubahan di antara pemanggilan tool.' }
}
