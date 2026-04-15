import type { MatchView } from "@lunchtable/shared-types";
import { Application, useExtend } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { useRef, useState } from "react";

import { createBoardSceneModel } from "./model";

function BoardBackdrop({
  cueLabel,
  height,
  width,
}: {
  cueLabel: string | null;
  height: number;
  width: number;
}) {
  const startedAtRef = useRef<number>(Date.now());

  return (
    <pixiGraphics
      draw={(graphics) => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const pulse = Math.max(0, 1 - elapsed / 1.1);
        const glowAlpha = pulse * 0.22;

        graphics.clear();
        graphics.roundRect(10, 10, width - 20, height - 20, 28);
        graphics.fill({
          color: 0x102437,
          alpha: 0.94,
        });

        graphics.roundRect(
          width * 0.12,
          height * 0.08,
          width * 0.76,
          height * 0.28,
          26,
        );
        graphics.fill({
          color: 0x173349,
          alpha: 0.84,
        });

        graphics.roundRect(
          width * 0.12,
          height * 0.44,
          width * 0.76,
          height * 0.28,
          26,
        );
        graphics.fill({
          color: 0x21485f,
          alpha: 0.9,
        });

        graphics.roundRect(
          width * 0.72,
          height * 0.18,
          width * 0.2,
          height * 0.42,
          24,
        );
        graphics.fill({
          color: 0x281b3a,
          alpha: 0.74,
        });

        if (cueLabel) {
          graphics.roundRect(width * 0.28, 20, width * 0.44, 36, 18);
          graphics.fill({
            color: 0xe3b55f,
            alpha: 0.14 + glowAlpha,
          });
        }

        graphics.roundRect(10, 10, width - 20, height - 20, 28);
        graphics.stroke({
          color: 0xf2d18a,
          alpha: 0.24 + glowAlpha,
          width: 2,
        });
      }}
    />
  );
}

