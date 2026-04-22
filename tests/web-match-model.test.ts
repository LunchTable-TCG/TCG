import type {
  CardCatalogEntry,
  MatchSeatView,
  MatchSpectatorView,
} from "@lunchtable/shared-types";
import { describe, expect, it } from "vitest";
import {
  buildMatchCinematicAssetBundle,
  buildMatchCinematicSceneModel,
} from "../apps/web/src/components/match/cinematics";

import {
  deriveMatchCinematicCue,
  getZoneView,
  listActivatedAbilityActions,
  listCombatActions,
  resolveRenderableView,
} from "../apps/web/src/components/match/model";

function createReasoning(input?: Partial<CardCatalogEntry["reasoning"]>) {
  return {
    effectKinds: [],
    promptSurfaces: [],
    rulesSummary: [],
    stats: null,
    targetClasses: [],
    timingAffordances: ["mainPhaseCast"],
    ...input,
  };
}

function createSeatView(): MatchSeatView {
  return {
    availableIntents: ["activateAbility", "concede", "toggleAutoPass"],
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
        boardModel: "openBoard",
        deckRules: {
          maxCopies: 4,
          minCards: 40,
          sideboardSize: 15,
        },
        id: "core-demo",
        name: "Core Demo",
        resourceModel: "manaCurve",
        timingModel: "fullStack",
        turnModel: "alternating",
        version: "0.0.1",
        victoryModel: "lifeTotal",
      },
      id: "match_ui",
      lastEventNumber: 1,
      phase: "main1",
      prioritySeat: "seat-0",
      seats: [],
      spectatorCount: 0,
      startedAt: 0,
      status: "active",
      timers: {
        activeDeadlineAt: null,
        ropeDeadlineAt: null,
        seatTimeRemainingMs: {},
        turnStartedAt: null,
      },
      turnNumber: 1,
      version: 3,
      winnerSeat: null,
    },
    prompt: null,
    recentEvents: [],
    seats: [
      {
        actorType: "human",
        autoPassEnabled: false,
        deckCount: 40,
        graveyardCount: 0,
        handCount: 5,
        hasPriority: true,
        isActiveTurn: true,
        lifeTotal: 20,
        resources: [],
        seat: "seat-0",
        status: "active",
        username: "alpha",
      },
    ],
    stack: [],
    viewerSeat: "seat-0",
    zones: [
      {
        cards: [
          {
            annotations: [],
            cardId: "archive-apprentice",
            controllerSeat: "seat-0",
            counters: {},
            instanceId: "seat-0:archive-apprentice:battlefield:1",
            isTapped: false,
            keywords: [],
            name: "Archive Apprentice",
            ownerSeat: "seat-0",
            slotId: null,
            statLine: {
              power: 1,
              toughness: 3,
            },
            visibility: "public",
            zone: "battlefield",
          },
        ],
        cardCount: 1,
        ownerSeat: "seat-0",
        visibility: "public",
        zone: "battlefield",
      },
    ],
  };
}

function createSpectatorView(): MatchSpectatorView {
  return {
    availableIntents: [],
    combat: {
      attackers: [],
      blocks: [],
    },
    kind: "spectator",
    match: createSeatView().match,
    prompt: null,
    recentEvents: [],
    seats: [],
    stack: [],
    zones: [],
  };
}

