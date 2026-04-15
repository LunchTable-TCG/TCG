import {
  type CardCatalogEntry,
  type MatchPromptChoiceView,
  type MatchShell as MatchShellRecord,
  type MatchView,
  assertMatchSeatId,
} from "@lunchtable/shared-types";
import { Suspense, useEffect, useState } from "react";

import type {
  SubmitIntent,
  SubmitIntentResult,
  WalletLibraryTransport,
} from "../../convex/api";
import { StatusBanner, type StatusNotice, getErrorMessage } from "../shared";
import { useSeatView } from "../../hooks/useSeatView";
import { LazyBoardCanvas } from "./LazyBoardCanvas";
import {
  type MatchRenderMode,
  getZoneView,
  resolveRenderableView,
} from "./model";

function createIntentId(kind: SubmitIntent["kind"]) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${kind}:${crypto.randomUUID()}`;
  }

  return `${kind}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function formatDeadline(timestamp: number | null) {
  if (timestamp === null) {
    return "Not running";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function summarizeIntentResult(result: SubmitIntentResult) {
  if (!result.accepted) {
    return {
      body: result.reason ?? "Intent rejected by the authoritative reducer.",
      title: "Intent rejected",
      tone: "warning" as const,
    };
  }

  return {
    body:
      result.appendedEventKinds && result.appendedEventKinds.length > 0
        ? `Applied through ${result.appendedEventKinds.join(", ")}.`
        : "The authoritative match state accepted the action.",
    title: "Intent applied",
    tone: "success" as const,
  };
}

function buildPromptIntent(input: {
  choice: MatchPromptChoiceView;
  view: Extract<MatchView, { kind: "seat" }>;
}): SubmitIntent | null {
  const seat = assertMatchSeatId(input.view.viewerSeat);

  if (input.view.prompt?.kind !== "mulligan") {
    return null;
  }

  if (input.choice.choiceId === "keep") {
    return {
      intentId: createIntentId("keepOpeningHand"),
      kind: "keepOpeningHand",
      matchId: input.view.match.id,
      payload: {},
      seat,
      stateVersion: input.view.match.version,
    };
  }

  if (input.choice.choiceId.startsWith("mulligan:")) {
    return {
      intentId: createIntentId("takeMulligan"),
      kind: "takeMulligan",
      matchId: input.view.match.id,
      payload: {
        targetHandSize: Number(input.choice.choiceId.split(":")[1] ?? ""),
      },
      seat,
      stateVersion: input.view.match.version,
    };
  }

  return null;
}

function MatchSeatStrip({
  shell,
  view,
}: {
  shell: MatchShellRecord;
  view: MatchView;
}) {
  return (
    <div className="match-seat-strip">
      {view.seats.map((seat) => (
        <article
          className={`match-seat-card ${
            shell.activeSeat === seat.seat ? "match-seat-card-active" : ""
          } ${seat.hasPriority ? "match-seat-card-priority" : ""}`}
          key={seat.seat}
        >
          <div className="match-seat-header">
            <p className="match-seat-name">
              {seat.username ?? seat.seat}
              {view.kind === "seat" && seat.seat === view.viewerSeat
                ? " · you"
                : ""}
            </p>
            <span className="match-seat-status">{seat.status}</span>
          </div>
          <dl className="stats match-seat-stats">
            <div>
              <dt>Life</dt>
              <dd>{seat.lifeTotal}</dd>
            </div>
            <div>
              <dt>Hand</dt>
              <dd>{seat.handCount}</dd>
            </div>
            <div>
              <dt>Deck</dt>
              <dd>{seat.deckCount}</dd>
            </div>
            <div>
              <dt>Graveyard</dt>
              <dd>{seat.graveyardCount}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

export function MatchShell({
  catalog,
  matchId,
  transport,
  viewerEnabled,
}: {
  catalog: CardCatalogEntry[];
  matchId: string | null;
  transport: WalletLibraryTransport | null;
  viewerEnabled: boolean;
}) {
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [preferredMode, setPreferredMode] = useState<MatchRenderMode>("seat");
  const {
    connectionLabel,
    isLoading,
    isReconnecting,
    seatView,
    shell,
    spectatorView,
  } = useSeatView(matchId, viewerEnabled);
  const { mode, view } = resolveRenderableView({
    preferredMode,
    seatView,
    spectatorView,
  });
  const gameplaySeat =
    view?.kind === "seat" ? assertMatchSeatId(view.viewerSeat) : null;

  useEffect(() => {
    if (!seatView && spectatorView && preferredMode === "seat") {
      setPreferredMode("spectator");
    }
  }, [preferredMode, seatView, spectatorView]);

  async function submitIntent(intent: SubmitIntent) {
    if (!transport) {
      setNotice({
        body: "Convex transport is unavailable for live match actions.",
        title: "Match transport missing",
        tone: "warning",
      });
      return;
    }

    setPendingIntent(intent.intentId);
    setNotice({
      body: `Submitting ${intent.kind} to the authoritative match reducer.`,
      title: "Applying intent",
      tone: "neutral",
    });

    try {
      const result = await transport.submitIntent({
        intent,
      });
      setNotice(summarizeIntentResult(result));
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Intent failed",
        tone: "error",
      });
    } finally {
      setPendingIntent(null);
    }
  }

  function submitPlayCard(cardInstanceId: string) {
    if (!shell || !gameplaySeat) {
      return;
    }

    void submitIntent({
      intentId: createIntentId("playCard"),
      kind: "playCard",
      matchId: shell.id,
      payload: {
        alternativeCostId: null,
        cardInstanceId,
        sourceZone: "hand",
        targetSlotId: null,
      },
      seat: gameplaySeat,
      stateVersion: shell.version,
    });
  }

  function submitActivateAbility(input: {
    abilityId: string;
    cardInstanceId: string;
  }) {
    if (!shell || !gameplaySeat) {
      return;
    }

    void submitIntent({
      intentId: createIntentId("activateAbility"),
      kind: "activateAbility",
      matchId: shell.id,
      payload: {
        abilityId: input.abilityId,
        sourceInstanceId: input.cardInstanceId,
      },
      seat: gameplaySeat,
      stateVersion: shell.version,
    });
  }

  if (!matchId) {
    return (
      <section className="workspace-card workspace-card-dark match-shell">
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Live Match Shell</p>
            <h3>No match selected</h3>
          </div>
          <p className="support-copy">
            Create a practice match, finish a lobby ready check, or open a
            queued match to mount the live seat and spectator shells here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-card workspace-card-dark match-shell">
      <div className="panel-stack">
        <div className="match-shell-header">
          <div>
            <p className="eyebrow">Live Match Shell</p>
            <h3>{shell?.id ?? matchId}</h3>
          </div>
          <div className="match-shell-chips">
            <span className="match-shell-chip">{connectionLabel}</span>
            <span className="match-shell-chip">
              {mode === "seat" ? "Seat view" : "Spectator view"}
            </span>
            {shell ? (
              <span className="match-shell-chip">
                {shell.phase} · turn {shell.turnNumber}
              </span>
            ) : null}
          </div>
        </div>

        <StatusBanner notice={notice} />

        <div className="inline-actions inline-actions-tight">
          <button
            className="action secondary-action"
            disabled={!seatView}
            onClick={() => setPreferredMode("seat")}
            type="button"
          >
            Seat shell
          </button>
          <button
            className="action secondary-action"
            disabled={!spectatorView}
            onClick={() => setPreferredMode("spectator")}
            type="button"
          >
            Spectator shell
          </button>
        </div>

        {isReconnecting ? (
          <p className="support-copy">
            Reconnecting to the Convex live query stream. The cached projection
            remains visible while the subscription recovers.
          </p>
        ) : null}

        {isLoading ? (
          <p className="support-copy">
            Subscribing to the live match shell, seat cache, and spectator
            projection.
          </p>
        ) : !view || !shell ? (
          <p className="support-copy">
            The selected match no longer has an accessible live view for this
            account.
          </p>
        ) : (
          <>
            <MatchSeatStrip shell={shell} view={view} />

            <div className="match-layout">
              <div className="match-board-column">
                <Suspense
                  fallback={
                    <div className="board-inspector board-inspector-idle">
                      <div>
                        <p className="match-zone-label">Pixi renderer</p>
                        <h4>Loading battlefield</h4>
                        <p className="support-copy">
                          Splitting the renderer out of the base app bundle and
                          mounting the live Pixi surface for this match.
                        </p>
                      </div>
                    </div>
                  }
                >
                  <LazyBoardCanvas
                    catalog={catalog}
                    disabled={pendingIntent !== null}
                    onActivateAbility={submitActivateAbility}
                    onPlayCard={submitPlayCard}
                    view={view}
                  />
                </Suspense>

                {view.seats.map((seat) => {
                  const graveyard = getZoneView(view, seat.seat, "graveyard");
                  const exile = getZoneView(view, seat.seat, "exile");
                  const deck = getZoneView(view, seat.seat, "deck");
                  const isViewerSeat =
                    view.kind === "seat" && seat.seat === view.viewerSeat;

                  return (
                    <section className="match-player-zone" key={seat.seat}>
                      <div className="match-player-header">
                        <div>
                          <p className="match-player-title">
                            {seat.username ?? seat.seat}
                            {isViewerSeat ? " · your seat" : ""}
                          </p>
                          <p className="library-card-meta">
                            {seat.hasPriority
                              ? "Priority owner"
                              : shell.prioritySeat === seat.seat
                                ? "Priority window"
                                : "Waiting"}
                          </p>
                        </div>
                        <dl className="stats match-zone-stats">
                          <div>
                            <dt>Deck</dt>
                            <dd>{deck?.cardCount ?? 0}</dd>
                          </div>
                          <div>
                            <dt>Graveyard</dt>
                            <dd>{graveyard?.cardCount ?? 0}</dd>
                          </div>
                          <div>
                            <dt>Exile</dt>
                            <dd>{exile?.cardCount ?? 0}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="match-zone-block">
                        <div className="match-zone-label-row">
                          <p className="match-zone-label">Board reserves</p>
                          <span>{deck?.cardCount ?? 0} deck</span>
                        </div>
                        <p className="support-copy">
                          {isViewerSeat
                            ? "The Pixi surface now owns battlefield and hand presentation. Graveyard and exile remain listed here for inspection."
                            : "Opponent board presence is rendered in the shared Pixi surface above."}
                        </p>
                      </div>

                      <div className="match-zone-row">
                        <div className="match-zone-block match-zone-block-compact">
                          <div className="match-zone-label-row">
                            <p className="match-zone-label">Exile</p>
                            <span>{exile?.cardCount ?? 0}</span>
                          </div>
                          <div className="match-mini-list">
                            {exile?.cards.map((card) => (
                              <p
                                className="match-mini-list-item"
                                key={card.instanceId}
                              >
                                {card.name}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="match-zone-block match-zone-block-compact">
                          <div className="match-zone-label-row">
                            <p className="match-zone-label">Graveyard</p>
                            <span>{graveyard?.cardCount ?? 0}</span>
                          </div>
                          <div className="match-mini-list">
                            {graveyard?.cards.map((card) => (
                              <p
                                className="match-mini-list-item"
                                key={card.instanceId}
                              >
                                {card.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              <aside className="match-sidebar">
                <section className="match-sidebar-card">
                  <div className="match-zone-label-row">
                    <p className="match-zone-label">Prompt</p>
                    <span>{view.prompt ? view.prompt.kind : "idle"}</span>
                  </div>
                  {view.kind === "seat" && view.prompt ? (
                    <div className="panel-stack">
                      <p className="support-copy">{view.prompt.message}</p>
                      <div className="match-choice-list">
                        {view.prompt.choices.map((choice) => {
                          const promptIntent = buildPromptIntent({
                            choice,
                            view,
                          });

                          return (
                            <button
                              className="action"
                              disabled={!promptIntent || pendingIntent !== null}
                              key={choice.choiceId}
                              onClick={() => {
                                if (!promptIntent) {
                                  return;
                                }
                                void submitIntent(promptIntent);
                              }}
                              type="button"
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="support-copy">
                      {mode === "spectator"
                        ? "Spectators never receive prompts."
                        : "No prompt is waiting on this seat."}
                    </p>
                  )}
                </section>

                <section className="match-sidebar-card">
                  <div className="match-zone-label-row">
                    <p className="match-zone-label">Command rail</p>
                    <span>{view.stack.length} stack objects</span>
                  </div>
                  {view.kind === "seat" ? (
                    <div className="match-choice-list">
                      <button
                        className="action secondary-action"
                        disabled={
                          !view.availableIntents.includes("passPriority") ||
                          pendingIntent !== null
                        }
                        onClick={() =>
                          submitIntent({
                            intentId: createIntentId("passPriority"),
                            kind: "passPriority",
                            matchId: shell.id,
                            payload: {},
                            seat: gameplaySeat ?? "seat-0",
                            stateVersion: shell.version,
                          })
                        }
                        type="button"
                      >
                        Pass priority
                      </button>
                      <button
                        className="action secondary-action"
                        disabled={pendingIntent !== null}
                        onClick={() =>
                          submitIntent({
                            intentId: createIntentId("toggleAutoPass"),
                            kind: "toggleAutoPass",
                            matchId: shell.id,
                            payload: {
                              enabled: !view.seats.find(
                                (seat) => seat.seat === view.viewerSeat,
                              )?.autoPassEnabled,
                            },
                            seat: gameplaySeat ?? "seat-0",
                            stateVersion: shell.version,
                          })
                        }
                        type="button"
                      >
                        Toggle auto-pass
                      </button>
                      <button
                        className="action secondary-action"
                        disabled={pendingIntent !== null}
                        onClick={() =>
                          submitIntent({
                            intentId: createIntentId("concede"),
                            kind: "concede",
                            matchId: shell.id,
                            payload: {
                              reason: "manual",
                            },
                            seat: gameplaySeat ?? "seat-0",
                            stateVersion: shell.version,
                          })
                        }
                        type="button"
                      >
                        Concede match
                      </button>
                    </div>
                  ) : (
                    <p className="support-copy">
                      Spectator mode exposes no gameplay mutations and no
                      private hand details.
                    </p>
                  )}
                </section>

                <section className="match-sidebar-card">
                  <div className="match-zone-label-row">
                    <p className="match-zone-label">Stack rail</p>
                    <span>{view.stack.length}</span>
                  </div>
                  <div className="match-mini-list">
                    {view.stack.length === 0 ? (
                      <p className="match-mini-list-item">
                        No objects on the stack.
                      </p>
                    ) : (
                      view.stack.map((item) => (
                        <p className="match-mini-list-item" key={item.stackId}>
                          {item.label}
                        </p>
                      ))
                    )}
                  </div>
                </section>

                <section className="match-sidebar-card">
                  <div className="match-zone-label-row">
                    <p className="match-zone-label">Timers</p>
                    <span>{shell.status}</span>
                  </div>
                  <dl className="stats match-zone-stats">
                    <div>
                      <dt>Active deadline</dt>
                      <dd>{formatDeadline(shell.timers.activeDeadlineAt)}</dd>
                    </div>
                    <div>
                      <dt>Rope deadline</dt>
                      <dd>{formatDeadline(shell.timers.ropeDeadlineAt)}</dd>
                    </div>
                    <div>
                      <dt>Turn started</dt>
                      <dd>{formatDeadline(shell.timers.turnStartedAt)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="match-sidebar-card">
                  <div className="match-zone-label-row">
                    <p className="match-zone-label">Recent events</p>
                    <span>{view.recentEvents.length}</span>
                  </div>
                  <div className="match-mini-list">
                    {view.recentEvents.length === 0 ? (
                      <p className="match-mini-list-item">
                        No events have been recorded yet.
                      </p>
                    ) : (
                      view.recentEvents.map((event) => (
                        <p
                          className="match-mini-list-item"
                          key={`${event.sequence}-${event.kind}`}
                        >
                          {event.sequence}. {event.label}
                        </p>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
