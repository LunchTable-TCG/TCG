import { describe, expect, it } from "vitest";

import {
  applySideScrollerIntent,
  createSideScrollerComponents,
  createSideScrollerInitialState,
  createSideScrollerRuleset,
  deriveSideScrollerRenderScene,
  listSideScrollerLegalIntents,
  sideScrollerStarterConfig,
  stepSideScrollerWorld,
} from "./engine";

describe("side-scroller engine", () => {
  it("creates deterministic multi-seat runner state and legal action parity", () => {
    const state = createSideScrollerInitialState(sideScrollerStarterConfig);

    expect(Object.keys(state.runners)).toEqual(["seat-0", "seat-1"]);
    expect(state.shell.status).toBe("playing");
    expect(
      listSideScrollerLegalIntents(sideScrollerStarterConfig, state, "seat-0"),
    ).toEqual([
      { kind: "moveLeft", seatId: "seat-0" },
      { kind: "moveRight", seatId: "seat-0" },
      { kind: "dash", seatId: "seat-0" },
      { kind: "jump", seatId: "seat-0" },
      { kind: "wait", seatId: "seat-0" },
    ]);
    expect(
      listSideScrollerLegalIntents(sideScrollerStarterConfig, state, "seat-1"),
    ).toEqual([
      { kind: "moveLeft", seatId: "seat-1" },
      { kind: "moveRight", seatId: "seat-1" },
      { kind: "dash", seatId: "seat-1" },
      { kind: "jump", seatId: "seat-1" },
      { kind: "wait", seatId: "seat-1" },
    ]);
  });

  it("applies movement, gravity, dash cooldown, and ground collision deterministically", () => {
    let state = createSideScrollerInitialState(sideScrollerStarterConfig);

    const dash = applySideScrollerIntent(sideScrollerStarterConfig, state, {
      kind: "dash",
      seatId: "seat-0",
    });
    expect(dash.outcome).toBe("applied");
    expect(dash.events).toContainEqual({
      kind: "runnerDashed",
      seatId: "seat-0",
    });

    state = dash.nextState;
    expect(state.runners["seat-0"].x).toBe(144);
    expect(state.runners["seat-0"].dashCooldown).toBe(2);
    expect(
      listSideScrollerLegalIntents(
        sideScrollerStarterConfig,
        state,
        "seat-0",
      ).map((intent) => intent.kind),
    ).not.toContain("dash");

    const jump = applySideScrollerIntent(sideScrollerStarterConfig, state, {
      kind: "jump",
      seatId: "seat-0",
    });
    state = jump.nextState;
    expect(state.runners["seat-0"].grounded).toBe(false);
    expect(state.runners["seat-0"].y).toBeGreaterThan(0);

    for (let index = 0; index < 60; index += 1) {
      state = stepSideScrollerWorld(
        sideScrollerStarterConfig,
        state,
        "seat-0",
      ).nextState;
    }

    expect(state.runners["seat-0"].grounded).toBe(true);
    expect(state.runners["seat-0"].y).toBe(0);
    expect(state.runners["seat-0"].dashCooldown).toBe(0);
  });

  it("collects items, damages runners, defeats hazards, and completes at goals", () => {
    let state = createSideScrollerInitialState(sideScrollerStarterConfig);

    state = {
      ...state,
      runners: {
        ...state.runners,
        "seat-0": {
          ...state.runners["seat-0"],
          facing: "right",
          x: 392,
        },
      },
    };

    const collect = stepSideScrollerWorld(
      sideScrollerStarterConfig,
      state,
      "seat-0",
    );
    expect(collect.events).toContainEqual({
      collectibleId: "token:collectible-1",
      kind: "collectibleClaimed",
      seatId: "seat-0",
      value: 1,
    });
    expect(collect.nextState.runners["seat-0"].score).toBe(1);

    state = {
      ...collect.nextState,
      runners: {
        ...collect.nextState.runners,
        "seat-0": {
          ...collect.nextState.runners["seat-0"],
          facing: "right",
          x: 544,
        },
      },
    };
    expect(
      listSideScrollerLegalIntents(
        sideScrollerStarterConfig,
        state,
        "seat-0",
      ).map((intent) => intent.kind),
    ).toContain("attack");

    const attack = applySideScrollerIntent(sideScrollerStarterConfig, state, {
      kind: "attack",
      seatId: "seat-0",
    });
    expect(attack.events).toContainEqual({
      hazardId: "token:hazard-1",
      kind: "hazardDefeated",
      seatId: "seat-0",
    });
    expect(attack.nextState.hazards[0]?.defeated).toBe(true);

    state = {
      ...attack.nextState,
      runners: {
        ...attack.nextState.runners,
        "seat-0": {
          ...attack.nextState.runners["seat-0"],
          x: sideScrollerStarterConfig.level.goals[0]?.x ?? 960,
        },
      },
    };
    const goal = stepSideScrollerWorld(
      sideScrollerStarterConfig,
      state,
      "seat-0",
    );

    expect(goal.events).toContainEqual({
      kind: "goalReached",
      seatId: "seat-0",
    });
    expect(goal.nextState.shell.status).toBe("complete");
  });

  it("derives renderer-neutral side-scroller scenes with level geometry", () => {
    const state = createSideScrollerInitialState(sideScrollerStarterConfig);
    const scene = deriveSideScrollerRenderScene(
      sideScrollerStarterConfig,
      state,
      {
        height: 720,
        width: 1280,
      },
    );
    const objectIds = scene.objects.map((object) => object.id);

    expect(scene.camera?.mode).toBe("side-scroller");
    expect(scene.camera?.target).toEqual({ x: 0, y: 0, z: 0 });
    expect(objectIds).toEqual([
      "board:level-1",
      "platform:ground",
      "platform:ledge-1",
      "piece:runner-seat-0",
      "piece:runner-seat-1",
      "token:hazard-1",
      "token:collectible-1",
      "token:goal",
    ]);
  });

  it("exposes tabletop components for runners and level platforms", () => {
    const components = createSideScrollerComponents(sideScrollerStarterConfig);
    const componentIds = components.map((component) => component.id);

    expect(componentIds).toContain("board:level-1");
    expect(componentIds).toContain("platform:ground");
    expect(componentIds).toContain("platform:ledge-1");
    expect(componentIds).toContain("piece:runner-seat-0");
    expect(componentIds).toContain("piece:runner-seat-1");
  });

  it("exposes a GameRuleset adapter for generated game packs", () => {
    const ruleset = createSideScrollerRuleset(sideScrollerStarterConfig);
    let state = ruleset.createInitialState({ seed: "seed:test" });

    state = ruleset.applyIntent(state, {
      kind: "moveRight",
      seatId: "seat-0",
    }).nextState;

    expect(state.shell.version).toBe(1);
    expect(state.shell.activeSeatId).toBe("seat-1");
    expect(ruleset.deriveSeatView(state, "seat-0").runners["seat-0"].x).toBe(
      72,
    );
    expect(ruleset.deriveSpectatorView(state).tick).toBe(1);
  });
});
