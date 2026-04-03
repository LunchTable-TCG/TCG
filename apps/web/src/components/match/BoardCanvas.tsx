import { PixiMatchBoard } from "@lunchtable/render-pixi/react";
import type {
  CardCatalogEntry,
  MatchCardView,
  MatchView,
} from "@lunchtable/shared-types";
import { useEffect, useRef, useState } from "react";

import { listActivatedAbilityActions } from "./model";

interface BoardCanvasAction {
  kind: "activateAbility" | "playCard";
  label: string;
  onClick: () => void;
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
  }) => void;
  onPlayCard: (cardInstanceId: string) => void;
  view: MatchView;
}) {
  const { hostRef, viewport } = useBoardViewport();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const activatedAbilities =
    view.kind === "seat" ? listActivatedAbilityActions(catalog, view) : [];
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

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }

    if (!findCard(view, selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [selectedCardId, view]);

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
