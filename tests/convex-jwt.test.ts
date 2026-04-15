import { afterEach, describe, expect, it } from "vitest";

import { buildJwksDataUri } from "../convex/lib/jwt";

const envKeys = [
  "JWT_AUDIENCE",
  "JWT_ISSUER",
  "JWT_KEY_ID",
  "JWT_PUBLIC_JWK_JSON",
] as const;

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }
});

describe("convex JWT helpers", () => {
  it("builds a jwks data uri and injects the configured kid", () => {
    process.env.JWT_AUDIENCE = "lunchtable-web";
    process.env.JWT_ISSUER = "https://auth.lunchtable.invalid";
    process.env.JWT_KEY_ID = "kid-123";
    process.env.JWT_PUBLIC_JWK_JSON = JSON.stringify({
      crv: "P-256",
      kty: "EC",
      x: "test-x",
      y: "test-y",
    });

    const uri = buildJwksDataUri();
    const payload: {
      keys: Array<{ kid?: string }>;
    } = JSON.parse(
      decodeURIComponent(uri.slice("data:application/json,".length)),
    );

    expect(payload.keys).toHaveLength(1);
    expect(payload.keys[0]?.kid).toBe("kid-123");
  });

  it("rejects non-object jwks json", () => {
    process.env.JWT_AUDIENCE = "lunchtable-web";
    process.env.JWT_ISSUER = "https://auth.lunchtable.invalid";
    process.env.JWT_PUBLIC_JWK_JSON = "[]";

    expect(() => buildJwksDataUri()).toThrow(
      "JWT public JWK must be a JSON object",
    );
  });
});
