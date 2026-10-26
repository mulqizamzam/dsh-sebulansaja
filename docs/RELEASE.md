# Release process

1. Run `npm run check` and `npm pack --dry-run` using Node.js 22 or newer.
2. Verify the package metadata and target DSH engine range.
3. Install into a disposable DSH `0.2.1-rc.2` profile and smoke-test tool registration and each configured provider.
4. Review the diff for credentials, personal data, unexpected files, inherited branding, and unverified documentation claims.
5. Build the release archive twice and compare SHA-256 hashes.
6. Tag the verified commit as `v0.1.0` (or the next version) and publish release notes.
7. Publish to npm only after confirming the registry package name is available and the publisher is authorized.
8. Verify the GitHub release and registry package URL directly after publishing.

Never treat a local archive as proof of a remote release or a passing unit test as proof of live DSH compatibility.
