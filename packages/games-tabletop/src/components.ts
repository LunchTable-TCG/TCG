import type {
  SeatId,
  TabletopObjectKind,
  TabletopVisibility,
  ZoneId,
} from "./primitives";

export type TabletopAssetKind =
  | "audio"
  | "image"
  | "material"
  | "model"
  | "sprite";

export interface TabletopAssetRef {
  id: string;
  kind: TabletopAssetKind;
  uri: string;
}

export type TabletopComponentKind = TabletopObjectKind | "attachment" | "deck";

export interface TabletopTransform {
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
}

interface BaseTabletopComponent {
  asset?: TabletopAssetRef;
  id: string;
  name: string;
  tags?: string[];
  transform?: TabletopTransform;
}

export interface TabletopBoardComponent extends BaseTabletopComponent {
  kind: "board";
  surface: {
    grid?: "hex" | "square";
    height: number;
    shape: "custom" | "hex" | "rectangle";
    width: number;
  };
}

export interface TabletopCardComponent extends BaseTabletopComponent {
  kind: "card";
  faces: {
    backAssetId?: string;
    frontAssetId?: string;
  };
  ownerSeat: SeatId | null;
}

export interface TabletopCounterComponent extends BaseTabletopComponent {
  initialValue: number;
  kind: "counter";
  maxValue: number | null;
  minValue: number;
}

export interface TabletopDeckComponent extends BaseTabletopComponent {
  kind: "deck";
  ordering: "ordered" | "randomized";
  zoneId: ZoneId;
}

export interface TabletopDieComponent extends BaseTabletopComponent {
  faces: number;
  kind: "die";
  values: string[];
}

export interface TabletopPieceComponent extends BaseTabletopComponent {
  kind: "piece";
  movement: {
    axes: Array<"x" | "y" | "z">;
    grid: "continuous" | "hex" | "square";
  };
}

export interface TabletopTokenComponent extends BaseTabletopComponent {
  kind: "token";
  ownerSeat: SeatId | null;
  visibility: TabletopVisibility;
}

export interface TabletopAttachmentComponent extends BaseTabletopComponent {
  attachToKinds: TabletopObjectKind[];
  kind: "attachment";
}

export type TabletopComponent =
  | TabletopAttachmentComponent
  | TabletopBoardComponent
  | TabletopCardComponent
  | TabletopCounterComponent
  | TabletopDeckComponent
  | TabletopDieComponent
  | TabletopPieceComponent
  | TabletopTokenComponent;

export interface TabletopComponentIndex {
  byId: Record<string, TabletopComponent>;
  byKind: Record<TabletopComponentKind, TabletopComponent[]>;
}

function createEmptyKindIndex(): Record<
  TabletopComponentKind,
  TabletopComponent[]
> {
  return {
    attachment: [],
    board: [],
    card: [],
    counter: [],
    deck: [],
    die: [],
    piece: [],
    token: [],
  };
}

export function createTabletopComponentIndex(
  components: readonly TabletopComponent[],
): TabletopComponentIndex {
  const byId: Record<string, TabletopComponent> = {};
  const byKind = createEmptyKindIndex();

  for (const component of components) {
    if (byId[component.id] !== undefined) {
      throw new Error(`Duplicate tabletop component id: ${component.id}`);
    }

    byId[component.id] = component;
    byKind[component.kind].push(component);
  }

  return {
    byId,
    byKind,
  };
}
