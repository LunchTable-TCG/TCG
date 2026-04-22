import { PixiMatchBoard } from "@lunchtable/render-pixi/react";
import type {
  CardCatalogEntry,
  MatchCardView,
  MatchView,
} from "@lunchtable/shared-types";
import {
  type CSSProperties,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_MATCH_CINEMATIC_ASSET_BASE_URL,
  buildMatchCinematicAssetBundle,
  buildMatchCinematicSceneModel,
} from "./cinematics";
import {
  type MatchCinematicCue,
  deriveMatchCinematicCue,
  listActivatedAbilityActions,
} from "./model";

const MatchCinematicPortal = lazy(async () => {
  const module = await import("./MatchCinematicPortal");

  return {
    default: module.MatchCinematicPortal,
  };
});

interface BoardCanvasAction {
  kind: "activateAbility" | "playCard";
  label: string;
  onClick: () => void;
}

function SummonOverlay({
  assetBundle,
  cue,
  sceneModel,
}: {
  assetBundle: ReturnType<typeof buildMatchCinematicAssetBundle> | null;
  cue: MatchCinematicCue | null;
  sceneModel: ReturnType<typeof buildMatchCinematicSceneModel> | null;
}) {
  if (!cue || !sceneModel) {
    return null;
  }

  const style = {
    "--summon-accent": sceneModel.accentColor,
    "--summon-aura": sceneModel.auraColor,
    "--summon-ground": sceneModel.groundColor,
    "--summon-rim": sceneModel.rimColor,
    "--summon-ring": sceneModel.ringColor,
  } as CSSProperties;

  return (
    <output
      aria-live="polite"
      className={`board-summon-overlay board-summon-overlay-${cue.kind}`}
      style={style}
    >
      <div className="board-summon-rift" />
      <div className="board-summon-avatar">
        <div className="board-summon-viewport">
          {assetBundle?.posterUrl ? (
            <img
              alt=""
              aria-hidden="true"
              className="board-summon-poster"
              src={assetBundle.posterUrl}
            />
          ) : null}
          <Suspense fallback={<div className="board-summon-fallback-glyph" />}>
            <MatchCinematicPortal
              assetBundle={assetBundle}
              sceneModel={sceneModel}
            />
          </Suspense>
        </div>
        <div className="board-summon-avatar-shell" />
      </div>
      <div className="board-summon-copy">
        <p className="match-zone-label">{cue.kicker}</p>
        <h4>{cue.cardName}</h4>
        <p className="microcopy">{cue.label}</p>
      </div>
    </output>
  );
}

function findCard(
  view: MatchView,
  instanceId: string | null,
): MatchCardView | null {
  if (!instanceId) {
    return null;
  }

  for (const zone of view.zones) {
    const card = zone.cards.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (card) {
      return card;
    }
  }

  return null;
}

