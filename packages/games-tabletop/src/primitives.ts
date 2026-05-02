export type SeatId = string;
export type TabletopObjectId = string;
export type ZoneId = string;

export type TabletopObjectKind =
  | "board"
  | "card"
  | "counter"
  | "die"
  | "piece"
  | "token";

export type TabletopVisibility =
  | "count-only"
  | "hidden"
  | "private-owner"
  | "public";

export interface TabletopSeat {
  actorType: "ai" | "human";
  id: SeatId;
  name: string | null;
  permissions: string[];
  status: "active" | "eliminated" | "joining" | "ready";
}

export interface TabletopZone {
  id: ZoneId;
  kind: "bag" | "board" | "deck" | "discard" | "hand" | "objective" | "stack";
  name: string;
  ownerSeat: SeatId | null;
  ordering: "ordered" | "unordered";
  visibility: TabletopVisibility;
}

export interface TabletopObject {
  id: TabletopObjectId;
  kind: TabletopObjectKind;
  name: string;
  ownerSeat: SeatId | null;
  state: "exhausted" | "ready" | "removed";
  visibility: TabletopVisibility;
  zoneId: ZoneId;
}
