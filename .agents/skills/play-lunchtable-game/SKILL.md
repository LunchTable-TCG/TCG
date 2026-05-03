---
name: play-lunchtable-game
description: Use when an agent needs to join, observe, or play a Lunch Table Games match or starter through legal actions.
---

# Play Lunch Table Game

Use when an agent needs to join a seat, inspect a scoped view, choose a legal action, or submit a turn.

## Workflow

1. Read `llms.txt`, `llms-full.txt`, and `docs/platform/AGENT_PARITY.md`.
2. Build or obtain the scoped seat view for the active seat.
3. Use the current legal action catalog; choose one `actionId`, or choose `null`.
4. Resolve external choices through the legal-action resolver before submission.
5. Submit through the same authoritative path as a human seat.
6. Run the relevant agent parity and self-play tests after behavior changes.

## Rules

- Never invent an intent payload.
- Never mutate game state directly.
- Never read hidden information outside the current seat view.
- Treat humans and agents as equal seats.
