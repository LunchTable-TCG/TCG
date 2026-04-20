import { describe, expect, it } from "vitest";

import {
  createCatalogEntriesForFormat,
  validateCardReasoningMetadata,
  validateDeckForFormat,
} from "./decks";
import { starterFormat } from "./formats";

describe("starter deck validation", () => {
  it("accepts a legal mainboard at the configured minimum", () => {
    const catalog = createCatalogEntriesForFormat(starterFormat);
    const result = validateDeckForFormat({
      catalog,
      format: starterFormat,
      mainboard: [
        { cardId: "archive-apprentice", count: 4 },
        { cardId: "ember-summoner", count: 4 },
        { cardId: "banner-captain", count: 4 },
        { cardId: "tidecall-apprentice", count: 4 },
        { cardId: "sky-patrol-scout", count: 4 },
        { cardId: "field-marshal-cadet", count: 4 },
        { cardId: "mirror-warden", count: 4 },
        { cardId: "lantern-adept", count: 4 },
        { cardId: "bastion-tortoise", count: 4 },
        { cardId: "stormline-harrier", count: 4 },
      ],
      sideboard: [],
    });

    expect(result.isLegal).toBe(true);
    expect(result.mainboardCount).toBe(40);
  });

  it("rejects banned, oversized, and under-owned entries", () => {
    const format = {
      ...starterFormat,
      banList: ["mirror-warden"],
    };
    const catalog = createCatalogEntriesForFormat(format);
    const result = validateDeckForFormat({
      catalog,
      collectionCounts: {
        "archive-apprentice": 2,
        "mirror-warden": 1,
      },
      format,
      mainboard: [
        { cardId: "archive-apprentice", count: 4 },
        { cardId: "mirror-warden", count: 2 },
      ],
      sideboard: [{ cardId: "mirror-warden", count: 20 }],
    });

    expect(result.isLegal).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "bannedCard",
        "insufficientOwnedCards",
        "sideboardTooLarge",
        "tooFewCards",
      ]),
    );
  });

  it("emits complete agent reasoning metadata for every visible card", () => {
    const catalog = createCatalogEntriesForFormat(starterFormat);

    expect(validateCardReasoningMetadata(catalog)).toEqual([]);
    expect(catalog[0]?.reasoning.timingAffordances).toContain("mainPhaseCast");
  });
});
