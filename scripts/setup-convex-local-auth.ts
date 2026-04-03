import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { $ } from "bun";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const SHOULD_SYNC = process.argv.includes("--sync");

function parseEnv(text: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
}

function formatEnv(entries: Map<string, string>): string {
  const preferredOrder = [
    "CONVEX_DEPLOYMENT",
    "VITE_CONVEX_URL",
    "VITE_CONVEX_SITE_URL",
    "AUTH_DOMAIN",
    "AUTH_URI",
    "BOT_RUNNER_SECRET",
    "BOT_SLUG",
    "JWT_ISSUER",
    "JWT_AUDIENCE",
    "JWT_KEY_ID",
    "JWT_PRIVATE_KEY_PKCS8",
    "JWT_PUBLIC_JWK_JSON",
  ];

  const seen = new Set<string>();
  const lines: string[] = ["# Local Convex deployment"];

  for (const key of preferredOrder) {
    const value = entries.get(key);
    if (!value) {
      continue;
    }
    lines.push(`${key}=${value}`);
    seen.add(key);
  }

  for (const [key, value] of entries) {
    if (seen.has(key)) {
      continue;
    }
    lines.push(`${key}=${value}`);
  }

  return `${lines.join("\n")}\n`;
}

async function ensureJwtKeys(entries: Map<string, string>) {
  if (
    entries.has("JWT_PRIVATE_KEY_PKCS8") &&
    entries.has("JWT_PUBLIC_JWK_JSON")
  ) {
    return;
  }

  const keyId = entries.get("JWT_KEY_ID") ?? "lunchtable-local-es256";
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const privateKeyPkcs8 = await exportPKCS8(privateKey);
  const publicJwk = await exportJWK(publicKey);

  entries.set("JWT_KEY_ID", keyId);
  entries.set("JWT_PRIVATE_KEY_PKCS8", privateKeyPkcs8.replaceAll("\n", "\\n"));
  entries.set(
    "JWT_PUBLIC_JWK_JSON",
    JSON.stringify({
      ...publicJwk,
      kid: keyId,
      use: "sig",
    }),
  );
}

async function syncConvexEnv(entries: Map<string, string>) {
  const tempDirectory = await mkdtemp(
    path.join(tmpdir(), "lunchtable-convex-env-"),
  );
  const envFile = path.join(tempDirectory, ".env");
  const keys = [
    "AUTH_DOMAIN",
    "AUTH_URI",
    "BOT_RUNNER_SECRET",
    "JWT_ISSUER",
    "JWT_AUDIENCE",
    "JWT_KEY_ID",
    "JWT_PRIVATE_KEY_PKCS8",
    "JWT_PUBLIC_JWK_JSON",
  ];
  const payload = keys
    .map((key) => `${key}=${entries.get(key) ?? ""}`)
    .join("\n");

  await writeFile(envFile, `${payload}\n`, "utf8");

  try {
    await $`bunx convex env set --from-file ${envFile}`;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

async function main() {
  const rawText = existsSync(ENV_PATH) ? await readFile(ENV_PATH, "utf8") : "";
  const entries = parseEnv(rawText);
  const siteUrl =
    entries.get("VITE_CONVEX_SITE_URL") ?? "http://127.0.0.1:3211";
  const site = new URL(siteUrl);

  entries.set("AUTH_DOMAIN", entries.get("AUTH_DOMAIN") ?? site.host);
  entries.set("AUTH_URI", entries.get("AUTH_URI") ?? siteUrl);
  entries.set(
    "BOT_RUNNER_SECRET",
    entries.get("BOT_RUNNER_SECRET") ?? "lunchtable-local-runner-secret",
  );
  entries.set("BOT_SLUG", entries.get("BOT_SLUG") ?? "table-bot");
  entries.set(
    "JWT_ISSUER",
    entries.get("JWT_ISSUER") ?? "https://auth.lunchtable.local",
  );
  entries.set("JWT_AUDIENCE", entries.get("JWT_AUDIENCE") ?? "lunchtable-web");

  await ensureJwtKeys(entries);
  await writeFile(ENV_PATH, formatEnv(entries), "utf8");

  if (SHOULD_SYNC) {
    await syncConvexEnv(entries);
  }

  console.log(`Updated ${ENV_PATH}`);
  if (SHOULD_SYNC) {
    console.log("Synced local auth variables to the Convex dev deployment.");
  } else {
    console.log(
      "Run `bun run setup:convex-auth-local --sync` to push auth vars to Convex.",
    );
  }
}

await main();
