import type { ReplayFrame, ReplaySummary } from "@lunchtable/shared-types";
import { Suspense, useEffect, useMemo, useState } from "react";

import { LazyBoardCanvas } from "../match/LazyBoardCanvas";
import { formatLocalTime } from "../shared";

export function ReplayPlayer({
  frames,
  loading,
  summary,
}: {
  frames: ReplayFrame[];
  loading: boolean;
  summary: ReplaySummary | null;
}) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length === 0) {
      setFrameIndex(0);
      return;
    }

    setFrameIndex((current) => Math.min(current, frames.length - 1));
  }, [frames]);

  const activeFrame = frames[frameIndex] ?? null;
  const frameLabel = useMemo(() => {
    if (!activeFrame) {
      return "No replay frame selected";
    }

    return `${activeFrame.frameIndex + 1}/${frames.length} · ${activeFrame.label}`;
  }, [activeFrame, frames.length]);

  return (
    <section className="workspace-card workspace-card-dark">
      <div className="panel-stack">
        <div>
          <p className="eyebrow">Replay</p>
          <h3>Deterministic spectator frames</h3>
        </div>
        {loading ? (
          <p className="support-copy">
            Loading replay summary and frame checkpoints.
          </p>
        ) : !summary ? (
          <p className="support-copy">
            No replay capture is available for the selected match yet.
          </p>
        ) : frames.length === 0 || !activeFrame ? (
          <p className="support-copy">
            Replay metadata exists, but no spectator-safe frames were returned.
          </p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Status</dt>
                <dd>{summary.status}</dd>
              </div>
              <div>
                <dt>Frames</dt>
                <dd>{summary.totalFrames}</dd>
              </div>
              <div>
                <dt>Winner</dt>
                <dd>{summary.winnerSeat ?? "pending"}</dd>
              </div>
            </dl>

            <div className="inline-actions inline-actions-tight">
              <button
                className="action secondary-action"
                disabled={frameIndex === 0}
                onClick={() => setFrameIndex(0)}
                type="button"
              >
                First
              </button>
              <button
                className="action secondary-action"
                disabled={frameIndex === 0}
                onClick={() =>
                  setFrameIndex((current) => Math.max(0, current - 1))
                }
                type="button"
              >
                Previous
              </button>
              <button
                className="action secondary-action"
                disabled={frameIndex >= frames.length - 1}
                onClick={() =>
                  setFrameIndex((current) =>
                    Math.min(frames.length - 1, current + 1),
                  )
                }
                type="button"
              >
                Next
              </button>
              <button
                className="action secondary-action"
                disabled={frameIndex >= frames.length - 1}
                onClick={() => setFrameIndex(frames.length - 1)}
                type="button"
              >
                Last
              </button>
            </div>

            <label className="field">
              <span>{frameLabel}</span>
              <input
                max={Math.max(frames.length - 1, 0)}
                min={0}
                onChange={(event) => setFrameIndex(Number(event.target.value))}
                type="range"
                value={frameIndex}
              />
            </label>

            <div className="board-shell">
              <div className="board-inspector">
                <div>
                  <p className="match-zone-label">Frame event</p>
                  <h4>{activeFrame.label}</h4>
                  <p className="support-copy">
                    Sequence {activeFrame.eventSequence} ·{" "}
                    {activeFrame.eventKind}
                  </p>
                  <p className="microcopy">
                    Captured at {formatLocalTime(activeFrame.recordedAt)}
                  </p>
                </div>
              </div>

              <Suspense
                fallback={
                  <div className="board-inspector board-inspector-idle">
                    <div>
                      <p className="match-zone-label">Replay renderer</p>
                      <h4>Loading frame</h4>
                      <p className="support-copy">
                        Mounting the shared Pixi battlefield renderer for the
                        selected replay checkpoint.
                      </p>
                    </div>
                  </div>
                }
              >
                <LazyBoardCanvas
                  catalog={[]}
                  disabled
                  onActivateAbility={() => undefined}
                  onPlayCard={() => undefined}
                  view={activeFrame.view}
                />
              </Suspense>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
