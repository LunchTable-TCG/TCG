# @lunchtable/games-assets

Headless asset authoring primitives for Lunch Table Games generated packs.

This package models sprite sheets, animation clips, pivots, hitboxes, tilemaps,
scene timelines, side-scroller asset bindings, atlas export, and elizaOS Cloud
image generation request contracts without depending on React, Convex, Pixi,
Three.js, or browser DOM APIs.

```ts
import {
  createAssetStudioToolDefinitions,
  createSideScrollerAssetBundle,
  runAssetStudioTool,
  validateAssetBundle,
} from "@lunchtable/games-assets";
```

The asset studio surface is agent-native: humans can use browser panels while
agents can use the same validation, export, atlas, and generation-request tools
through MCP, SSE, HTTP, or another host transport without receiving secret keys.
