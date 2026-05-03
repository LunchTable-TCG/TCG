import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@lunchtable/shared-types": path.resolve(
        __dirname,
        "packages/shared-types/src/index.ts",
      ),
      "@lunchtable/game-core": path.resolve(
        __dirname,
        "packages/game-core/src/index.ts",
      ),
      "@lunchtable/games-ai": path.resolve(
        __dirname,
        "packages/games-ai/src/index.ts",
      ),
      "@lunchtable/games-core": path.resolve(
        __dirname,
        "packages/games-core/src/index.ts",
      ),
      "@lunchtable/games-render": path.resolve(
        __dirname,
        "packages/games-render/src/index.ts",
      ),
      "@lunchtable/games-tabletop": path.resolve(
        __dirname,
        "packages/games-tabletop/src/index.ts",
      ),
      "@lunchtable/card-content": path.resolve(
        __dirname,
        "packages/card-content/src/index.ts",
      ),
      "@lunchtable/bot-sdk": path.resolve(
        __dirname,
        "packages/bot-sdk/src/index.ts",
      ),
      "@lunchtable/render-pixi": path.resolve(
        __dirname,
        "packages/render-pixi/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "convex/**/*.test.ts",
      "packages/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    coverage: {
      enabled: false,
    },
  },
});