function MatchBoardScene({
  height,
  onSelectCard,
  selectedCardId,
  view,
  width,
}: {
  height: number;
  onSelectCard: (instanceId: string | null) => void;
  selectedCardId: string | null;
  view: MatchView;
  width: number;
}) {
  useExtend({
    Container,
    Graphics,
    Text,
  });

  const scene = createBoardSceneModel({
    selectedCardId,
    view,
    viewport: {
      height,
      width,
    },
  });
  const cueKey = scene.cue
    ? `${scene.cue.kind}:${scene.cue.eventSequence}`
    : "idle";

  return (
    <Application
      backgroundAlpha={0}
      defaultTextStyle={{
        fill: "#fdf4dd",
        fontFamily: "IBM Plex Sans",
        fontSize: 14,
        fontWeight: "600",
      }}
      height={height}
      width={width}
    >
      <pixiContainer>
        <BoardBackdrop
          key={cueKey}
          cueLabel={scene.cue?.label ?? null}
          height={height}
          width={width}
        />

        {scene.cue ? (
          <pixiText
            anchor={0.5}
            style={{
              fill: "#f7deab",
              fontFamily: "IBM Plex Sans",
              fontSize: 14,
              fontWeight: "700",
            }}
            text={scene.cue.label}
            x={width * 0.5}
            y={38}
          />
        ) : null}

        {scene.seats.map((seat) => (
          <pixiContainer
            key={seat.seat}
            x={38}
            y={seat.lane === "home" ? height * 0.69 : height * 0.06}
          >
            <pixiText
              style={{
                fill: seat.lane === "home" ? "#fbe6bb" : "#b9d6ef",
                fontFamily: "IBM Plex Sans",
                fontSize: 18,
                fontWeight: "700",
              }}
              text={seat.name}
            />
            <pixiText
              style={{
                fill: "#d3e1ea",
                fontFamily: "IBM Plex Sans",
                fontSize: 13,
                fontWeight: "500",
              }}
              text={`Life ${seat.lifeTotal} · ${seat.resourceText}`}
              y={22}
            />
          </pixiContainer>
        ))}

        {scene.stack.map((item, index) => (
          <pixiContainer key={item.stackId} x={item.x} y={item.y}>
            <pixiGraphics
              draw={(graphics) => {
                graphics.clear();
                graphics.roundRect(0, 0, width * 0.14, 40, 16);
                graphics.fill({
                  color: 0x54307d,
                  alpha: index === 0 ? 0.9 : 0.68,
                });
                graphics.stroke({
                  color: 0xf4d19f,
                  alpha: 0.24,
                  width: 1.5,
                });
              }}
            />
            <pixiText
              style={{
                fill: "#fbf1da",
                fontFamily: "IBM Plex Sans",
                fontSize: 11,
                fontWeight: "600",
                wordWrap: true,
                wordWrapWidth: width * 0.12,
              }}
              text={item.label}
              x={10}
              y={8}
            />
          </pixiContainer>
        ))}

        {scene.visibleCards.map((card) => {
          const elevation = card.isSelected ? 12 : 0;
          const fillColor = !card.isFaceUp
            ? 0x5b4d71
            : card.zone === "battlefield"
              ? card.lane === "home"
                ? 0xf0d5a3
                : 0xb7d5ed
              : card.lane === "home"
                ? 0xefe6d0
                : 0xb8c7d5;

          return (
            <pixiContainer
              key={card.instanceId}
              x={card.x}
              y={card.y - elevation}
            >
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: Pixi graphics are pointer-only; keyboard access is handled by the HTML inspector. */}
              <pixiGraphics
                cursor={card.interactive ? "pointer" : "default"}
                draw={(graphics) => {
                  graphics.clear();
                  graphics.roundRect(0, 0, card.width, card.height, 18);
                  graphics.fill({
                    color: fillColor,
                    alpha: card.isSelected ? 1 : 0.94,
                  });
                  graphics.stroke({
                    color: card.isSelected ? 0xf39b4d : 0x1f2430,
                    alpha: card.isSelected ? 0.92 : 0.28,
                    width: card.isSelected ? 3 : 1.5,
                  });

                  if (card.zone === "battlefield") {
                    graphics.roundRect(8, 8, card.width - 16, 22, 10);
                    graphics.fill({
                      color: card.lane === "home" ? 0x9d6230 : 0x365d8e,
                      alpha: 0.22,
                    });
                  }
                }}
                eventMode={card.interactive ? "static" : "passive"}
                onClick={() =>
                  onSelectCard(
                    selectedCardId === card.instanceId ? null : card.instanceId,
                  )
                }
                onPointerEnter={() => {
                  if (card.interactive) {
                    onSelectCard(card.instanceId);
                  }
                }}
              />
              <pixiText
                style={{
                  fill: card.isFaceUp ? "#23170d" : "#f7edde",
                  fontFamily: "IBM Plex Sans",
                  fontSize: 11,
                  fontWeight: "700",
                  wordWrap: true,
                  wordWrapWidth: card.width - 14,
                }}
                text={card.label}
                x={8}
                y={8}
              />
              {card.statLine ? (
                <pixiText
                  anchor={1}
                  style={{
                    fill: card.isFaceUp ? "#23170d" : "#f7edde",
                    fontFamily: "IBM Plex Sans",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                  text={card.statLine}
                  x={card.width - 10}
                  y={card.height - 18}
                />
              ) : null}
            </pixiContainer>
          );
        })}
      </pixiContainer>
    </Application>
  );
}

export function PixiMatchBoard({
  height,
  onSelectCard,
  selectedCardId,
  view,
  width,
}: {
  height: number;
  onSelectCard: (instanceId: string | null) => void;
  selectedCardId: string | null;
  view: MatchView;
  width: number;
}) {
  return (
    <div aria-label="Pixi battlefield renderer">
      <MatchBoardScene
        height={height}
        onSelectCard={onSelectCard}
        selectedCardId={selectedCardId}
        view={view}
        width={width}
      />
    </div>
  );
}
