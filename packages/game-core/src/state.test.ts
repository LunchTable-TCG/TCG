import { describe, expect, it } from "vitest";

import { createGameState, deriveDeterministicNumber } from "./index";

describe("createGameState", () => {
  it("creates the same authoritative state for the same seed", () => {
    expect(
      createGameState({
        matchId: "match_same_seed",
        seed: "seed:phase-4",
        status: "active",
      }),
    ).toEqual(
      createGameState({
        matchId: "match_same_seed",
        seed: "seed:phase-4",
        status: "active",
      }),
    );
  });

  it("derives deterministic random numbers from the seed cursor", () => {
    const initial = createGameState({
      seed: "seed:phase-4-rng",
    }).random;

    const [firstValue, firstRandom] = deriveDeterministicNumber(initial);
    const [secondValue, secondRandom] = deriveDeterministicNumber(firstRandom);
    const [repeatFirstValue, repeatFirstRandom] = deriveDeterministicNumber({
      cursor: 0,
      seed: "seed:phase-4-rng",
    });

    expect(firstValue).toBe(repeatFirstValue);
    expect(firstRandom).toEqual(repeatFirstRandom);
    expect(secondRandom.cursor).toBe(2);
    expect(firstValue).not.toBe(secondValue);
  });
});
