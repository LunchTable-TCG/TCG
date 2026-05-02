---
name: evaluate-lunchtable-agent
description: Use when testing, comparing, or hardening Lunch Table Games gameplay agents.
---

# Evaluate Lunch Table Agent

Use this skill when validating that a gameplay agent can participate fairly, deterministically, and without hidden authority.

## Workflow

1. Run the focused legal-action and parity tests for the changed package.
2. Run self-play tests or deterministic replay tests for the changed game family.
3. Check that every selected `actionId` exists in the current legal action catalog.
4. Check that private state appears only in scoped owner views.
5. Compare replay, self-play, or benchmark outputs after rules or policy changes.

## Rules

- A stronger model may reason better, but it does not get more game authority.
- Invalid external action ids must fail loudly.
- Evaluation fixtures should use deterministic seeds and stable timestamps.
- Advisory agents can explain or coach, but they do not submit live gameplay intents.
