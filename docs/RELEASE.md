# Release

Use this flow after the implementation phases are complete and `main` is the
candidate branch.

## Prerequisites

- local dependencies installed with `bun install`
- local Convex auth variables available through `.env.local`
- no uncommitted code changes except the intentional local `SESSION.md` handoff

## Release Proof

Run the self-contained release proof:

```bash
bun run release:proof
```

This does the following in order:

1. syncs local Convex auth variables
2. boots a local Convex backend if one is not already running
3. regenerates Convex bindings with `bunx convex codegen`
4. ensures local Playwright Chromium is installed when browser tests are present
5. proves the packed `lunchtable` CLI through `bunx --package`
6. runs `./scripts/phase-check.sh full`
7. runs `./scripts/phase-check.sh regression`

The script prints the validated commit hash at the end. If the working tree is
dirty, it warns instead of silently treating that state as release-ready. If a
stale local Convex deployment triggers the interactive backend-upgrade prompt,
the script resets the local Convex state and retries non-interactively.

## Cut A Tag

After `bun run release:proof` passes on the commit you intend to ship:

```bash
bun run release:cut -- v0.1.0 --dry-run
bun run release:cut -- v0.1.0 --push
```

`release:cut` runs the release proof first, writes release notes to
`.phase-loop/releases/<tag>.md`, creates an annotated tag, and optionally pushes
that tag.

## GitHub Tag Workflow

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which:

1. uses the shared workspace bootstrap action
2. runs the same full and regression gates as local release proof
3. generates release notes from git history
4. publishes a GitHub release for the tag

## Recommended Release Notes

- gameplay/rules changes
- Convex schema or auth changes
- replay or bot parity changes
- CI or release gate changes
- known follow-up items that were intentionally deferred
