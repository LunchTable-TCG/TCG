import { afterEach, describe, expect, it } from "vitest";

import { buildJwksDataUri } from "../convex/lib/jwt";

const ORIGINAL_JWT_AUDIENCE = process.env.JWT_AUDIENCE;
const ORIGINAL_JWT_ISSUER = process.env.JWT_ISSUER;
const ORIGINAL_JWT_KEY_ID = process.env.JWT_KEY_ID;
const ORIGINAL_JWT_PUBLIC_JWK_JSON = process.env.JWT_PUBLIC_JWK_JSON;

function restoreJwtEnv() {
  process.env.JWT_AUDIENCE = ORIGINAL_JWT_AUDIENCE;
  process.env.JWT_ISSUER = ORIGINAL_JWT_ISSUER;
  process.env.JWT_KEY_ID = ORIGINAL_JWT_KEY_ID;
  process.env.JWT_PUBLIC_JWK_JSON = ORIGINAL_JWT_PUBLIC_JWK_JSON;
}

function decodeDataUriJson<T>(uri: string): T {
  const prefix = "data:application/json,";
  expect(uri.startsWith(prefix)).toBe(true);
  return JSON.parse(decodeURIComponent(uri.slice(prefix.length))) as T;
}

describe("convex jwt helpers", () => {
  afterEach(() => {
    restoreJwtEnv();
  });

  it("adds the configured key id to a parsed public jwk", () => {
    process.env.JWT_AUDIENCE = "lunchtable";
    process.env.JWT_ISSUER = "https://lunchtable.gg";
    process.env.JWT_KEY_ID = "kid_123";
    process.env.JWT_PUBLIC_JWK_JSON = JSON.stringify({
      crv: "P-256",
      kty: "EC",
      x: "abc",
      y: "def",
    });

    const jwks = decodeDataUriJson<{ keys: Array<{ kid?: string }> }>(
      buildJwksDataUri(),
    );

    expect(jwks.keys[0]?.kid).toBe("kid_123");
  });

  it("rejects malformed public jwk payloads", () => {
    process.env.JWT_AUDIENCE = "lunchtable";
    process.env.JWT_ISSUER = "https://lunchtable.gg";
    process.env.JWT_PUBLIC_JWK_JSON = JSON.stringify({
      x: "abc",
    });

    expect(() => buildJwksDataUri()).toThrow(
      "Invalid JWT public JWK JSON payload",
    );
  });
});
