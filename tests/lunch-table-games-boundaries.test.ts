import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

const genericPackageRoots = [
  "packages/games-core/src",
  "packages/games-tabletop/src",
  "packages/games-ai/src",
  "packages/games-api/src",
  "packages/games-render/src",
  "packages/games-side-scroller/src",
] as const;

const forbiddenPackages = [
  "@lunchtable/bot-sdk",
  "@lunchtable/card-content",
  "@lunchtable/game-core",
  "@lunchtable/render-pixi",
  "@lunchtable/shared-types",
  "@pixi/react",
  "convex",
  "pixi.js",
  "react",
  "three",
] as const;

const sourceFileExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
const importSpecifierPattern =
  /(?:^|[\n;])\s*(?:import\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?|export\s+(?:type\s+)?[^;]*?\s+from\s+)(["'])([^"']+)\1/g;

type BoundaryViolation = {
  file: string;
  importPath: string;
};

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }

    if (
      stats.isFile() &&
      sourceFileExtensions.has(path.slice(path.lastIndexOf(".")))
    ) {
      files.push(path);
    }
  }

  return files;
}

function readImportSpecifiers(source: string): string[] {
  const imports: string[] = [];

  for (const match of source.matchAll(importSpecifierPattern)) {
    imports.push(match[2]);
  }

  return imports;
}

function isForbiddenImport(importPath: string) {
  return forbiddenPackages.some(
    (packageName) =>
      importPath === packageName || importPath.startsWith(`${packageName}/`),
  );
}

function findBoundaryViolations(): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const packageRoot of genericPackageRoots) {
    for (const file of listSourceFiles(join(rootDir, packageRoot))) {
      const source = readFileSync(file, "utf8");

      for (const importPath of readImportSpecifiers(source)) {
        if (isForbiddenImport(importPath)) {
          violations.push({
            file: relative(rootDir, file),
            importPath,
          });
        }
      }
    }
  }

  return violations;
}

describe("Lunch Table Games package boundaries", () => {
  it("keeps generic packages independent from product and renderer packages", () => {
    expect(findBoundaryViolations()).toEqual([]);
  });
});
