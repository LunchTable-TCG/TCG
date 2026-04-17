import { buildWalletChallengeMessage as buildSharedWalletChallengeMessage } from "@lunchtable/shared-types";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import {
  AUTH_CHAIN_ID,
  buildWalletChallengeMessage,
  createWalletChallengeRecord,
  normalizeAddress,
  normalizeEmail,
  normalizeSignature,
  normalizeUsername,
  parseUserSubject,
  verifyWalletChallengeSignature,
} from "../convex/lib/walletAuth";

describe("convex wallet auth helpers", () => {
  it("normalizes email, username, and address", () => {
    const signature = `0x${"A".repeat(130)}`;

    expect(normalizeEmail("  Test@Example.com ")).toBe("test@example.com");
    expect(normalizeUsername("Table_Mage")).toBe("table_mage");
    expect(normalizeAddress("0xAbCdefabcdefabcdefabcdefabcdefabcdefabcd")).toBe(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    );
    expect(normalizeSignature(`  ${signature}  `)).toBe(`0x${"a".repeat(130)}`);
    expect(() => normalizeSignature("0x1234")).toThrow(
      "Invalid wallet signature",
    );
  });

  it("normalizes and validates wallet signatures", () => {
    const rawSignature = ` 0x${"a".repeat(130)} `;
    expect(normalizeSignature(rawSignature)).toBe(`0x${"a".repeat(130)}`);
    expect(() => normalizeSignature("0x1234")).toThrow(
      "Invalid wallet signature",
    );
  });

  it("creates a bounded challenge record", () => {
    const challenge = createWalletChallengeRecord({
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      domain: "lunchtable.gg",
      email: "test@example.com",
      now: Date.UTC(2026, 3, 3, 0, 0, 0),
      purpose: "signup",
      statement: "Create your Lunch-Table account.",
      uri: "https://lunchtable.gg/signup",
      username: "tablemage",
    });

    expect(challenge.chainId).toBe(AUTH_CHAIN_ID);
    expect(challenge.expiresAt).toBe(Date.UTC(2026, 3, 3, 0, 5, 0));
    expect(challenge.message).toContain("Chain ID: 56");
    expect(challenge.message).toContain("Username: tablemage");
    expect(challenge.message).toContain("Email: test@example.com");
  });

  it("parses wallet subjects", () => {
    expect(parseUserSubject("user:abc123")).toBe("abc123");
    expect(() => parseUserSubject("wallet:abc123")).toThrow(
      "Invalid auth subject",
    );
  });

  it("builds a deterministic raw challenge message", () => {
    const input = {
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      domain: "lunchtable.gg",
      issuedAt: "2026-04-03T00:00:00.000Z",
      nonce: "nonce-xyz",
      statement: "Sign in to your Lunch-Table account.",
      uri: "https://lunchtable.gg/login",
      username: "tablemage",
    } as const;
    const message = buildWalletChallengeMessage(input);

    expect(message).toContain("nonce-xyz");
    expect(message).toContain("Sign in to your Lunch-Table account.");
    expect(message).toBe(buildSharedWalletChallengeMessage(input));
  });

  it("verifies a signed wallet challenge against the expected address", async () => {
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945381d1b8e75d6d6f4a5fb5e6dbf1d6bdbf14",
    );
    const message = buildWalletChallengeMessage({
      address: account.address,
      domain: "lunchtable.gg",
      email: "wizard@example.com",
      issuedAt: "2026-04-03T00:00:00.000Z",
      nonce: "nonce-signature-check",
      statement: "Sign in to your Lunch-Table account.",
      uri: "https://lunchtable.gg/login",
      username: "tablemage",
    });
    const signature = await account.signMessage({ message });

    await expect(
      verifyWalletChallengeSignature({
        address: account.address,
        message,
        signature,
      }),
    ).resolves.toBe(true);

    await expect(
      verifyWalletChallengeSignature({
        address: "0x1111111111111111111111111111111111111111",
        message,
        signature,
      }),
    ).resolves.toBe(false);
  });
});
