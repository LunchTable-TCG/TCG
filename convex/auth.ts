import type {
  WalletAuthSession,
  WalletChallengePurpose,
  WalletChallengeResponse,
} from "@lunchtable/shared-types";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { issueWalletAuthToken } from "./lib/jwt";
import { ensureStarterCollectionEntries } from "./lib/library";
import { recordTelemetryEvent } from "./lib/telemetry";
import {
  AUTH_CHAIN_ID,
  createWalletChallengeRecord,
  normalizeAddress,
  normalizeEmail,
  normalizeSignature,
  normalizeUsername,
  verifyWalletChallengeSignature,
} from "./lib/walletAuth";

function getAuthPresentationConfig() {
  return {
    domain: process.env.AUTH_DOMAIN ?? "lunchtable.gg",
    uri: process.env.AUTH_URI ?? "https://lunchtable.gg",
  };
}

async function findUserByEmail(ctx: MutationCtx, emailNormalized: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (query) =>
      query.eq("emailNormalized", emailNormalized),
    )
    .unique();
}

async function findUserByUsername(
  ctx: MutationCtx,
  usernameNormalized: string,
) {
  return ctx.db
    .query("users")
    .withIndex("by_username", (query) =>
      query.eq("usernameNormalized", usernameNormalized),
    )
    .unique();
}

async function findWalletByAddress(
  ctx: MutationCtx,
  addressNormalized: string,
) {
  return ctx.db
    .query("wallets")
    .withIndex("by_address", (query) =>
      query.eq("addressNormalized", addressNormalized),
    )
    .unique();
}

async function recordAudit(
  ctx: MutationCtx,
  input: {
    failureCode?: string;
    purpose: Extract<WalletChallengePurpose, "signup" | "login">;
    success: boolean;
    userId?: Id<"users">;
    walletId?: Id<"wallets">;
  },
) {
  await ctx.db.insert("authAudits", {
    failureCode: input.failureCode,
    purpose: input.purpose,
    success: input.success,
    userId: input.userId,
    walletId: input.walletId,
  });
}

interface WalletAuthCompletionRecord {
  address: `0x${string}`;
  chainId: typeof AUTH_CHAIN_ID;
  email: string;
  userId: Id<"users">;
  username: string;
}

export const requestSignupChallenge = mutation({
  args: {
    address: v.string(),
    email: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args): Promise<WalletChallengeResponse> => {
    const emailNormalized = normalizeEmail(args.email);
    const usernameNormalized = normalizeUsername(args.username);
    const address = normalizeAddress(args.address);
    const addressNormalized = address.toLowerCase();

    const [existingEmail, existingUsername, existingWallet] = await Promise.all(
      [
        findUserByEmail(ctx, emailNormalized),
        findUserByUsername(ctx, usernameNormalized),
        findWalletByAddress(ctx, addressNormalized),
      ],
    );

    if (existingEmail) {
      throw new Error("Email is already registered");
    }
    if (existingUsername) {
      throw new Error("Username is already registered");
    }
    if (existingWallet) {
      throw new Error("Wallet is already registered");
    }

    const presentation = getAuthPresentationConfig();
    const challenge = createWalletChallengeRecord({
      address,
      domain: presentation.domain,
      email: args.email.trim(),
      purpose: "signup",
      statement: "Create your Lunch-Table account.",
      uri: `${presentation.uri}/signup`,
      username: args.username.trim(),
    });

    const challengeId = await ctx.db.insert("walletChallenges", {
      address: challenge.address,
      addressNormalized: challenge.addressNormalized,
      chainId: challenge.chainId,
      emailSnapshot: args.email.trim(),
      expiresAt: challenge.expiresAt,
      issuedAt: challenge.issuedAt,
      message: challenge.message,
      nonce: challenge.nonce,
      purpose: "signup",
      usernameSnapshot: args.username.trim(),
    });

    return {
      address: challenge.address,
      chainId: AUTH_CHAIN_ID,
      challengeId,
      expiresAt: challenge.expiresAt,
      message: challenge.message,
      nonce: challenge.nonce,
    };
  },
});

export const requestLoginChallenge = mutation({
  args: {
    address: v.string(),
  },
  handler: async (ctx, args): Promise<WalletChallengeResponse> => {
    const address = normalizeAddress(args.address);
    const wallet = await findWalletByAddress(ctx, address.toLowerCase());

    if (!wallet) {
      throw new Error("Wallet not registered");
    }

    const user = await ctx.db.get(wallet.userId);
    const presentation = getAuthPresentationConfig();
    const challenge = createWalletChallengeRecord({
      address,
      domain: presentation.domain,
      email: user?.email,
      purpose: "login",
      statement: "Sign in to your Lunch-Table account.",
      uri: `${presentation.uri}/login`,
      username: user?.username,
    });

    const challengeId = await ctx.db.insert("walletChallenges", {
      address: challenge.address,
      addressNormalized: challenge.addressNormalized,
      chainId: challenge.chainId,
      emailSnapshot: user?.email,
      expiresAt: challenge.expiresAt,
      issuedAt: challenge.issuedAt,
      message: challenge.message,
      nonce: challenge.nonce,
      purpose: "login",
      usernameSnapshot: user?.username,
    });

    return {
      address: challenge.address,
      chainId: AUTH_CHAIN_ID,
      challengeId,
      expiresAt: challenge.expiresAt,
      message: challenge.message,
      nonce: challenge.nonce,
    };
  },
});

