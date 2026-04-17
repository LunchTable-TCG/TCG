import type {
  AgentLabMessageRecord,
  AgentLabPurpose,
  AgentLabSessionId,
  AgentLabSessionRecord,
  ReplaySummary,
} from "@lunchtable/shared-types";
import { useState } from "react";

import { formatLocalTime } from "../shared";

function getPromptPlaceholder(purpose: AgentLabPurpose | null) {
  if (purpose === "coach") {
    return "Explain the strongest line available from this seat.";
  }
  if (purpose === "commentator") {
    return "Summarize the public board and recent swing points.";
  }
  return "Open a notes thread first.";
}

export function AgentLabPanel({
  loadingMessages,
  loadingSessions,
  messages,
  onArchiveSession,
  onEnsureSession,
  onSelectSession,
  onSendPrompt,
  pendingAction,
  replaySummary,
  selectedMatchId,
  selectedSessionId,
  sessions,
}: {
  loadingMessages: boolean;
  loadingSessions: boolean;
  messages: AgentLabMessageRecord[];
  onArchiveSession: (sessionId: AgentLabSessionId) => void;
  onEnsureSession: (purpose: AgentLabPurpose) => void;
  onSelectSession: (sessionId: AgentLabSessionId) => void;
  onSendPrompt: (sessionId: AgentLabSessionId, prompt: string) => void;
  pendingAction: string | null;
  replaySummary: ReplaySummary | null;
  selectedMatchId: string | null;
  selectedSessionId: AgentLabSessionId | null;
  sessions: AgentLabSessionRecord[];
}) {
  const [prompt, setPrompt] = useState("");
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? null;

  return (
    <section className="panel panel-secondary">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Optional Analysis</p>
          <h2>Out-of-band coach and commentator notes</h2>
        </div>
        <p className="support-copy">
          These threads are separate from live player seats. They can explain a
          position, but they never submit intents or advance the authoritative
          match.
        </p>
      </div>

      <div className="library-grid">
        <section className="workspace-card">
          <div className="panel-stack">
            <div className="panel-header-row">
              <div>
                <p className="eyebrow">Thread control</p>
                <h3>Optional review sessions</h3>
              </div>
              <div className="inline-actions inline-actions-tight">
                <button
                  className="action secondary-action"
                  disabled={!selectedMatchId || pendingAction !== null}
                  onClick={() => onEnsureSession("coach")}
                  type="button"
                >
                  {pendingAction === "ensure:coach"
                    ? "Opening coach notes..."
                    : "Open coach notes"}
                </button>
                <button
                  className="action secondary-action"
                  disabled={!selectedMatchId || pendingAction !== null}
                  onClick={() => onEnsureSession("commentator")}
                  type="button"
                >
                  {pendingAction === "ensure:commentator"
                    ? "Opening commentator notes..."
                    : "Open commentator notes"}
                </button>
              </div>
            </div>
            {!selectedMatchId ? (
              <p className="support-copy">
                Select a persisted match shell first to open a notes thread.
              </p>
            ) : (
              <dl className="stats">
                <div>
                  <dt>Match</dt>
                  <dd>{selectedMatchId}</dd>
                </div>
                <div>
                  <dt>Replay</dt>
                  <dd>
                    {replaySummary
                      ? `${replaySummary.totalFrames} frames`
                      : "Not captured yet"}
                  </dd>
                </div>
                <div>
                  <dt>Sessions</dt>
                  <dd>{sessions.length}</dd>
                </div>
              </dl>
            )}
            {loadingSessions ? (
              <p className="support-copy">Loading agent sessions.</p>
            ) : sessions.length === 0 ? (
              <p className="support-copy">
                No optional notes threads for this match yet.
              </p>
            ) : (
              <div className="deck-list">
                {sessions.map((session) => (
                  <article
                    className={`library-card ${
                      selectedSessionId === session.id
                        ? "library-card-active"
                        : ""
                    }`}
                    key={session.id}
                  >
                    <div className="panel-stack">
                      <div className="panel-header-row">
                        <div>
                          <p className="library-card-title">{session.title}</p>
                          <p className="library-card-meta">
                            {session.purpose} · {session.status}
                          </p>
                        </div>
                        <button
                          className="action secondary-action"
                          disabled={pendingAction !== null}
                          onClick={() => onSelectSession(session.id)}
                          type="button"
                        >
                          {selectedSessionId === session.id ? "Open" : "View"}
                        </button>
                      </div>
                      <p className="support-copy">
                        {session.latestReplyPreview ??
                          "No assistant reply saved yet."}
                      </p>
                      <button
                        className="action secondary-action"
                        disabled={pendingAction !== null}
                        onClick={() => onArchiveSession(session.id)}
                        type="button"
                      >
                        {pendingAction === `archive-session:${session.id}`
                          ? "Archiving..."
                          : "Archive thread"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="workspace-card workspace-card-dark">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Thread log</p>
              <h3>
                {selectedSession
                  ? selectedSession.purpose === "coach"
                    ? "Coach conversation"
                    : "Commentator conversation"
                  : "No active thread"}
              </h3>
            </div>
            {!selectedSession ? (
              <p className="support-copy">
                Open a notes thread to inspect saved analysis for this match.
              </p>
            ) : (
              <>
                <label className="field">
                  <span>Prompt</span>
                  <textarea
                    disabled={pendingAction !== null}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={getPromptPlaceholder(selectedSession.purpose)}
                    rows={4}
                    value={prompt}
                  />
                </label>
                <button
                  className="action action-contrast"
                  disabled={pendingAction !== null || prompt.trim() === ""}
                  onClick={() => {
                    const trimmedPrompt = prompt.trim();
                    if (!trimmedPrompt) {
                      return;
                    }
                    onSendPrompt(selectedSession.id, trimmedPrompt);
                    setPrompt("");
                  }}
                  type="button"
                >
                  {pendingAction === `send-session:${selectedSession.id}`
                    ? "Generating analysis..."
                    : "Send prompt"}
                </button>
                {loadingMessages ? (
                  <p className="support-copy">Loading thread messages.</p>
                ) : messages.length === 0 ? (
                  <p className="support-copy">
                    No saved messages yet. Send a prompt to generate the first
                    analysis reply.
                  </p>
                ) : (
                  <div className="agent-message-list">
                    {messages.map((message) => (
                      <article
                        className={`agent-message agent-message-${message.role}`}
                        key={message.key}
                      >
                        <div className="panel-header-row">
                          <p className="library-card-title">
                            {message.agentName ??
                              (message.role === "user" ? "You" : message.role)}
                          </p>
                          <p className="library-card-meta">
                            {formatLocalTime(message.createdAt)}
                          </p>
                        </div>
                        <p className="agent-message-text">{message.text}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
