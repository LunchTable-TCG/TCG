# GitHub Setup

This repository is the Lunch Table Games library home. GitHub should describe
and protect the whole game library, not only the original trading card game.

## Repository Metadata

- Description: `Lunch Table Games: browser-first generated game library with deterministic tabletop primitives, AI agent parity, CLI scaffolds, assets, MCP/SSE APIs, TCG, side-scroller, dice, and 3D starter families.`
- Default branch: `main`
- Visibility: public
- Issues: enabled
- Projects: enabled
- Wiki: disabled
- Topics:
  - `lunch-table-games`
  - `browser-games`
  - `generated-games`
  - `ai-agents`
  - `tabletop`
  - `tcg`
  - `side-scroller`
  - `mcp`
  - `typescript`
  - `bun`

## Branch Protection

Protect `main` with:

- require status checks before merging
- require branches to be up to date before merging
- required check: `validate`
- require conversation resolution before merging
- block force pushes
- block branch deletion

The required `validate` check is the job in `.github/workflows/phase-gates.yml`.
It runs the full and regression gates for the whole monorepo.

## Actions And Secrets

Required workflows:

- `.github/workflows/phase-gates.yml`: push and PR validation for all packages,
  apps, Convex tests, generated-game checks, and release contracts.
- `.github/workflows/release.yml`: tag-based GitHub release and npm publish.

Required repository secret for the first npm publish:

- `NPM_TOKEN`: automation token with publish access to `lunchtable` and the
  `@lunchtable` npm scope.

After the first publish creates package records, configure npm trusted
publishing for the release workflow and remove `NPM_TOKEN`.

## Public Package Surface

The release workflow publishes the library packages and CLI:

- `@lunchtable/games-core`
- `@lunchtable/games-render`
- `@lunchtable/games-ai`
- `@lunchtable/games-api`
- `@lunchtable/games-assets`
- `@lunchtable/games-tabletop`
- `@lunchtable/games-side-scroller`
- `lunchtable`

The TCG-specific packages remain private proof-game packages until their
generic boundaries and public API are intentionally promoted.

## Repo Health Files

- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/game_family.yml`
- `.github/dependabot.yml`

These files keep issue triage and PR review oriented around the full Lunch
Table Games platform: core primitives, renderers, assets, generated-game
admission, scaffolds, agents, TCG proof app, side-scroller, dice, and future
3D game families.
