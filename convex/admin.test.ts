/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { starterFormat } from "@lunchtable/card-content";
import { type TestConvex, convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const operatorAllowlistEnv = "OPERATOR_EMAIL_ALLOWLIST";

function createStarterDeckEntries() {
  return starterFormat.cardPool.map((card) => ({
    cardId: card.id,
    count: starterFormat.deckRules.maxCopies,
  }));
}

async function seedHumanSeat(
  t: TestConvex<typeof schema>,
  input: {
    address: `0x${string}`;
    email: string;
    username: string;
  },
) {
  const now = Date.UTC(2026, 3, 3, 12, 30, 0);

  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      actorType: "human",
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
      status: "active",
      updatedAt: now,
      username: input.username,
      usernameNormalized: input.username.toLowerCase(),
    });
    const walletId = await ctx.db.insert("wallets", {
      address: input.address,
      addressNormalized: input.address.toLowerCase(),
      chainId: 56,
      custodyModel: "self-custodied",
      userId,
      walletType: "evm-local",
    });

    await ctx.db.patch(userId, {
      primaryWalletId: walletId,
    });

    return {
      userId,
    };
  });
}

afterEach(() => {
  delete process.env[operatorAllowlistEnv];
});

describe("admin backend", () => {
  it("rejects non-operator viewers from format controls", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x3333333333333333333333333333333333333333",
      email: "player@example.com",
      username: "player_one",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    process.env[operatorAllowlistEnv] = "operator@example.com";

    await expect(
      viewer.query(api.admin.listFormatSettings, {}),
    ).rejects.toThrow("Operator access required");
  });

  it("normalizes runtime format overrides and blocks unpublished play", async () => {
    const t = convexTest({
      modules,
      schema,
    });
    const { userId } = await seedHumanSeat(t, {
      address: "0x4444444444444444444444444444444444444444",
      email: "operator@example.com",
      username: "table_operator",
    });
    const viewer = t.withIdentity({
      subject: `user:${userId}`,
    });

    process.env[operatorAllowlistEnv] = "operator@example.com";

    const deck = await viewer.mutation(api.decks.create, {
      formatId: starterFormat.formatId,
      mainboard: createStarterDeckEntries(),
      name: "Operator Starter",
      sideboard: [],
    });
    const updated = await viewer.mutation(api.admin.updateFormatSettings, {
      bannedCardIds: ["mirror-warden", "unknown-card", "mirror-warden"],
      formatId: starterFormat.formatId,
      isPublished: true,
    });
    const bannedCatalog = await viewer.query(api.cards.listCatalog, {
      formatId: starterFormat.formatId,
    });
    const unpublished = await viewer.mutation(api.admin.updateFormatSettings, {
      bannedCardIds: [],
      formatId: starterFormat.formatId,
      isPublished: false,
    });
    const settings = await viewer.query(api.admin.listFormatSettings, {});
    const catalog = await viewer.query(api.cards.listCatalog, {
      formatId: starterFormat.formatId,
    });
    const viewerIdentity = await viewer.query(api.viewer.get, {});

    expect(updated.bannedCardIds).toEqual(["mirror-warden"]);
    expect(updated.isPublished).toBe(true);
    expect(unpublished.bannedCardIds).toEqual([]);
    expect(unpublished.isPublished).toBe(false);
    expect(settings).toEqual([unpublished]);
    expect(
      bannedCatalog.find((card) => card.cardId === "mirror-warden")?.isBanned,
    ).toBe(true);
    expect(
      catalog.find((card) => card.cardId === "mirror-warden")?.isBanned,
    ).toBe(false);
    expect(viewerIdentity?.isOperator).toBe(true);
    await expect(
      viewer.mutation(api.matches.createPractice, {
        deckId: deck.id,
      }),
    ).rejects.toThrow("not currently published");
  });
});
