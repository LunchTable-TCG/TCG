import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import viteConfig from "../apps/web/vite.config";

describe("web env configuration", () => {
  it("loads Vite env vars from the monorepo root", () => {
    const envDir =
      typeof viteConfig.envDir === "string" ? viteConfig.envDir : ".";

    expect(resolve(envDir)).toBe(resolve(process.cwd()));
  });
});
