import type { SeatId, TabletopObject } from "./primitives";

export function canSeatViewObject(
  object: TabletopObject,
  viewerSeat: SeatId,
): boolean {
  if (object.visibility === "public") {
    return true;
  }

  if (object.visibility === "private-owner") {
    return object.ownerSeat === viewerSeat;
  }

  return false;
}

export function canSeatCountObject(
  object: TabletopObject,
  viewerSeat: SeatId,
): boolean {
  if (object.visibility === "public" || object.visibility === "count-only") {
    return true;
  }

  if (object.visibility === "private-owner") {
    return object.ownerSeat === viewerSeat;
  }

  return false;
}
