import { describe, expect, it } from "vitest";
import { deriveDeterministicNumber } from "./index";

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
});