describe("web match model helpers", () => {
  it("falls back to spectator mode when a seat projection is unavailable", () => {
    const spectatorView = createSpectatorView();

    const resolved = resolveRenderableView({
      preferredMode: "seat",
      seatView: null,
      spectatorView,
    });

    expect(resolved.mode).toBe("spectator");
    expect(resolved.view).toBe(spectatorView);
  });

  it("lists only activated abilities for cards on the viewer battlefield", () => {
    const view = createSeatView();
    const catalog: CardCatalogEntry[] = [
      {
        abilities: [
          {
            id: "study-bolt",
            kind: "activated",
            requiresTargets: false,
            resourceCost: 1,
            speed: "slow",
            text: "Pay 1 mana: Draw a card.",
          },
          {
            id: "entry-spark",
            kind: "triggered",
            requiresTargets: false,
            resourceCost: null,
            speed: null,
            text: "When this enters, deal 2 damage.",
          },
        ],
        cardId: "archive-apprentice",
        cost: 2,
        formatId: "core-demo",
        isBanned: false,
        keywords: [],
        kind: "unit",
        name: "Archive Apprentice",
        rarity: "common",
        reasoning: createReasoning({
          effectKinds: ["drawCards"],
          timingAffordances: ["mainPhaseCast", "slowActivation"],
        }),
        rulesText: [],
        setId: "core-alpha",
        stats: {
          power: 1,
          toughness: 3,
        },
      },
    ];

    expect(listActivatedAbilityActions(catalog, view)).toEqual([
      {
        abilityId: "study-bolt",
        cardName: "Archive Apprentice",
        instanceId: "seat-0:archive-apprentice:battlefield:1",
        text: "Pay 1 mana: Draw a card.",
      },
    ]);
    expect(getZoneView(view, "seat-0", "battlefield")?.cardCount).toBe(1);
  });

  it("lists targeted activated abilities as concrete battlefield actions", () => {
    const view = createSeatView();
    view.zones[0] = {
      ...view.zones[0],
      cardCount: 2,
      cards: [
        {
          annotations: [],
          cardId: "field-marshal-cadet",
          controllerSeat: "seat-0",
          counters: {},
          instanceId: "seat-0:field-marshal-cadet:battlefield:1",
          isTapped: false,
          keywords: [],
          name: "Field Marshal Cadet",
          ownerSeat: "seat-0",
          slotId: null,
          statLine: {
            power: 2,
            toughness: 2,
          },
          visibility: "public",
          zone: "battlefield",
        },
        {
          annotations: [],
          cardId: "tidecall-apprentice",
          controllerSeat: "seat-0",
          counters: {},
          instanceId: "seat-0:tidecall-apprentice:battlefield:1",
          isTapped: false,
          keywords: [],
          name: "Tidecall Apprentice",
          ownerSeat: "seat-0",
          slotId: null,
          statLine: {
            power: 1,
            toughness: 2,
          },
          visibility: "public",
          zone: "battlefield",
        },
      ],
    };

    const catalog: CardCatalogEntry[] = [
      {
        abilities: [
          {
            id: "battlefield-orders",
            kind: "activated",
            requiresTargets: true,
            resourceCost: 1,
            speed: "slow",
            targets: [
              {
                maxSelections: 1,
                minSelections: 1,
                selector: "friendlyUnit",
              },
            ],
            text: "Target friendly unit gains haste until end of turn.",
          },
        ],
        cardId: "field-marshal-cadet",
        cost: 2,
        formatId: "core-demo",
        isBanned: false,
        keywords: [],
        kind: "unit",
        name: "Field Marshal Cadet",
        rarity: "common",
        reasoning: createReasoning({
          effectKinds: ["grantKeyword"],
          promptSurfaces: ["targets"],
          targetClasses: ["friendlyUnit"],
          timingAffordances: ["mainPhaseCast", "slowActivation"],
        }),
        rulesText: [],
        setId: "core-alpha",
        stats: {
          power: 2,
          toughness: 2,
        },
      },
      {
        abilities: [],
        cardId: "tidecall-apprentice",
        cost: 1,
        formatId: "core-demo",
        isBanned: false,
        keywords: [],
        kind: "unit",
        name: "Tidecall Apprentice",
        rarity: "common",
        reasoning: createReasoning(),
        rulesText: [],
        setId: "core-alpha",
        stats: {
          power: 1,
          toughness: 2,
        },
      },
    ];

    expect(listActivatedAbilityActions(catalog, view)).toEqual([
      {
        abilityId: "battlefield-orders",
        cardName: "Field Marshal Cadet",
        instanceId: "seat-0:field-marshal-cadet:battlefield:1",
        targetIds: ["seat-0:field-marshal-cadet:battlefield:1"],
        targetLabel: "Field Marshal Cadet",
        text: "Target friendly unit gains haste until end of turn. -> Field Marshal Cadet",
      },
      {
        abilityId: "battlefield-orders",
        cardName: "Field Marshal Cadet",
        instanceId: "seat-0:field-marshal-cadet:battlefield:1",
        targetIds: ["seat-0:tidecall-apprentice:battlefield:1"],
        targetLabel: "Tidecall Apprentice",
        text: "Target friendly unit gains haste until end of turn. -> Tidecall Apprentice",
      },
    ]);
  });

  it("lists combat actions from the seat combat state", () => {
    const attackView = createSeatView();
    attackView.availableIntents = ["declareAttackers", "passPriority"];
    attackView.seats = [
      ...attackView.seats,
      {
        actorType: "bot",
        autoPassEnabled: false,
        deckCount: 40,
        graveyardCount: 0,
        handCount: 5,
        hasPriority: false,
        isActiveTurn: false,
        lifeTotal: 20,
        resources: [],
        seat: "seat-1",
        status: "active",
        username: "beta",
      },
    ];
    attackView.zones = [
      {
        cards: [
          {
            annotations: [],
            cardId: "ember-summoner",
            controllerSeat: "seat-0",
            counters: {},
            instanceId: "seat-0:ember-summoner:battlefield:1",
            isTapped: false,
            keywords: [],
            name: "Ember Summoner",
            ownerSeat: "seat-0",
            slotId: null,
            statLine: { power: 2, toughness: 2 },
            visibility: "public",
            zone: "battlefield",
          },
        ],
        cardCount: 1,
        ownerSeat: "seat-0",
        visibility: "public",
        zone: "battlefield",
      },
    ];

    expect(listCombatActions(attackView)[0]).toEqual({
      attackers: [
        {
          attackerId: "seat-0:ember-summoner:battlefield:1",
          defenderSeat: "seat-1",
          laneId: null,
        },
      ],
      kind: "declareAttackers",
      label: "Attack with Ember Summoner",
    });

    const damageView: MatchSeatView = {
      ...attackView,
      availableIntents: ["assignCombatDamage", "passPriority"],
      combat: {
        attackers: [
          {
            attackerId: "seat-0:ember-summoner:battlefield:1",
            defenderSeat: "seat-1",
            laneId: null,
          },
        ],
        blocks: [],
      },
    };

    expect(listCombatActions(damageView)).toEqual([
      {
        assignments: [
          {
            amount: 2,
            sourceId: "seat-0:ember-summoner:battlefield:1",
            targetId: "seat-1",
          },
        ],
        kind: "assignCombatDamage",
        label: "Resolve combat damage",
      },
    ]);
  });

  it("derives summon cinematics only for battlefield entries", () => {
    const view = createSeatView();
    view.recentEvents = [
      {
        cardId: "archive-apprentice",
        cardName: "Archive Apprentice",
        focusInstanceId: "seat-0:archive-apprentice:hand:1",
        kind: "cardPlayed",
        label: "Played Archive Apprentice",
        seat: "seat-0",
        sequence: 8,
        toZone: "battlefield",
      },
    ];

    expect(deriveMatchCinematicCue(view)).toEqual({
      accentSeat: "seat-0",
      cardId: "archive-apprentice",
      cardName: "Archive Apprentice",
      eventSequence: 8,
      focusInstanceId: "seat-0:archive-apprentice:hand:1",
      kind: "summon",
      kicker: "Summon sequence",
      label: "Played Archive Apprentice",
    });
  });

  it("derives ability cinematics from the latest activation summary", () => {
    const view = createSeatView();
    view.recentEvents = [
      {
        abilityId: "study-bolt",
        cardId: "archive-apprentice",
        cardName: "Archive Apprentice",
        focusInstanceId: "seat-0:archive-apprentice:battlefield:1",
        kind: "abilityActivated",
        label: "Archive Apprentice activated study-bolt",
        seat: "seat-0",
        sequence: 9,
      },
    ];

    expect(deriveMatchCinematicCue(view)).toEqual({
      accentSeat: "seat-0",
      cardId: "archive-apprentice",
      cardName: "Archive Apprentice",
      eventSequence: 9,
      focusInstanceId: "seat-0:archive-apprentice:battlefield:1",
      kind: "ability",
      kicker: "Ability ignition · study-bolt",
      label: "Archive Apprentice activated study-bolt",
    });
  });

  it("maps summon and ability cues to distinct 3D scene models", () => {
    const archiveApprentice: CardCatalogEntry = {
      abilities: [],
      cardId: "archive-apprentice",
      cost: 2,
      formatId: "core-demo",
      isBanned: false,
      keywords: [],
      kind: "unit",
      name: "Archive Apprentice",
      rarity: "common",
      reasoning: createReasoning(),
      rulesText: [],
      setId: "core-alpha",
      stats: {
        power: 1,
        toughness: 3,
      },
    };
    const skyScout: CardCatalogEntry = {
      abilities: [],
      cardId: "sky-patrol-scout",
      cost: 3,
      formatId: "core-demo",
      isBanned: false,
      keywords: ["flying", "haste"],
      kind: "unit",
      name: "Sky Patrol Scout",
      rarity: "rare",
      reasoning: createReasoning({
        timingAffordances: ["mainPhaseCast", "trigger:selfEntersBattlefield"],
      }),
      rulesText: ["Flying", "Haste"],
      setId: "core-alpha",
      stats: {
        power: 2,
        toughness: 1,
      },
    };

    const summonModel = buildMatchCinematicSceneModel({
      card: skyScout,
      cue: {
        accentSeat: "seat-0",
        cardId: "sky-patrol-scout",
        cardName: "Sky Patrol Scout",
        eventSequence: 1,
        focusInstanceId: "seat-0:sky-patrol-scout:hand:1",
        kind: "summon",
        kicker: "Summon sequence",
        label: "Played Sky Patrol Scout",
      },
    });
    const abilityModel = buildMatchCinematicSceneModel({
      card: archiveApprentice,
      cue: {
        accentSeat: "seat-0",
        cardId: "archive-apprentice",
        cardName: "Archive Apprentice",
        eventSequence: 2,
        focusInstanceId: "seat-0:archive-apprentice:battlefield:1",
        kind: "ability",
        kicker: "Ability ignition · study-bolt",
        label: "Archive Apprentice activated study-bolt",
      },
    });

    expect(summonModel).toMatchObject({
      accentColor: "#ff9863",
      shardCount: 8,
    });
    expect(abilityModel).toMatchObject({
      accentColor: "#f4d57d",
      shardCount: 4,
    });
    expect(abilityModel.idleSpin).toBeGreaterThan(summonModel.idleSpin);
    expect(summonModel.bobAmplitude).toBeGreaterThan(abilityModel.bobAmplitude);
  });

  it("resolves optional CDN-backed summon assets only when a base URL is configured", () => {
    const skyScout: CardCatalogEntry = {
      abilities: [],
      cardId: "sky-patrol-scout",
      cost: 3,
      formatId: "core-demo",
      isBanned: false,
      keywords: ["flying", "haste"],
      kind: "unit",
      name: "Sky Patrol Scout",
      rarity: "rare",
      reasoning: createReasoning(),
      rulesText: ["Flying", "Haste"],
      setId: "core-alpha",
      stats: {
        power: 2,
        toughness: 1,
      },
    };

    expect(
      buildMatchCinematicAssetBundle({
        assetBaseUrl: null,
        card: skyScout,
        cue: {
          accentSeat: "seat-0",
          cardId: "sky-patrol-scout",
          cardName: "Sky Patrol Scout",
          eventSequence: 1,
          focusInstanceId: "seat-0:sky-patrol-scout:hand:1",
          kind: "summon",
          kicker: "Summon sequence",
          label: "Played Sky Patrol Scout",
        },
      }),
    ).toBeNull();

    expect(
      buildMatchCinematicAssetBundle({
        assetBaseUrl: "https://cdn.example.com/lunchtable",
        card: skyScout,
        cue: {
          accentSeat: "seat-0",
          cardId: "sky-patrol-scout",
          cardName: "Sky Patrol Scout",
          eventSequence: 1,
          focusInstanceId: "seat-0:sky-patrol-scout:hand:1",
          kind: "summon",
          kicker: "Summon sequence",
          label: "Played Sky Patrol Scout",
        },
      }),
    ).toEqual({
      mode: "cdn",
      modelOffsetY: -1.08,
      modelRotationY: Math.PI * 0.88,
      modelScale: 1.22,
      modelUrl:
        "https://cdn.example.com/lunchtable/cards/sky-patrol-scout/summon.glb",
      posterUrl:
        "https://cdn.example.com/lunchtable/cards/sky-patrol-scout/poster.jpg",
    });
  });
});
