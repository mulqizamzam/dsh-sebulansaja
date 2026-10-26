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

The `research_recent_sources` tool searches three public sources in parallel:

| Source | Endpoint | Returned signals |
|---|---|---|
| Hacker News | Algolia public search API | Story title, URL, date, points/comments summary |
| Reddit | Public search JSON endpoint | Post title, permalink, date, score/comments summary |
| GitHub | Public repository search API | Repository, URL, last push, stars, description |

Results are filtered to the requested time window, deduplicated by URL and sorted newest-first. Engagement breaks timestamp ties. A provider failure is reported per source without discarding successful results from other providers.

## Installation

### From GitHub

The repository is public. Install it into a DSH profile with:

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

Prerequisites: Node.js 22 or newer, npm, and a DSH installation compatible with `0.2.1-rc.2`. DSH's plugin command manages bundle installation for the selected profile.

### From npm

The npm package is **not yet published**. After a registry release is made, install with:

```sh
dsh plugin --profile web add dsh-sebulansaja
```

## Usage

Ask your agent to research a topic, for example:

- “Research DeepSeek Harness developments from the last 14 days.”
- “Compare recent Hacker News, Reddit, and GitHub signals about local-first AI agents.”
- “Find recent GitHub projects about agent memory from the last week; show dates and source links.”

The agent can call `research_recent_sources` with:

| Field | Type | Default | Constraints |
|---|---|---|---|
| `query` | string | required | 2–240 characters |
| `days` | integer | `30` | 1–90 |
| `sources` | array | all three | unique values from `hacker_news`, `reddit`, `github` |
| `limit` | integer | `10` | 1–20 results per source |

The result includes the exact lookback boundaries, per-source status and error summaries, result titles, URLs, publication timestamps, engagement values, and limitations.

## Update and remove

Update an installed package through the DSH profile package manager:

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

Tests cover input validation without making live network requests. They do not replace a DSH runtime smoke test or live provider verification.

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
