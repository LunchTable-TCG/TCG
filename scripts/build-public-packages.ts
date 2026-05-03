#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { cwd, exit, stderr, stdout } from "node:process";

interface PublicPackage {
  bundleDependencies: boolean;
  directory: string;
  name: string;
}

const rootDirectory = cwd();
const publicPackages: PublicPackage[] = [
  {
    bundleDependencies: false,
    directory: "packages/games-core",
    name: "@lunchtable/games-core",
  },
  {
    bundleDependencies: false,
    directory: "packages/games-render",
    name: "@lunchtable/games-render",
  },
  {
    bundleDependencies: false,
    directory: "packages/games-ai",
    name: "@lunchtable/games-ai",
  },
  {
    bundleDependencies: false,
    directory: "packages/games-tabletop",
    name: "@lunchtable/games-tabletop",
  },
  {
    bundleDependencies: false,
    directory: "packages/games-side-scroller",
    name: "@lunchtable/games-side-scroller",
  },
  {
    bundleDependencies: true,
    directory: "packages/cli",
    name: "lunchtable",
  },
];

for (const publicPackage of publicPackages) {
  await buildPackage(publicPackage);
}

async function buildPackage(publicPackage: PublicPackage): Promise<void> {
  const packageDirectory = join(rootDirectory, publicPackage.directory);
  await rm(join(packageDirectory, "dist"), { force: true, recursive: true });

  stdout.write(`==> Building ${publicPackage.name}\n`);
  run(
    "bun",
    [
      "build",
      "src/index.ts",
      "--outdir",
      "dist",
      "--target",
      "bun",
      ...(publicPackage.bundleDependencies ? [] : ["--packages", "external"]),
    ],
    packageDirectory,
  );
  run(
    "bunx",
    [
      "tsc",
      "--declaration",
      "--emitDeclarationOnly",
      "--declarationMap",
      "false",
      "--outDir",
      "dist",
      "--rootDir",
      "src",
      "--moduleResolution",
      "Bundler",
      "--module",
      "ESNext",
      "--target",
      "ES2022",
      "--strict",
      "--skipLibCheck",
      "src/index.ts",
    ],
    packageDirectory,
  );
}

function run(command: string, args: string[], workingDirectory: string): void {
  const result = spawnSync(command, args, {
    cwd: workingDirectory,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status === null) {
    stderr.write(`${command} exited without a status\n`);
    exit(1);
  }

  if (result.status !== 0) {
    exit(result.status);
  }
}
