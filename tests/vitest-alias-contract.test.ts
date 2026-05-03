import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("vitest workspace alias contract", () => {
  it("resolves public Lunch Table Games packages to source in tests", () => {
    const config = readFileSync(join(rootDir, "vitest.config.ts"), "utf8");

    expect(config).toContain('"packages/games-core/src/index.ts"');
    expect(config).toContain('"packages/games-ai/src/index.ts"');
    expect(config).toContain('"packages/games-assets/src/index.ts"');
    expect(config).toContain('"packages/games-api/src/index.ts"');
    expect(config).toContain('"packages/games-render/src/index.ts"');
    expect(config).toContain('"packages/games-side-scroller/src/index.ts"');
    expect(config).toContain('"packages/games-tabletop/src/index.ts"');
  });
});
