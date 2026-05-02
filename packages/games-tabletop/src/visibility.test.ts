import { describe, expect, it } from "vitest";
import type { SeatId, TabletopObject } from "./index";
import { canSeatCountObject, canSeatViewObject } from "./index";

const ownerSeat = "seat-owner" as SeatId;
const otherSeat = "seat-other" as SeatId;

function createObject(
  visibility: TabletopObject["visibility"],
): TabletopObject {
  return {
    id: "object-1",
    kind: "card",
    name: "Hidden Card",
    ownerSeat,
    state: "ready",
    visibility,
    zoneId: "zone-1",
  };
}

describe("canSeatViewObject", () => {
  it("allows every seat to view public objects", () => {
    expect(canSeatViewObject(createObject("public"), ownerSeat)).toBe(true);
    expect(canSeatViewObject(createObject("public"), otherSeat)).toBe(true);
  });

  it("prevents every seat from viewing count-only object details", () => {
    expect(canSeatViewObject(createObject("count-only"), ownerSeat)).toBe(
      false,
    );
    expect(canSeatViewObject(createObject("count-only"), otherSeat)).toBe(
      false,
    );
  });

  it("allows only the owner to view private-owner objects", () => {
    expect(canSeatViewObject(createObject("private-owner"), ownerSeat)).toBe(
      true,
    );
    expect(canSeatViewObject(createObject("private-owner"), otherSeat)).toBe(
      false,
    );
  });

  it("prevents every seat from viewing hidden objects", () => {
    expect(canSeatViewObject(createObject("hidden"), ownerSeat)).toBe(false);
    expect(canSeatViewObject(createObject("hidden"), otherSeat)).toBe(false);
  });
});

describe("canSeatCountObject", () => {
  it("allows every seat to count public objects", () => {
    expect(canSeatCountObject(createObject("public"), ownerSeat)).toBe(true);
    expect(canSeatCountObject(createObject("public"), otherSeat)).toBe(true);
  });

  it("allows every seat to count count-only objects", () => {
    expect(canSeatCountObject(createObject("count-only"), ownerSeat)).toBe(
      true,
    );
    expect(canSeatCountObject(createObject("count-only"), otherSeat)).toBe(
      true,
    );
  });

  it("allows only the owner to count private-owner objects", () => {
    expect(canSeatCountObject(createObject("private-owner"), ownerSeat)).toBe(
      true,
    );
    expect(canSeatCountObject(createObject("private-owner"), otherSeat)).toBe(
      false,
    );
  });

  it("prevents every seat from counting hidden objects", () => {
    expect(canSeatCountObject(createObject("hidden"), ownerSeat)).toBe(false);
    expect(canSeatCountObject(createObject("hidden"), otherSeat)).toBe(false);
  });
});
