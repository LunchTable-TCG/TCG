# Session State

**Current Phase**: Phase 2
**Current Stage**: Implementation
**Last Checkpoint**: 383aa2a (2026-04-03)
**Planning Docs**: `IMPLEMENTATION_PHASES.md`, `docs/ARCHITECTURE.md`, `docs/GAME_RULES_SPEC.md`, `docs/CONVEX_BACKEND_SPEC.md`, `docs/WALLET_AUTH_SPEC.md`

---

## Phase 1: Repository Bootstrap ✅
**Type**: Infrastructure
**Spec**: `IMPLEMENTATION_PHASES.md#phase-1-repository-bootstrap`
**Progress**:
- [x] Initialize Bun workspace
- [x] Create `apps/web`, `apps/bot-runner`, `packages/*`, and `convex/`
- [x] Configure shared TypeScript paths
- [x] Set up lint, format, and test commands
- [x] Add base README and environment template
**Next Action**: Phase 1 complete.
**Known Issues**: None

## Phase 2: Convex Bootstrap and Auth 🔄
**Spec**: `IMPLEMENTATION_PHASES.md#phase-2-convex-bootstrap-and-auth`
**Next Action**: Initialize Convex and implement wallet challenge issuance, signature verification, and canonical users/wallets/wallet_challenges tables.

## Phase 3: Shared Domain Types ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-3-shared-domain-types`
**Next Action**: Define shared DTOs after Convex auth is wired.

## Phase 4: Rules Kernel Skeleton ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-4-rules-kernel-skeleton`
**Next Action**: Start the rules kernel skeleton after shared domain types are complete.

## Phase 5: Card DSL and Format Registry ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-5-card-dsl-and-format-registry`
**Next Action**: Define the card DSL once the rules kernel can accept typed inputs.

## Phase 6: Deck and Collection CRUD ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-6-deck-and-collection-crud`
**Next Action**: Build deck and collection CRUD after the starter format exists.

## Phase 7: Match Shell Persistence ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-7-match-shell-persistence`
**Next Action**: Add match persistence after decks and collections are available.

## Phase 8: Lobby and Matchmaking ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-8-lobby-and-matchmaking`
**Next Action**: Build lobby and queue flows after match shell persistence is in place.

## Phase 9: Core Gameplay Intent Path ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-9-core-gameplay-intent-path`
**Next Action**: Implement the authoritative gameplay mutation after matchmaking can create matches.

## Phase 10: Timing Windows and Stack ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-10-timing-windows-and-stack`
**Next Action**: Add timing windows and stack logic after the base intent path works.

## Phase 11: Static, Continuous, and Replacement Effects ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-11-static-continuous-and-replacement-effects`
**Next Action**: Implement layered and replacement effects after stack handling is stable.

## Phase 12: Match UI Shell ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-12-match-ui-shell`
**Next Action**: Build the match UI shell after live seat views and prompts are available.

## Phase 13: Pixi Battlefield Renderer ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-13-pixi-battlefield-renderer`
**Next Action**: Replace the text-first board shell with the Pixi renderer after the match UI shell is working.

## Phase 14: Replay and Spectator Mode ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-14-replay-and-spectator-mode`
**Next Action**: Build replay and spectate flows after the live match renderer is stable.

## Phase 15: Bot Runner Foundation ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-15-bot-runner-foundation`
**Next Action**: Add bot workers after human live play is stable and replayable.

## Phase 16: Agent Lab and Non-Critical AI Helpers ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-16-agent-lab-and-non-critical-ai-helpers`
**Next Action**: Add the agent lab after bot-seat parity is proven.

## Phase 17: Test Harness and Regression Gates ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-17-test-harness-and-regression-gates`
**Next Action**: Expand deterministic tests and regression gates after the major runtime surfaces exist.

## Phase 18: Ranked Hardening and Ops ⏸️
**Spec**: `IMPLEMENTATION_PHASES.md#phase-18-ranked-hardening-and-ops`
**Next Action**: Hardening and ops follow once the full feature loop is under regression protection.

---

**Status Icons**:
- `⏸️` pending
- `🔄` in progress
- `✅` complete
- `🚫` blocked
