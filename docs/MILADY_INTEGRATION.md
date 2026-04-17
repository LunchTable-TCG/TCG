# Milady Seat Integration

Lunch Table already treats agent seats as normal players:

- bot seats authenticate as bot users
- bot seats subscribe to the same seat-scoped view a human player would see
- bot seats can only advance play through `matches.submitIntent`

This document covers the practical integration path for Milady or any other
elizaOS-style runtime.

## Recommended Boundary

Use the existing bot runner in `external-http` mode.

Why this boundary:

- Convex remains the only match authority
- Milady only has to choose among legal actions for its current seat
- the adapter never asks Milady to synthesize raw gameplay mutations

## Runner Configuration

Start the bot runner with:

```bash
BOT_POLICY_MODE=external-http
BOT_EXTERNAL_DECISION_URL=http://127.0.0.1:8787/lunchtable/decide
BOT_EXTERNAL_DECISION_TIMEOUT_MS=6000
bun run dev:bot
```

Optional:

```bash
BOT_EXTERNAL_DECISION_AUTH_TOKEN=replace-me
BOT_POLICY_KEY=milady-http-v1
BOT_SLUG=milady-seat
```

## Request Contract

The runner POSTs a JSON envelope with:

- `matchId`, `seat`, `stateVersion`
- `summary` for phase, turn, deadline, stack labels, and recent events
- `legalActions`, each with:
  - `actionId`
  - `kind`
  - `label`
  - `priority`
  - validated `intent`
- `prompt`, a human-readable decision brief
- `view`, the full seat-scoped `MatchSeatView`

The important constraint is simple: the external agent chooses from
`legalActions`; it does not mint new intents.

## Response Contract

Return either:

```json
{ "actionId": "bot:seat-1:3:pass", "confidence": 0.88, "rationale": "optional" }
```

or:

```json
{ "actionId": null }
```

Plain text responses containing only an `actionId` are also accepted.

If the response names an unknown action, the runner rejects it and submits
nothing.

## Milady-Side Shape

Inference from the public Milady repo:

- Milady is local-first and built on elizaOS
- Milady already uses action/callback style runtime boundaries

That makes a single HTTP decision endpoint the lowest-friction integration:

1. Lunch Table bot runner watches the assigned seat.
2. It POSTs the decision envelope to a Milady-side action/plugin endpoint.
3. Milady reasons over the prompt and legal actions.
4. Milady returns one `actionId`.
5. Lunch Table validates that choice and submits the matching public intent.

Milady source used for that inference:

- [milady-ai/milady](https://github.com/milady-ai/milady)

## What This Preserves

- human and agent seats still obey the same timers
- hidden information stays seat-scoped
- no internal Convex gameplay function is exposed to the agent
- replay and moderation remain authoritative on the Lunch Table side
