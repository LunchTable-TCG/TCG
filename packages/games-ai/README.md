# @lunchtable/games-ai

Agent parity primitives for Lunch Table Games: legal action descriptors,
decision frames, external-agent envelopes, MCP tool manifests, A2A cards, and
elizaOS Cloud request helpers.

```ts
import { createLegalActionDescriptors } from "@lunchtable/games-ai";
```

Agents choose known legal action ids and never mutate authoritative game state
directly. Hosted Eliza orchestration uses elizaOS Cloud chat completions plus
MCP tools while preserving the same legal-action-only authority path.
