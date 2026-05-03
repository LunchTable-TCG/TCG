#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { argv, cwd, env, exit, stderr } from "node:process";

interface PackageJson {
  dependencies?: Record<string, string>;
  files?: string[];
  name: string;
  scripts?: Record<string, string>;
  version: string;
}

interface PublicPackage {
  directory: string;
  name: string;
}

interface PackedFile {
  path: string;
}

interface PackResult {
  files: PackedFile[];
  name: string;
  version: string;
}

const rootDirectory = cwd();
const publicPackageNames = [
  "@lunchtable/games-core",
  "@lunchtable/games-render",
  "@lunchtable/games-ai",
  "@lunchtable/games-tabletop",
  "lunchtable",
] as const;

const packageDirectories: Record<(typeof publicPackageNames)[number], string> =
  {
    "@lunchtable/games-ai": "packages/games-ai",
    "@lunchtable/games-core": "packages/games-core",
    "@lunchtable/games-render": "packages/games-render",
    "@lunchtable/games-tabletop": "packages/games-tabletop",
    lunchtable: "packages/cli",
  };

const publicPackages: PublicPackage[] = publicPackageNames.map((name) => ({
  directory: packageDirectories[name],
  name,
}));

const mode = argv[2];
if (mode !== "--dry-run" && mode !== "--publish") {
  stderr.write(
    "Usage: bun run scripts/release-public-packages.ts --dry-run|--publish [--pack-destination <directory>]\n",
  );
  exit(1);
}
const packDestination = parsePackDestination(argv);
const hasTokenAuth =
  env.NODE_AUTH_TOKEN !== undefined && env.NODE_AUTH_TOKEN.length > 0;

const releaseDirectory = await mkdtemp(join(tmpdir(), "lunchtable-release-"));

try {
  run("bun", ["run", "build:packages"], rootDirectory);

  const version = await readReleaseVersion();
  for (const publicPackage of publicPackages) {
    const stagedDirectory = await stagePackage(publicPackage, version);
    const packResult = packDryRun(stagedDirectory);
    validatePackResult(publicPackage, packResult);
    if (packDestination !== null) {
      run(
        "npm",
        ["pack", stagedDirectory, "--pack-destination", packDestination],
        rootDirectory,
      );
    }

    if (mode === "--publish") {
      publishPackage(stagedDirectory);
    }
  }
} finally {
  await rm(releaseDirectory, { force: true, recursive: true });
}

function parsePackDestination(args: string[]): string | null {
  if (args.length === 3) {
    return null;
  }

  if (args.length === 5 && args[3] === "--pack-destination") {
    return args[4];
  }

  stderr.write(
    "Usage: bun run scripts/release-public-packages.ts --dry-run|--publish [--pack-destination <directory>]\n",
  );
  exit(1);
}

async function readReleaseVersion(): Promise<string> {
  const versions = new Set<string>();
  for (const publicPackage of publicPackages) {
    const packageJson = await readPackageJson(
      join(rootDirectory, publicPackage.directory, "package.json"),
    );
    versions.add(packageJson.version);
  }

  if (versions.size !== 1) {
    throw new Error("Public package versions must match before release");
  }

  const [version] = [...versions];
  if (version === undefined) {
    throw new Error("No public package version found");
  }
  return version;
}

async function stagePackage(
  publicPackage: PublicPackage,
  version: string,
): Promise<string> {
  const sourceDirectory = join(rootDirectory, publicPackage.directory);
  const targetDirectory = join(
    releaseDirectory,
    publicPackage.name.replace("/", "__"),
  );
  await mkdir(targetDirectory, { recursive: true });

  await copyDirectory(
    join(sourceDirectory, "dist"),
    join(targetDirectory, "dist"),
  );
  await copyFile(
    join(sourceDirectory, "README.md"),
    join(targetDirectory, "README.md"),
  );
  await copyFile(
    join(sourceDirectory, "LICENSE"),
    join(targetDirectory, "LICENSE"),
  );

  const packageJson = await readPackageJson(
    join(sourceDirectory, "package.json"),
  );
  packageJson.version = version;
  packageJson.dependencies = rewriteWorkspaceDependencies(
    packageJson.dependencies,
    version,
  );
  packageJson.scripts = undefined;
  await writeFile(
    join(targetDirectory, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );

  const serializedPackageJson = await readFile(
    join(targetDirectory, "package.json"),
    "utf8",
  );
  if (serializedPackageJson.includes("workspace:*")) {
    throw new Error(`${publicPackage.name} still contains workspace:*`);
  }

  return targetDirectory;
}

function rewriteWorkspaceDependencies(
  inputDependencies: Record<string, string> | undefined,
  version: string,
): Record<string, string> | undefined {
  if (inputDependencies === undefined) {
    return undefined;
  }

  const dependencies: Record<string, string> = {};
  for (const [dependencyName, dependencyVersion] of Object.entries(
    inputDependencies,
  )) {
    if (dependencyVersion === "workspace:*") {
      dependencies[dependencyName] = version;
    } else {
      dependencies[dependencyName] = dependencyVersion;
    }
  }
  return dependencies;
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  const entries = new Bun.Glob("**/*").scan({
    absolute: false,
    cwd: source,
    onlyFiles: true,
  });

  for await (const entry of entries) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

function packDryRun(stagedDirectory: string): PackResult {
  const result = runCapture(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts", stagedDirectory],
    rootDirectory,
  );
  const parsed = JSON.parse(result) as PackResult[];
  const [packResult] = parsed;
  if (packResult === undefined) {
    throw new Error(`No npm pack result for ${stagedDirectory}`);
  }
  return packResult;
}

function validatePackResult(
  publicPackage: PublicPackage,
  packResult: PackResult,
): void {
  if (packResult.name !== publicPackage.name) {
    throw new Error(
      `Packed ${packResult.name} instead of ${publicPackage.name}`,
    );
  }

  const paths = packResult.files.map((file) => file.path);
  if (!paths.includes("dist/index.js")) {
    throw new Error(`${publicPackage.name} is missing dist/index.js`);
  }
  if (!paths.includes("dist/index.d.ts")) {
    throw new Error(`${publicPackage.name} is missing dist/index.d.ts`);
  }

  for (const path of paths) {
    if (path.includes(".test.")) {
      throw new Error(`${publicPackage.name} published a test file: ${path}`);
    }
    if (path.startsWith("src/")) {
      throw new Error(`${publicPackage.name} published a source file: ${path}`);
    }
  }
}

function publishPackage(stagedDirectory: string): void {
  const args = hasTokenAuth
    ? ["publish", stagedDirectory, "--access", "public", "--provenance"]
    : ["publish", stagedDirectory];
  run("npm", args, rootDirectory);
}

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, "utf8")) as PackageJson;
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

function runCapture(
  command: string,
  args: string[],
  workingDirectory: string,
): string {
  const result = spawnSync(command, args, {
    cwd: workingDirectory,
    encoding: "utf8",
    env: process.env,
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status === null) {
    throw new Error(`${command} exited without a status`);
  }

  if (result.status !== 0) {
    stderr.write(result.stderr);
    exit(result.status);
  }

  return result.stdout;
}
