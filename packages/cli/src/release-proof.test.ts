import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

interface CliPackageJson {
  bin: {
    lunchtable: string;
  };
  dependencies?: Record<string, string>;
  files: string[];
  scripts: {
    prepack: string;
  };
}

describe("lunchtable release proof", () => {
  it("publishes a built Bun executable for bunx", async () => {
    const packageJson = JSON.parse(
      await readFile(join(import.meta.dirname, "..", "package.json"), "utf8"),
    ) as CliPackageJson;
    const sourceCli = await readFile(
      join(import.meta.dirname, "index.ts"),
      "utf8",
    );

    expect(packageJson.bin.lunchtable).toBe("./dist/index.js");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.scripts.prepack).toBe("bun run build");
    expect(packageJson.dependencies).toBeUndefined();
    expect(sourceCli.startsWith("#!/usr/bin/env bun")).toBe(true);
  });
});
