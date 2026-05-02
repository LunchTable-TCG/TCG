---
name: build-lunchtable-game
description: Use when extending Lunch Table Games rules, starter scaffolds, generated game packs, or agent participation surfaces.
---

# Build Lunch Table Game

Use this skill when changing rulesets, state shapes, tabletop components, render scenes, game content, or scaffold output.

## Workflow

1. Read `llms-full.txt`, `docs/superpowers/specs/2026-05-02-lunch-table-games-design.md`, and the nearest tests.
2. Keep dependencies pointing inward: apps and game-specific code may depend on generic packages, but generic packages must not depend on product apps.
3. Add or update tests for state, legal intents, agent parity, self-play, and scaffold output.
4. Keep all authoritative changes in a ruleset or validated generated pack.
5. Run `bun run lint`, `bun run typecheck`, and the relevant tests.

## Rules

- Do not add renderer-only state to the authority model.
- Do not leak private zones into spectator, opponent, or unrelated agent views.
- Do not let MCP, A2A, HTTP, or advisory adapters bypass `applyIntent`.
- Keep generated-game content data-driven unless a custom ruleset plugin is required.
