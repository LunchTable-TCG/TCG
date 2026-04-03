import { describe, expect, it } from "vitest";

import {
  BSC_CHAIN_ID,
  buildSignupChallengeMessage,
  createLocalBscWallet,
  importLocalBscWallet,
  normalizePrivateKey,
  signChallenge,
  verifyChallengeSignature,
} from "../apps/web/src/auth";

describe("wallet auth helpers", () => {
  it("creates a local BSC wallet", () => {
    const wallet = createLocalBscWallet();

    expect(wallet.chainId).toBe(BSC_CHAIN_ID);
    expect(wallet.address.startsWith("0x")).toBe(true);
    expect(wallet.privateKey.length).toBe(66);
  });

  it("imports a wallet from a raw private key", () => {
    const original = createLocalBscWallet();
    const imported = importLocalBscWallet(original.privateKey.slice(2));

    expect(imported.address).toBe(original.address);
    expect(imported.privateKey).toBe(original.privateKey);
  });

  it("rejects malformed private keys", () => {
    expect(() => normalizePrivateKey("abc123")).toThrow(
      "Invalid private key format",
    );
  });

  it("builds a signup challenge with BSC chain id and identity fields", () => {
    const wallet = createLocalBscWallet();
    const message = buildSignupChallengeMessage({
      address: wallet.address,
      domain: "lunchtable.gg",
      email: "test@example.com",
      issuedAt: "2026-04-03T00:00:00.000Z",
      nonce: "nonce-123",
      statement: "Create your Lunch-Table account.",
      uri: "https://lunchtable.gg/signup",
      username: "tablemage",
    });

    expect(message).toContain(wallet.address);
    expect(message).toContain("Chain ID: 56");
    expect(message).toContain("Username: tablemage");
    expect(message).toContain("Email: test@example.com");
  });

  it("signs and verifies a challenge locally", async () => {
    const wallet = createLocalBscWallet();
    const message = buildSignupChallengeMessage({
      address: wallet.address,
      domain: "lunchtable.gg",
      issuedAt: "2026-04-03T00:00:00.000Z",
      nonce: "nonce-verify",
      statement: "Sign in to Lunch-Table.",
      uri: "https://lunchtable.gg/login",
    });

    const signature = await signChallenge(wallet.privateKey, message);
    const verified = await verifyChallengeSignature({
      address: wallet.address,
      message,
      signature,
    });

    expect(verified).toBe(true);
  });
});
