import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { CardCatalogEntry, MatchSeatView } from "@lunchtable/shared-types";
import { Suspense, lazy, useMemo, useState } from "react";

const BoardCanvas = lazy(async () => {
  const module = await import("./BoardCanvas");

  return {
    default: module.BoardCanvas,
  };
});

const PREVIEW_CARD_IDS = [
  "archive-apprentice",
  "ember-summoner",
  "mirror-warden",
  "sky-patrol-scout",
] as const;

type PreviewCueKind = "ability" | "summon";

function buildPreviewView(input: {
  card: CardCatalogEntry;
  cueKind: PreviewCueKind;
  sequence: number;
}): MatchSeatView {
  const battlefieldInstanceId = `seat-0:${input.card.cardId}:battlefield:preview`;
  const handInstanceId = `seat-0:${input.card.cardId}:hand:preview`;
  const activatedAbility = input.card.abilities.find(
    (ability) => ability.kind === "activated",
  );

  return {
    availableIntents: [],
    combat: {
      attackers: [],
      blocks: [],
    },
    kind: "seat",
    match: {
      activeSeat: "seat-0",
      completedAt: null,
      createdAt: 0,
      format: {
        boardModel: starterFormat.boardModel,
        deckRules: starterFormat.deckRules,
        id: starterFormat.formatId,
        name: starterFormat.name,
        resourceModel: starterFormat.resourceModel,
        timingModel: starterFormat.timingModel,
        turnModel: "alternating",
        version: "preview",
        victoryModel: starterFormat.victoryModel,
      },
      id: "cinematic_preview",
      lastEventNumber: input.sequence,
      phase: "main1",
      prioritySeat: "seat-0",
      seats: [],
      spectatorCount: 0,
      startedAt: 0,
      status: "active",
      timers: {
        activeDeadlineAt: null,
        ropeDeadlineAt: null,
        seatTimeRemainingMs: {
          "seat-0": 300000,
          "seat-1": 300000,
        },
        turnStartedAt: 0,
      },
      turnNumber: 4,
      version: input.sequence,
      winnerSeat: null,
    },
    prompt: null,
    recentEvents: [
      input.cueKind === "summon"
        ? {
            cardId: input.card.cardId,
            cardName: input.card.name,
            focusInstanceId: handInstanceId,
            kind: "cardPlayed",
            label: `Played ${input.card.name}`,
            seat: "seat-0",
            sequence: input.sequence,
            toZone: "battlefield",
          }
        : {
            abilityId: activatedAbility?.id ?? "preview-burst",
            cardId: input.card.cardId,
            cardName: input.card.name,
            focusInstanceId: battlefieldInstanceId,
            kind: "abilityActivated",
            label: `${input.card.name} activated ${activatedAbility?.id ?? "preview-burst"}`,
            seat: "seat-0",
            sequence: input.sequence,
          },
    ],
    seats: [
      {
        actorType: "human",
        autoPassEnabled: false,
        deckCount: 28,
        graveyardCount: 2,
        handCount: 3,
        hasPriority: true,
        isActiveTurn: true,
        lifeTotal: 20,
        resources: [
          {
            current: 4,
            label: "Mana",
            maximum: 4,
            resourceId: "mana",
          },
        ],
        seat: "seat-0",
        status: "active",
        username: "preview",
      },
      {
        actorType: "bot",
        autoPassEnabled: false,
        deckCount: 27,
        graveyardCount: 1,
        handCount: 4,
        hasPriority: false,
        isActiveTurn: false,
        lifeTotal: 18,
        resources: [
          {
            current: 3,
            label: "Mana",
            maximum: 3,
            resourceId: "mana",
          },
        ],
        seat: "seat-1",
        status: "active",
        username: "sparring-bot",
      },
    ],
    stack: [],
    viewerSeat: "seat-0",
    zones: [
      {
        cards: [
          {
            annotations: input.cueKind === "ability" ? ["Preview focus"] : [],
            cardId: input.card.cardId,
            controllerSeat: "seat-0",
            counters: {},
            instanceId: battlefieldInstanceId,
            isTapped: false,
            keywords: [...input.card.keywords],
            name: input.card.name,
            ownerSeat: "seat-0",
            slotId: null,
            statLine: input.card.stats
              ? {
                  power: input.card.stats.power,
                  toughness: input.card.stats.toughness,
                }
              : null,
            visibility: "public",
            zone: "battlefield",
          },
        ],
        cardCount: 1,
        ownerSeat: "seat-0",
        visibility: "public",
        zone: "battlefield",
      },
      {
        cards: [],
        cardCount: 3,
        ownerSeat: "seat-0",
        visibility: "count-only",
        zone: "hand",
      },
      {
        cards: [],
        cardCount: 0,
        ownerSeat: "seat-1",
        visibility: "public",
        zone: "battlefield",
      },
    ],
  };
}

export function LocalCinematicPreview() {
  const [selectedCardId, setSelectedCardId] = useState<string>(
    PREVIEW_CARD_IDS[0],
  );
  const [cueKind, setCueKind] = useState<PreviewCueKind>("summon");
  const [sequence, setSequence] = useState(1);
  const catalog = useMemo(
    () => createCatalogEntriesForFormat(starterFormat),
    [],
  );
  const selectedCard =
    catalog.find((entry) => entry.cardId === selectedCardId) ?? catalog[0];
  const previewView = useMemo(
    () =>
      buildPreviewView({
        card: selectedCard,
        cueKind,
        sequence,
      }),
    [cueKind, selectedCard, sequence],
  );

  function triggerPreview(next: {
    cardId?: string;
    cueKind?: PreviewCueKind;
  }) {
    if (next.cardId) {
      setSelectedCardId(next.cardId);
    }
    if (next.cueKind) {
      setCueKind(next.cueKind);
    }
    setSequence((current) => current + 1);
  }

  return (
    <div className="panel-stack">
      <div>
        <p className="eyebrow">TCG Proof Renderer</p>
        <h3>Exercise live card entrances</h3>
        <p className="support-copy">
          Cycle through signature units and fire summon or ability beats in the
          proof renderer while the surrounding suite tests packs, assets, and
          agent parity.
        </p>
      </div>
      <div className="match-choice-list">
        <div className="cinematic-preview-controls">
          {PREVIEW_CARD_IDS.map((cardId) => {
            const entry = catalog.find(
              (candidate) => candidate.cardId === cardId,
            );

            return (
              <button
                className="match-card-action"
                key={cardId}
                onClick={() => triggerPreview({ cardId })}
                type="button"
              >
                {entry?.name ?? cardId}
              </button>
            );
          })}
        </div>
        <div className="cinematic-preview-controls">
          <button
            className="match-card-action"
            onClick={() => triggerPreview({ cueKind: "summon" })}
            type="button"
          >
            Summon cut-in
          </button>
          <button
            className="match-card-action"
            onClick={() => triggerPreview({ cueKind: "ability" })}
            type="button"
          >
            Ability burst
          </button>
          <button
            className="match-card-action"
            onClick={() => setSequence((current) => current + 1)}
            type="button"
          >
            Replay beat
          </button>
        </div>
      </div>
      <Suspense
        fallback={<p className="support-copy">Loading preview board.</p>}
      >
        <BoardCanvas
          catalog={catalog}
          disabled
          onActivateAbility={() => {}}
          onPlayCard={() => {}}
          view={previewView}
        />
      </Suspense>
    </div>
  );
}
