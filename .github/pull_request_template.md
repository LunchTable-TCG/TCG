## Summary

- 

## Library Surface

- [ ] Generic package boundaries stay independent of TCG, Convex, React, Pixi, Three.js, and app code.
- [ ] Public package exports and README docs are updated when APIs change.
- [ ] `lunchtable init` scaffolds stay aligned with the changed runtime surface.

## Agent Parity

- [ ] Human and AI seats use the same legal action path.
- [ ] Agent context includes scoped views only.
- [ ] MCP, SSE, external HTTP, and A2A surfaces are updated when agent contracts change.

## Generated Games And Assets

- [ ] Generated-game validation, simulation, and replay expectations still pass.
- [ ] Asset Studio schemas, readiness gates, render hints, and scaffold examples are updated when asset flows change.

## Verification

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run release:packages:dry-run`
- [ ] `bash ./scripts/proof-lunchtable-cli-package.sh`
