# Validation scope

## Automated local checks

The project uses Node's built-in test runner and requires no separate test framework.

```sh
npm test
npm run check
npm pack --dry-run
```

The unit tests cover the query window, maximum lengths, result limits, and allowed source names without making live API requests.

## Not yet verified

A passing unit test does not prove the target DSH runtime can load and register this plugin. Before a stable release, verify against an installed DeepSeek-Native Harness `0.2.1-rc.2` runtime:

1. Install this directory into a disposable profile.
2. Confirm the bundle patch is loaded and the `research_recent_sources` tool is registered.
3. Run one bounded query with each provider separately and inspect returned timestamps and URLs.
4. Test partial provider outages and request cancellation.
5. Rebuild the package twice and compare hashes.

Public endpoint behavior can change or be rate-limited. Query terms are sent to the selected public endpoints; do not submit confidential queries.
