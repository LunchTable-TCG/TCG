import { afterEach, describe, expect, it } from "vitest";

import { isOperatorUser } from "../convex/lib/viewer";

const operatorAllowlistEnv = "OPERATOR_EMAIL_ALLOWLIST";

afterEach(() => {
  delete process.env[operatorAllowlistEnv];
});

describe("isOperatorUser", () => {
  it("matches exact email entries", () => {
    process.env[operatorAllowlistEnv] = "operator@example.com";

    expect(
      isOperatorUser({
        emailNormalized: "operator@example.com",
      } as never),
    ).toBe(true);
    expect(
      isOperatorUser({
        emailNormalized: "player@example.com",
      } as never),
    ).toBe(false);
  });

  it("matches domain suffix entries that start with @", () => {
    process.env[operatorAllowlistEnv] = "@example.com";

    expect(
      isOperatorUser({
        emailNormalized: "operator-123@example.com",
      } as never),
    ).toBe(true);
    expect(
      isOperatorUser({
        emailNormalized: "operator@example.org",
      } as never),
    ).toBe(false);
  });
});
