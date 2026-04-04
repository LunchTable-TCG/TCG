import type { WalletAuthTransport } from "../apps/web/src/convex/api";

import {
  BSC_CHAIN_ID,
  type UserId,
  type WalletChallengeId,
  buildWalletChallengeMessage,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";

import {
  loadViewerIdentity,
  signInWithPrivateKey,
  signUpWithGeneratedWallet,
  verifyChallengeSignature,
} from "../apps/web/src/auth";
import { createLocalBscWallet } from "../apps/web/src/auth/wallet";

describe("wallet auth service", () => {
  const challengeIdSignup = "challenge_signup" as WalletChallengeId;
  const challengeIdLogin = "challenge_login" as WalletChallengeId;
  const userIdSignup = "user_signup" as UserId;
  const userIdLogin = "user_login" as UserId;
  const viewerId = "user_123" as UserId;

  it("signs up with a generated wallet and never sends the private key", async () => {
    let signupArgs:
      | {
          address: `0x${string}`;
          email: string;
          username: string;
        }
      | undefined;
    let completeArgs:
      | {
          challengeId: WalletChallengeId;
          signature: `0x${string}`;
        }
      | undefined;
    let challengeMessage = "";

    const transport: WalletAuthTransport = {
      async completeWalletLogin() {
        throw new Error("unused");
      },
      async completeWalletSignup(args) {
        completeArgs = args;
        if (!signupArgs) {
          throw new Error("signup args missing");
        }
        return {
          address: signupArgs.address,
          chainId: BSC_CHAIN_ID,
          token: "signup-token",
          userId: userIdSignup,
          username: signupArgs.username,
        };
      },
      async getViewer() {
        return null;
      },
      async requestLoginChallenge() {
        throw new Error("unused");
      },
      async requestSignupChallenge(args) {
        signupArgs = args;
        challengeMessage = buildWalletChallengeMessage({
          address: args.address,
          domain: "lunchtable.gg",
          email: args.email,
          issuedAt: "2026-04-03T00:00:00.000Z",
          nonce: "signup-nonce",
          statement: "Create your Lunch-Table account.",
          uri: "https://lunchtable.gg/signup",
          username: args.username,
        });

        return {
          address: args.address,
          chainId: BSC_CHAIN_ID,
          challengeId: challengeIdSignup,
          expiresAt: Date.UTC(2026, 3, 3, 0, 5, 0),
          message: challengeMessage,
          nonce: "signup-nonce",
        };
      },
    };

    const result = await signUpWithGeneratedWallet(transport, {
      email: "wizard@example.com",
      username: "tablemage",
    });

    expect(signupArgs).toEqual({
      address: result.wallet.address,
      email: "wizard@example.com",
      username: "tablemage",
    });
    expect(signupArgs).not.toHaveProperty("privateKey");
    expect(completeArgs).toEqual({
      challengeId: challengeIdSignup,
      signature: expect.stringMatching(/^0x[0-9a-f]+$/),
    });
    expect(completeArgs).not.toHaveProperty("privateKey");
    expect(result.session.token).toBe("signup-token");
    if (!completeArgs) {
      throw new Error("signup completion args missing");
    }

    const verified = await verifyChallengeSignature({
      address: result.wallet.address,
      message: challengeMessage,
      signature: completeArgs.signature,
    });

    expect(verified).toBe(true);
  });

  it("logs in with an imported private key and only sends address plus signature", async () => {
    const existingWallet = createLocalBscWallet();
    let loginArgs:
      | {
          address: `0x${string}`;
        }
      | undefined;
    let completeArgs:
      | {
          challengeId: WalletChallengeId;
          signature: `0x${string}`;
        }
      | undefined;
    let challengeMessage = "";

    const transport: WalletAuthTransport = {
      async completeWalletLogin(args) {
        completeArgs = args;
        return {
          address: existingWallet.address,
          chainId: BSC_CHAIN_ID,
          token: "login-token",
          userId: userIdLogin,
          username: "tablemage",
        };
      },
      async completeWalletSignup() {
        throw new Error("unused");
      },
      async getViewer() {
        return null;
      },
      async requestLoginChallenge(args) {
        loginArgs = args;
        challengeMessage = buildWalletChallengeMessage({
          address: args.address,
          domain: "lunchtable.gg",
          issuedAt: "2026-04-03T00:00:00.000Z",
          nonce: "login-nonce",
          statement: "Sign in to your Lunch-Table account.",
          uri: "https://lunchtable.gg/login",
          username: "tablemage",
        });

        return {
          address: args.address,
          chainId: BSC_CHAIN_ID,
          challengeId: challengeIdLogin,
          expiresAt: Date.UTC(2026, 3, 3, 0, 5, 0),
          message: challengeMessage,
          nonce: "login-nonce",
        };
      },
      async requestSignupChallenge() {
        throw new Error("unused");
      },
    };

    const result = await signInWithPrivateKey(
      transport,
      existingWallet.privateKey,
    );

    expect(loginArgs).toEqual({
      address: existingWallet.address,
    });
    expect(loginArgs).not.toHaveProperty("privateKey");
    expect(completeArgs).toEqual({
      challengeId: challengeIdLogin,
      signature: expect.stringMatching(/^0x[0-9a-f]+$/),
    });
    expect(result.wallet.address).toBe(existingWallet.address);
    expect(result.session.token).toBe("login-token");
    if (!completeArgs) {
      throw new Error("login completion args missing");
    }

    const verified = await verifyChallengeSignature({
      address: existingWallet.address,
      message: challengeMessage,
      signature: completeArgs.signature,
    });

    expect(verified).toBe(true);
  });

  it("loads the current viewer through the transport", async () => {
    const transport: WalletAuthTransport = {
      async completeWalletLogin() {
        throw new Error("unused");
      },
      async completeWalletSignup() {
        throw new Error("unused");
      },
      async getViewer() {
        return {
          email: "mage@example.com",
          id: viewerId,
          isOperator: false,
          username: "tablemage",
          walletAddress: "0xabc",
        };
      },
      async requestLoginChallenge() {
        throw new Error("unused");
      },
      async requestSignupChallenge() {
        throw new Error("unused");
      },
    };

    await expect(loadViewerIdentity(transport)).resolves.toEqual({
      email: "mage@example.com",
      id: viewerId,
      isOperator: false,
      username: "tablemage",
      walletAddress: "0xabc",
    });
  });
});
