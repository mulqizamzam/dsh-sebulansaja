# DSH SebulanSaja

**Recent-source research for DeepSeek-Native Harness.** SebulanSaja runs bounded discovery across public Hacker News, Reddit, and GitHub search endpoints, then helps organize evidence, prioritize sources, compare snapshots, and manage reusable watch profiles.

- **Owner:** `mulqizamzam`
- **Package:** `dsh-sebulansaja`
- **Version:** `0.1.0`
- **Target DSH:** `>=0.2.1-rc.2 <0.3.0`
- **Node.js:** `>=22`
- **Credentials:** none for the included public endpoints

## Features

### 1. Recent-source discovery

The `research_recent_sources` tool searches three public sources in parallel:

| Source | Endpoint | Returned signals |
|---|---|---|
| Hacker News | Algolia public search API | Story title, URL, date, points/comments summary |
| Reddit | Public search JSON endpoint | Post title, permalink, date, score/comments summary |
| GitHub | Public repository search API | Repository, URL, last push, stars, description |

Results are filtered to the requested time window, deduplicated by URL and sorted newest-first. Provider failures are reported independently.

### 2. Evidence Tracker

`track_research_evidence` finds candidate source links for user-supplied claims using lexical overlap. It reports `evidence_found_review_required` or `no_matching_evidence_found`, never an automatic truth verdict.

### 3. Source Quality & Signal Ranking

`rank_research_sources` ranks results using heuristics for likely primary sources, freshness, query overlap, and secondary engagement. Results include a score, tier, relevance estimate, and human-readable reasons. Scores are prioritization hints, not validated credibility metrics.

### 4. Topic Watch & Change Detection

`compare_research_snapshots` compares prior and current result lists, reporting added items, items missing from the latest result set, and changed fields. The caller must persist and provide the prior snapshot; the tool itself does not schedule jobs or save state.

### 5. Source Lineage & Duplicate Detection

`analyze_source_lineage` clusters canonical duplicate URLs and near-duplicate titles, lists likely primary-source candidates, and warns when multiple results may repeat the same story. This helps avoid treating repeated coverage as independent evidence.

The detector is heuristic: it does not compare full article text or trace citations automatically. Different domains do not guarantee independent reporting.

### 6. Claim Verification Matrix

`build_claim_verification_matrix` organizes reviewed evidence for each claim into `supported`, `contradicted`, `mixed`, or `insufficient_evidence`. Evidence entries include a relation, HTTPS URL, source, excerpt, rationale, and optional `independenceGroup`.

**Important:** the caller must review the source and provide the evidence relation. The tool does not browse the URL or independently verify excerpts. The matrix summarizes submitted assessments; it is not an automatic fact-checker.

### 7. Topic Watch Profiles

`manage_topic_watch_profiles` supports `list`, `create`, `update`, `delete`, and `record_run`. A profile stores a query, source selection, lookback window, result limit, desired interval, enabled flag, and optional last-run snapshot.

Profiles are **caller-managed data**. Each operation returns an updated `profiles` array; the caller must save that array to durable storage and invoke checks on its own schedule. This plugin does not currently provide persistent storage or a background scheduler.

## Installation

### From GitHub

```sh
dsh plugin --profile web add github:mulqizamzam/dsh-sebulansaja
```

For repeatable installs, pin a verified tag after a release tag has been published:

```sh
dsh plugin --profile web add github:mulqizamzam/dsh-sebulansaja#v0.1.0
```

### From a local directory

```sh
git clone https://github.com/mulqizamzam/dsh-sebulansaja.git
cd dsh-sebulansaja
npm test
npm run check
dsh plugin --profile web add .
```

Prerequisites: Node.js 22 or newer, npm, and a DSH installation compatible with `0.2.1-rc.2`.

### From npm

The npm package is **not yet published**. After a registry release is made, install with:

```sh
dsh plugin --profile web add dsh-sebulansaja
```

## Usage ideas

Ask your agent to research a topic, track candidate evidence for claims, rank results, detect repeated coverage, create a claim verification matrix from reviewed excerpts, compare snapshots, or manage a topic-watch profile.

The `research_recent_sources` tool accepts:

| Field | Type | Default | Constraints |
|---|---|---|---|
| `query` | string | required | 2–240 characters |
| `days` | integer | `30` | 1–90 |
| `sources` | array | all three | unique values from `hacker_news`, `reddit`, `github` |
| `limit` | integer | `10` | 1–20 results per source |

## Update and remove

```sh
dsh plugin --profile web update dsh-sebulansaja
```

If in-place updates are unsupported by your DSH/pnpm version, remove and re-add the package:

```sh
dsh plugin --profile web remove dsh-sebulansaja
dsh plugin --profile web add github:mulqizamzam/dsh-sebulansaja
```

To uninstall:

```sh
dsh plugin --profile web remove dsh-sebulansaja
```

Substitute your profile name for `web` as needed.

## Configuration and dependencies

No API keys or environment variables are required by the included providers. Network access to public endpoints is required while a discovery call runs. The plugin uses Node's built-in `fetch`, has an eight-second per-provider request timeout, caps response bodies at two megabytes, and makes no automatic retry loop.

## Limitations and evidence quality

- This is a discovery and evidence-organization tool, not an independent fact-checker. Open source links and verify claims before treating them as facts.
- Evidence matching and near-duplicate detection use lexical/URL heuristics and can miss relevant matches or produce false positives.
- Verification statuses depend on evidence relations supplied by a reviewer; the matrix does not fetch or inspect URLs.
- Source lineage does not prove source independence. Shared citations and syndication require review.
- Ranking is heuristic and can favor a domain signal incorrectly. Review the reasons and source content.
- Snapshot differences do not prove an item was deleted or that a change is substantively important.
- Topic-watch profiles are not durable unless the caller persists the returned array; interval metadata does not start a scheduler.
- Provider indexing, rate limits and search syntax constrain coverage. Empty results do not prove that nothing happened.
- Reddit may rate-limit anonymous queries. GitHub's unauthenticated API has lower rate limits.
- Engagement numbers are source-specific and must not be compared directly across platforms.
- The plugin does not search X, YouTube, TikTok, paywalled sources, private repositories or the general web.
- Search queries are sent to the selected public providers. Do not submit confidential queries.
- Returned external text is untrusted data and must not be treated as instructions.

## Development and tests

```sh
npm test
npm run check
npm pack --dry-run
```

Tests cover input validation, evidence tracking, source ranking, snapshot comparison, lineage clustering, claim matrix summaries, and profile operations without live network requests. They do not replace a DSH runtime smoke test or live provider verification.

## Troubleshooting

- **Tool missing:** run `dsh --profile web --dump-config` and confirm the bundle layer is present; restart the profile if necessary.
- **Runtime engine mismatch:** the bundle targets `>=0.2.1-rc.2 <0.3.0`; do not bypass the DSH version gate casually.
- **One provider unavailable:** inspect `sources[].error`; other providers can still return results.
- **No results:** broaden the topic/window or query one provider at a time. Index absence is not proof of absence.
- **Rate limits:** wait before trying again rather than repeatedly polling.
- **Install failure:** verify Node, DSH/pnpm availability and network access.

## Project docs

- [Validation scope](docs/VALIDATION.md)
- [Release process](docs/RELEASE.md)

## License

MIT. See [LICENSE](LICENSE).
