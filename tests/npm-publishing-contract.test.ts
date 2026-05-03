import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const publicPackages = [
  ["@lunchtable/games-core", "packages/games-core"],
  ["@lunchtable/games-render", "packages/games-render"],
  ["@lunchtable/games-ai", "packages/games-ai"],
  ["@lunchtable/games-tabletop", "packages/games-tabletop"],
  ["@lunchtable/games-side-scroller", "packages/games-side-scroller"],
  ["lunchtable", "packages/cli"],
] as const;

function readJson(path: string): {
  dependencies?: Record<string, string>;
  exports?: Record<string, { default: string; types: string }> | string;
  files?: string[];
  license?: string;
  name?: string;
  repository?: { directory: string; type: string; url: string };
  scripts?: Record<string, string>;
  types?: string;
  version?: string;
} {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("npm publishing contract", () => {
  it("keeps the public packages on the v0.1.1 publishable manifest shape", () => {
    for (const [packageName, packageDirectory] of publicPackages) {
      const packageJson = readJson(
        join(rootDir, packageDirectory, "package.json"),
      );

      expect(packageJson.name).toBe(packageName);
      expect(packageJson.version).toBe("0.1.1");
      expect(packageJson.license).toBe("MIT");
      expect(packageJson.repository).toEqual({
        directory: packageDirectory,
        type: "git",
        url: "git+https://github.com/LunchTable-TCG/TCG.git",
      });
      expect(packageJson.types).toBe("./dist/index.d.ts");
      expect(packageJson.exports).toEqual({
        ".": {
          default: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      });
      expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE"]);
    }
  });

  it("keeps workspace dependencies out of publish staging", () => {
    const packageJson = readJson(
      join(rootDir, "packages/games-tabletop/package.json"),
    );

    expect(packageJson.dependencies).toEqual({
      "@lunchtable/games-core": "workspace:*",
    });
    expect(
      readFileSync(join(rootDir, "scripts/release-public-packages.ts"), "utf8"),
    ).toContain("dependencies[dependencyName] = version");
  });
});