function useBoardViewport() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({
    height: 468,
    width: 880,
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.max(
        320,
        Math.floor(entry?.contentRect.width ?? host.clientWidth),
      );
      const height = Math.round(Math.min(620, Math.max(420, width * 0.62)));

      setViewport((current) => {
        if (current.width === width && current.height === height) {
          return current;
        }

        return {
          height,
          width,
        };
      });
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return {
    hostRef,
    viewport,
  };
}

function buildActions(input: {
  activatedAbilities: ReturnType<typeof listActivatedAbilityActions>;
  card: MatchCardView;
  onActivateAbility: (args: {
    abilityId: string;
    cardInstanceId: string;
    targetIds?: string[];
  }) => void;
  onPlayCard: (cardInstanceId: string) => void;
  view: MatchView;
}): BoardCanvasAction[] {
  const actions: BoardCanvasAction[] = [];

  if (
    input.view.kind === "seat" &&
    input.card.controllerSeat === input.view.viewerSeat &&
    input.card.zone === "hand" &&
    input.view.availableIntents.includes("playCard")
  ) {
    actions.push({
      kind: "playCard",
      label: "Cast to stack",
      onClick: () => input.onPlayCard(input.card.instanceId),
    });
  }

  if (
    input.view.kind === "seat" &&
    input.card.controllerSeat === input.view.viewerSeat &&
    input.card.zone === "battlefield"
  ) {
    for (const ability of input.activatedAbilities) {
      if (ability.instanceId !== input.card.instanceId) {
        continue;
      }

      actions.push({
        kind: "activateAbility",
        label: ability.text,
        onClick: () =>
          input.onActivateAbility({
            abilityId: ability.abilityId,
            cardInstanceId: input.card.instanceId,
            targetIds: ability.targetIds,
          }),
      });
    }
  }

  return actions;
}

export function BoardCanvas({
  catalog,
  disabled,
  onActivateAbility,
  onPlayCard,
  view,
}: {
  catalog: CardCatalogEntry[];
  disabled: boolean;
  onActivateAbility: (args: {
    abilityId: string;
    cardInstanceId: string;
    targetIds?: string[];
  }) => void;
  onPlayCard: (cardInstanceId: string) => void;
  view: MatchView;
}) {
  const { hostRef, viewport } = useBoardViewport();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [visibleCinematicCue, setVisibleCinematicCue] =
    useState<MatchCinematicCue | null>(null);
  const catalogEntryById = useMemo(
    () => new Map(catalog.map((entry) => [entry.cardId, entry])),
    [catalog],
  );
  const activatedAbilities =
    view.kind === "seat" ? listActivatedAbilityActions(catalog, view) : [];
  const cinematicCue = deriveMatchCinematicCue(view);
  const cinematicCueKey = cinematicCue
    ? `${cinematicCue.kind}:${cinematicCue.eventSequence}`
    : null;
  const clearTimerRef = useRef<number | null>(null);
  const lastCinematicCueKeyRef = useRef<string | null>(null);
  const selectedCard = findCard(view, selectedCardId);
  const actions = selectedCard
    ? buildActions({
        activatedAbilities,
        card: selectedCard,
        onActivateAbility,
        onPlayCard,
        view,
      })
    : [];
  const visibleCinematicCard =
    visibleCinematicCue?.cardId !== undefined
      ? (catalogEntryById.get(visibleCinematicCue.cardId) ?? null)
      : null;
  const visibleCinematicSceneModel = useMemo(() => {
    if (!visibleCinematicCue) {
      return null;
    }

    return buildMatchCinematicSceneModel({
      card: visibleCinematicCard,
      cue: visibleCinematicCue,
    });
  }, [visibleCinematicCard, visibleCinematicCue]);
  const visibleCinematicAssetBundle = useMemo(() => {
    if (!visibleCinematicCue) {
      return null;
    }

    return buildMatchCinematicAssetBundle({
      assetBaseUrl:
        import.meta.env.VITE_ASSET_CDN_BASE_URL?.trim() ||
        DEFAULT_MATCH_CINEMATIC_ASSET_BASE_URL,
      card: visibleCinematicCard,
      cue: visibleCinematicCue,
    });
  }, [visibleCinematicCard, visibleCinematicCue]);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }

    if (!findCard(view, selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [selectedCardId, view]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cinematicCue || !cinematicCueKey) {
      return;
    }

    if (cinematicCueKey === lastCinematicCueKeyRef.current) {
      return;
    }

    lastCinematicCueKeyRef.current = cinematicCueKey;
    setVisibleCinematicCue(cinematicCue);

    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = window.setTimeout(() => {
      setVisibleCinematicCue((current) => {
        if (!current) {
          return null;
        }

        const currentKey = `${current.kind}:${current.eventSequence}`;
        return currentKey === cinematicCueKey ? null : current;
      });
    }, 2200);
  }, [cinematicCue, cinematicCueKey]);

  return (
    <section className="board-shell">
      <div className="board-shell-surface" ref={hostRef}>
        <PixiMatchBoard
          height={viewport.height}
          onSelectCard={setSelectedCardId}
          selectedCardId={selectedCardId}
          view={view}
          width={viewport.width}
        />
        <SummonOverlay
          assetBundle={visibleCinematicAssetBundle}
          cue={visibleCinematicCue}
          sceneModel={visibleCinematicSceneModel}
        />
      </div>

      <div className="board-shell-footer">
        {selectedCard ? (
          <div className="board-inspector">
            <div>
              <p className="match-zone-label">Focused card</p>
              <h4>{selectedCard.name}</h4>
              <p className="support-copy">
                {selectedCard.zone} ·{" "}
                {selectedCard.statLine
                  ? `${selectedCard.statLine.power ?? "?"}/${selectedCard.statLine.toughness ?? "?"}`
                  : "No stats"}
              </p>
              <p className="microcopy">
                {selectedCard.keywords.length > 0
                  ? selectedCard.keywords.join(" · ")
                  : "No keywords"}
              </p>
            </div>
            <div className="match-choice-list board-inspector-actions">
              {actions.length === 0 ? (
                <p className="microcopy">
                  {view.kind === "seat"
                    ? "No live action is available for the selected card."
                    : "Spectator mode is read-only."}
                </p>
              ) : (
                actions.map((action) => (
                  <button
                    className="action secondary-action"
                    disabled={disabled}
                    key={`${action.kind}:${action.label}`}
                    onClick={action.onClick}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="board-inspector board-inspector-idle">
            <div>
              <p className="match-zone-label">Board inspector</p>
              <h4>Hover or tap a card</h4>
              <p className="support-copy">
                The Pixi surface mirrors the live seat or spectator DTO without
                owning any gameplay rules.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
