# DSH SebulanSaja

**Recent-source research for DeepSeek-Native Harness.** SebulanSaja runs a bounded discovery pass across public Hacker News, Reddit, and GitHub search endpoints, returning dated source links, source-specific engagement, per-provider status, and explicit research limitations.

- **Owner:** `mulqizamzam`
- **Package:** `dsh-sebulansaja`
- **Version:** `0.1.0`
- **Target DSH:** `>=0.2.1-rc.2 <0.3.0`
- **Node.js:** `>=22`
- **Credentials:** none for the included public endpoints

This project is independently implemented. Its code, prompts, assets and documentation were written for this project, rather than imported from another research project.

## Features

### 1. Recent-source discovery

The `research_recent_sources` tool searches three public sources in parallel:

| Source | Endpoint | Returned signals |
|---|---|---|
| Hacker News | Algolia public search API | Story title, URL, date, points/comments summary |
| Reddit | Public search JSON endpoint | Post title, permalink, date, score/comments summary |
| GitHub | Public repository search API | Repository, URL, last push, stars, description |

Results are filtered to the requested time window, deduplicated by URL and sorted newest-first. Engagement breaks timestamp ties. A provider failure is reported per source without discarding successful results from other providers.

### 2. Evidence Tracker

The `track_research_evidence` tool accepts claims and discovery results, then attaches candidate source links using lexical overlap. Claims can optionally restrict matching to explicit `evidenceUrls`. It reports `evidence_found_review_required` or `no_matching_evidence_found`; it does **not** automatically label claims true, supported, or refuted. Open each source and assess context before reaching a conclusion.

### 3. Source Quality & Signal Ranking

The `rank_research_sources` tool orders results using transparent heuristics: likely primary/official source indicators, repository links, freshness, query overlap, and a small secondary engagement signal. Every result includes a `quality.score`, `quality.tier`, `quality.relevance`, and human-readable `quality.reasons`.

Scores are prioritization hints, **not validated credibility scores or proof of truth**. Official domains and repositories can still contain errors. Engagement is not directly comparable across platforms.

### 4. Topic Watch & Change Detection

The `compare_research_snapshots` tool compares a previously saved result list with a new one and reports `added`, `removed` (missing from the current search result), and `changed` items. URLs are normalized to reduce false differences from tracking parameters and trailing slashes.

This is the comparison engine for a topic watch, not a background scheduler: **the caller must save the prior snapshot and invoke the tool again later**. The plugin currently does not persist snapshots or run recurring checks by itself.

## Installation

### From GitHub

```sh
dsh plugin --profile web add github:mulqizamzam/dsh-sebulansaja
```

For repeatable installs, pin a verified tag (once a release tag has been published):

```sh
dsh plugin --profile web add github:mulqizamzam/dsh-sebulansaja#v0.1.0
```

### From a local directory

```sh
git clone https://github.com/mulqizamzam/dsh-sebulansaja.git
cd dsh-sebulansaja
npm test
dsh plugin --profile web add .
```

Prerequisites: Node.js 22 or newer, npm, and a DSH installation compatible with `0.2.1-rc.2`.

### From npm

The npm package is **not yet published**. After a registry release is made, install with:

```sh
dsh plugin --profile web add dsh-sebulansaja
```

## Usage

Ask your agent to research a topic, track candidate evidence for claims, rank results by source quality and relevance, or compare a saved result snapshot with fresh results.

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

No API keys or environment variables are required by the included providers. Network access to their public endpoints is required while a tool call runs. The plugin uses Node's built-in `fetch`, has an eight-second per-provider request timeout, caps response bodies at two megabytes, and makes no automatic retry loop.

## Limitations and evidence quality

- This is a discovery tool, not an independent fact-checker. Open source links and verify claims before treating them as facts.
- Evidence matching is lexical; it does not infer support or contradiction.
- Ranking is heuristic and can favor a domain signal incorrectly. Review the reasons and source content.
- Snapshot differences do not prove that an item was deleted or that a change is important.
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

Tests cover input validation, evidence candidate tracking, ranking, and snapshot comparison without making live network requests. They do not replace a DSH runtime smoke test or live provider verification.

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
