import { describe, expect, it } from "vitest";
import { deriveDeterministicNumber } from "./index";

function deriveParityValue(seed: string, cursor: number): number {
  const input = `${seed}:${cursor}`;
  let hash = 2166136261;

  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

describe("deriveDeterministicNumber", () => {
  it("derives deterministic numbers from the seed cursor", () => {
    const initial = {
      cursor: 0,
      seed: "lunch-table",
    };

    const [firstValue, firstRandom] = deriveDeterministicNumber(initial);
    const [secondValue, secondRandom] = deriveDeterministicNumber(firstRandom);
    const [repeatFirstValue, repeatFirstRandom] = deriveDeterministicNumber({
      cursor: 0,
      seed: "lunch-table",
    });

    expect(firstValue).toBe(0.6258408056166583);
    expect(firstRandom).toEqual({
      cursor: 1,
      seed: "lunch-table",
    });
    expect(secondValue).toBe(0.6297471494483172);
    expect(secondRandom).toEqual({
      cursor: 2,
      seed: "lunch-table",
    });
    expect(repeatFirstValue).toBe(firstValue);
    expect(repeatFirstRandom).toEqual(firstRandom);
  });

  it("matches code point iteration for non-BMP seed characters", () => {
    const random = {
      cursor: 0,
      seed: "lunch-table:🎲",
    };

    const [value, nextRandom] = deriveDeterministicNumber(random);

    expect(value).toBe(deriveParityValue(random.seed, random.cursor));
    expect(nextRandom).toEqual({
      cursor: 1,
      seed: random.seed,
    });
  });
});
