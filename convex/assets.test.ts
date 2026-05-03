/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { type TestConvex, convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const elizaApiKeyEnv = "ELIZA_CLOUD_API_KEY";

async function seedHumanSeat(
  t: TestConvex<typeof schema>,
  input: {
    address: `0x${string}`;
    email: string;
    username: string;
  },
) {
  const now = Date.UTC(2026, 4, 3, 12, 30, 0);

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

    return { userId };
  });
}

afterEach(() => {
  delete process.env[elizaApiKeyEnv];
  vi.unstubAllGlobals();
});

describe("generated game assets backend", () => {
  it("rejects live generation when the elizaOS Cloud key is missing", async () => {
    const t = convexTest({ modules, schema });
    const { userId } = await seedHumanSeat(t, {
      address: "0x1111111111111111111111111111111111111111",
      email: "artist@example.com",
      username: "asset_artist",
    });
    const viewer = t.withIdentity({ subject: `user:${userId}` });

    await expect(
      viewer.action(api.assets.generateSideScrollerAsset, {
        name: "Runner",
        prompt: "pixel art runner sprite sheet",
      }),
    ).rejects.toThrow(
      "Missing required environment variable: ELIZA_CLOUD_API_KEY",
    );
  });

  it("stores generated side-scroller assets and returns owned asset URLs", async () => {
    process.env[elizaApiKeyEnv] = "cloud-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          images: [
            { image: "aW1hZ2U=", url: "https://assets.example/out.png" },
          ],
        }),
        ok: true,
        status: 200,
      })),
    );

    const t = convexTest({ modules, schema });
    const { userId } = await seedHumanSeat(t, {
      address: "0x2222222222222222222222222222222222222222",
      email: "artist@example.com",
      username: "asset_artist",
    });
    const viewer = t.withIdentity({ subject: `user:${userId}` });

    const generated = await viewer.action(
      api.assets.generateSideScrollerAsset,
      {
        name: "Runner",
        prompt: "pixel art runner sprite sheet",
      },
    );
    const assets = await viewer.query(api.assets.listMine, {});
    const urlResult = await viewer.query(api.assets.getUrl, {
      assetId: generated.id,
    });
    const archived = await viewer.mutation(api.assets.archive, {
      assetId: generated.id,
    });

    expect(generated).toMatchObject({
      name: "Runner",
      prompt: "pixel art runner sprite sheet",
      source: "generated",
      status: "active",
    });
    expect(assets).toHaveLength(1);
    expect(urlResult.url).toMatch(/^https?:\/\//);
    expect(archived.status).toBe("archived");
  });
});
