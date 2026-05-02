import { describe, expect, it } from "vitest";

import {
  type TabletopComponent,
  createTabletopComponentIndex,
} from "./components";

const components: TabletopComponent[] = [
  {
    id: "board:arena",
    kind: "board",
    name: "Arena",
    surface: {
      height: 900,
      shape: "rectangle",
      width: 1600,
    },
  },
  {
    faces: 6,
    id: "die:attack",
    kind: "die",
    name: "Attack Die",
    values: ["1", "2", "3", "4", "5", "6"],
  },
  {
    id: "piece:hero",
    kind: "piece",
    name: "Hero",
    movement: {
      axes: ["x", "y"],
      grid: "continuous",
    },
  },
];

describe("tabletop component utilities", () => {
  it("indexes tabletop components by id and kind", () => {
    const index = createTabletopComponentIndex(components);

    expect(index.byId["die:attack"]?.name).toBe("Attack Die");
    expect(index.byKind.die.map((component) => component.id)).toEqual([
      "die:attack",
    ]);
    expect(index.byKind.board.map((component) => component.id)).toEqual([
      "board:arena",
    ]);
  });

  it("rejects duplicate component ids", () => {
    expect(() =>
      createTabletopComponentIndex([components[0], components[0]]),
    ).toThrow("Duplicate tabletop component id: board:arena");
  });
});