export const completeWalletSignupTransaction = internalMutation({
  args: {
    challengeId: v.id("walletChallenges"),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.purpose !== "signup") {
      throw new Error("Invalid signup challenge");
    }
    if (challenge.consumedAt) {
      throw new Error("Challenge already used");
    }
    if (challenge.expiresAt < Date.now()) {
      throw new Error("Challenge expired");
    }

    const verified = await verifyWalletChallengeSignature({
      address: normalizeAddress(challenge.address),
      message: challenge.message,
      signature: normalizeSignature(args.signature),
    });

    if (!verified) {
      await recordAudit(ctx, {
        failureCode: "invalid_signature",
        purpose: "signup",
        success: false,
      });
      throw new Error("Invalid wallet signature");
    }

    const email = challenge.emailSnapshot;
    const username = challenge.usernameSnapshot;
    if (!email || !username) {
      throw new Error("Challenge is missing signup identity");
    }

    const emailNormalized = normalizeEmail(email);
    const usernameNormalized = normalizeUsername(username);
    const address = normalizeAddress(challenge.address);
    const addressNormalized = address.toLowerCase();

    const [existingEmail, existingUsername, existingWallet] = await Promise.all(
      [
        findUserByEmail(ctx, emailNormalized),
        findUserByUsername(ctx, usernameNormalized),
        findWalletByAddress(ctx, addressNormalized),
      ],
    );

    if (existingEmail || existingUsername || existingWallet) {
      throw new Error("Signup identity already exists");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      actorType: "human",
      email,
      emailNormalized,
      status: "active",
      updatedAt: now,
      username,
      usernameNormalized,
    });

    const walletId = await ctx.db.insert("wallets", {
      address,
      addressNormalized,
      chainId: AUTH_CHAIN_ID,
      custodyModel: "self-custodied",
      lastAuthenticatedAt: now,
      userId,
      walletType: "evm-local",
    });

    await ctx.db.patch(userId, {
      primaryWalletId: walletId,
      updatedAt: now,
    });
    await ensureStarterCollectionEntries(ctx.db, userId, now);
    await ctx.db.patch(args.challengeId, { consumedAt: now });
    await recordAudit(ctx, {
      purpose: "signup",
      success: true,
      userId,
      walletId,
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      name: "auth.signup.completed",
      tags: {
        actorType: "human",
        walletType: "evm-local",
      },
      userId,
    });

    return {
      address,
      chainId: AUTH_CHAIN_ID,
      email,
      userId,
      username,
    };
  },
});

export const completeWalletSignup = action({
  args: {
    challengeId: v.id("walletChallenges"),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<WalletAuthSession> => {
    const result: WalletAuthCompletionRecord = await ctx.runMutation(
      internal.auth.completeWalletSignupTransaction,
      args,
    );
    const token = await issueWalletAuthToken({
      email: result.email,
      userId: result.userId,
      username: result.username,
      walletAddress: result.address,
    });

    return {
      address: result.address,
      chainId: result.chainId,
      token,
      userId: result.userId,
      username: result.username,
    };
  },
});

export const completeWalletLoginTransaction = internalMutation({
  args: {
    challengeId: v.id("walletChallenges"),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.purpose !== "login") {
      throw new Error("Invalid login challenge");
    }
    if (challenge.consumedAt) {
      throw new Error("Challenge already used");
    }
    if (challenge.expiresAt < Date.now()) {
      throw new Error("Challenge expired");
    }

    const address = normalizeAddress(challenge.address);
    const verified = await verifyWalletChallengeSignature({
      address,
      message: challenge.message,
      signature: normalizeSignature(args.signature),
    });

    if (!verified) {
      await recordAudit(ctx, {
        failureCode: "invalid_signature",
        purpose: "login",
        success: false,
      });
      throw new Error("Invalid wallet signature");
    }

    const wallet = await findWalletByAddress(ctx, address.toLowerCase());
    if (!wallet) {
      throw new Error("Wallet not registered");
    }
    const user = await ctx.db.get(wallet.userId);
    if (!user) {
      throw new Error("User record missing");
    }

    const now = Date.now();
    await ensureStarterCollectionEntries(ctx.db, user._id, now);
    await ctx.db.patch(wallet._id, { lastAuthenticatedAt: now });
    await ctx.db.patch(args.challengeId, { consumedAt: now });
    await recordAudit(ctx, {
      purpose: "login",
      success: true,
      userId: user._id,
      walletId: wallet._id,
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      name: "auth.login.completed",
      tags: {
        actorType: user.actorType ?? "human",
        walletType: wallet.walletType,
      },
      userId: user._id,
    });

    return {
      address,
      chainId: AUTH_CHAIN_ID,
      email: user.email,
      userId: user._id,
      username: user.username,
    };
  },
});

export const completeWalletLogin = action({
  args: {
    challengeId: v.id("walletChallenges"),
    signature: v.string(),
  },
  handler: async (ctx, args): Promise<WalletAuthSession> => {
    const result: WalletAuthCompletionRecord = await ctx.runMutation(
      internal.auth.completeWalletLoginTransaction,
      args,
    );
    const token = await issueWalletAuthToken({
      email: result.email,
      userId: result.userId,
      username: result.username,
      walletAddress: result.address,
    });

    return {
      address: result.address,
      chainId: result.chainId,
      token,
      userId: result.userId,
      username: result.username,
    };
  },
});
