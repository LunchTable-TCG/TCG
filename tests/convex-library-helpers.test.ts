import { starterFormat } from "@lunchtable/card-content";
import { describe, expect, it } from "vitest";

import {
  buildCollectionSummary,
  createFormatRuntime,
  listCatalogEntries,
  validateDeckForUserCollection,
} from "../convex/lib/library";
import { buildStarterDeck } from "./helpers/starterDeck";

describe("convex library helpers", () => {
  it("falls back to the seeded starter collection when no collection docs exist", () => {
    const runtime = createFormatRuntime(starterFormat.formatId);
    const summary = buildCollectionSummary(runtime, []);

    expect(summary.formatId).toBe(starterFormat.formatId);
    expect(summary.entries).toHaveLength(12);
    expect(summary.totalUniqueCards).toBe(12);
    expect(summary.totalOwnedCards).toBe(48);
  });

  it("validates the default starter deck against the starter collection grant", () => {
    const runtime = createFormatRuntime(starterFormat.formatId);
    const starterDeck = buildStarterDeck();
    const validation = validateDeckForUserCollection({
      collectionEntries: [],
      mainboard: starterDeck.mainboard,
      runtime,
      sideboard: [],
    });

    expect(validation.isLegal).toBe(true);
    expect(validation.mainboardCount).toBe(48);
  });

  it("marks banned cards in the runtime catalog and deck validation", () => {
    const runtime = createFormatRuntime(starterFormat.formatId, {
      banList: ["mirror-warden"],
    });
    const catalog = listCatalogEntries(runtime);
    const starterDeck = buildStarterDeck();
    const starterCopyCount = starterDeck.mainboard[0]?.count ?? 0;
    const validation = validateDeckForUserCollection({
      collectionEntries: [],
      mainboard: [
        {
          cardId: "mirror-warden",
          count: 1,
        },
        ...catalog
          .filter((card) => card.cardId !== "mirror-warden")
          .map((card) => ({
            cardId: card.cardId,
            count: starterCopyCount,
          })),
      ],
      runtime,
      sideboard: [],
    });

    expect(
      catalog.find((card) => card.cardId === "mirror-warden")?.isBanned,
    ).toBe(true);
    expect(validation.isLegal).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "bannedCard")).toBe(
      true,
    );
  });
});
