export interface DeterministicRandomState {
  cursor: number;
  seed: string;
}

export function deriveDeterministicNumber(
  random: DeterministicRandomState,
): [number, DeterministicRandomState] {
  const input = `${random.seed}:${random.cursor}`;
  let hash = 2166136261;

  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return [
    (hash >>> 0) / 4294967295,
    {
      cursor: random.cursor + 1,
      seed: random.seed,
    },
  ];
}
