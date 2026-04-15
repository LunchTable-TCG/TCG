import { starterFormat } from "@lunchtable/card-content";
import { createMatchSkeleton } from "@lunchtable/game-core";
import type {
  AgentLabMessageRecord,
  AgentLabSessionRecord,
  CardCatalogEntry,
  CollectionSummary,
  DeckId,
  DeckRecord,
  FormatRuntimeSettings,
  LobbyRecord,
  MatchSeatId,
  MatchShell,
  MatchTelemetryEvent,
  QueueEntryRecord,
  RecoverableMatchRecord,
  ReplayFrame,
  ReplaySummary,
  ViewerIdentity,
} from "@lunchtable/shared-types";
import { APP_NAME } from "@lunchtable/shared-types";
import { useEffect, useState } from "react";

import type { LocalBscWallet } from "./auth";
import {
  clearAuthToken,
  getStoredAuthToken,
  loadViewerIdentity,
  signInWithPrivateKey,
  signUpWithGeneratedWallet,
  storeAuthToken,
} from "./auth";
import { AgentLabPanel } from "./components/agents/AgentLabPanel";
import { MatchShell as LiveMatchShell } from "./components/match/MatchShell";
import { ReplayPlayer } from "./components/replay/ReplayPlayer";
import {
  convexWalletAuthTransport,
  requireConvexWalletAuthTransport,
  syncConvexAuth,
} from "./convex/client";
import { getErrorMessage } from "./errors";

const bootstrapChecklist = [
  "Bun workspace configured",
  "Convex wallet auth live",
  "Starter collection seeded canonically",
  "Deck validation and CRUD online",
  "Match shell persistence online",
  "Lobby and queue matchmaking online",
  "Agent lab threads separated from live match state",
  "Operator format controls live",
];

const defaultFormatId = starterFormat.formatId;

type NoticeTone = "error" | "neutral" | "success" | "warning";

interface Notice {
  body: string;
  title: string;
  tone: NoticeTone;
}

function buildStarterDeckEntries(catalog: CardCatalogEntry[]) {
  return catalog.map((card) => ({
    cardId: card.cardId,
    count: starterFormat.deckRules.maxCopies,
  }));
}

function getActiveLegalDeck(decks: DeckRecord[]) {
  return decks.find(
    (deck) => deck.status === "active" && deck.validation.isLegal,
  );
}

async function loadLibrarySnapshot() {
  const transport = requireConvexWalletAuthTransport();

  const [catalog, collection, decks] = await Promise.all([
    transport.listCatalog({
      formatId: defaultFormatId,
    }),
    transport.getCollectionSummary({
      formatId: defaultFormatId,
    }),
    transport.listDecks({
      formatId: defaultFormatId,
    }),
  ]);

  return {
    catalog,
    collection,
    decks,
  };
}

async function loadMatchSnapshot() {
  return requireConvexWalletAuthTransport().listMyMatches({});
}

async function loadReplaySnapshot(matchId: string) {
  const transport = requireConvexWalletAuthTransport();

  const summary = await transport.getReplaySummary({
    matchId,
  });

  if (!summary) {
    return {
      frames: [],
      summary: null,
    };
  }

  const frameSlice = await transport.getReplayFrames({
    limit: summary.totalFrames,
    matchId,
    start: 0,
  });

  return {
    frames: frameSlice.frames,
    summary,
  };
}

async function loadPlaySnapshot() {
  const transport = requireConvexWalletAuthTransport();

  const [lobbies, queueEntries] = await Promise.all([
    transport.listMyLobbies(),
    transport.listMyQueueEntries({}),
  ]);

  return {
    lobbies,
    queueEntries,
  };
}

async function loadFormatSettingsSnapshot() {
  return requireConvexWalletAuthTransport().listFormatSettings();
}

async function loadRecoverableMatchesSnapshot() {
  return requireConvexWalletAuthTransport().listRecoverableMatches({
    limit: 8,
  });
}

async function loadTelemetrySnapshot() {
  return requireConvexWalletAuthTransport().listTelemetry({
    limit: 18,
  });
}

async function loadAgentLabSnapshot(matchId: string) {
  return requireConvexWalletAuthTransport().listAgentSessions({
    matchId,
  });
}

async function loadAgentSessionMessages(sessionId: string) {
  return requireConvexWalletAuthTransport().listAgentMessages({
    sessionId,
  });
}

function summarizeValidation(deck: DeckRecord) {
  const errorCount = deck.validation.issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = deck.validation.issues.length - errorCount;

  if (errorCount === 0 && warningCount === 0) {
    return "Legal";
  }

  return `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${
    warningCount === 1 ? "" : "s"
  }`;
}

function StatusBanner({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  return (
    <output className={`status-banner status-banner-${notice.tone}`}>
      <p className="status-title">{notice.title}</p>
      <p className="status-body">{notice.body}</p>
    </output>
  );
}

function SessionPanel({
  canSignOut,
  viewer,
  onSignOut,
  loading,
}: {
  canSignOut: boolean;
  loading: boolean;
  onSignOut: () => void;
  viewer: ViewerIdentity | null;
}) {
  return (
    <section className="utility-panel">
      <p className="eyebrow">Current Seat</p>
      <h3>Auth session</h3>
      {loading ? (
        <p className="support-copy">Restoring your session from Convex.</p>
      ) : viewer ? (
        <>
          <dl className="identity-list">
            <div>
              <dt>Username</dt>
              <dd>{viewer.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{viewer.email}</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{viewer.walletAddress ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{viewer.isOperator ? "Operator" : "Player"}</dd>
            </div>
          </dl>
          <button
            className="action secondary-action"
            disabled={!canSignOut}
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </>
      ) : (
        <p className="support-copy">
          No active session yet. Create a wallet or restore access with your
          saved private key.
        </p>
      )}
    </section>
  );
}

function PrivateKeyReveal({
  copied,
  onCopy,
  onDismiss,
  wallet,
}: {
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
  wallet: LocalBscWallet | null;
}) {
  return (
    <section className="utility-panel utility-panel-highlight">
      <p className="eyebrow">Recovery Material</p>
      <h3>Private key reveal</h3>
      {wallet ? (
        <>
          <p className="support-copy">
            This key is shown only after signup. Save it before leaving this
            screen. Lunch-Table cannot recover it for you.
          </p>
          <div className="key-box">
            <p className="key-label">Wallet address</p>
            <code>{wallet.address}</code>
            <p className="key-label">Private key</p>
            <code>{wallet.privateKey}</code>
          </div>
          <div className="inline-actions">
            <button className="action" onClick={onCopy} type="button">
              {copied ? "Private key copied" : "Copy private key"}
            </button>
            <button
              className="action secondary-action"
              onClick={onDismiss}
              type="button"
            >
              I saved it
            </button>
          </div>
        </>
      ) : (
        <p className="support-copy">
          Your next successful signup will reveal the generated BSC private key
          exactly in this recovery slot.
        </p>
      )}
    </section>
  );
}

function CollectionPanel({
  collection,
  loading,
}: {
  collection: CollectionSummary | null;
  loading: boolean;
}) {
  return (
    <section className="workspace-card">
      <div className="panel-stack">
        <div>
          <p className="eyebrow">Collection</p>
          <h3>{starterFormat.name}</h3>
        </div>
        {loading ? (
          <p className="support-copy">
            Syncing starter collection from Convex.
          </p>
        ) : !collection ? (
          <p className="support-copy">
            Sign in to fetch the seeded starter collection for this seat.
          </p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Unique cards</dt>
                <dd>{collection.totalUniqueCards}</dd>
              </div>
              <div>
                <dt>Total copies</dt>
                <dd>{collection.totalOwnedCards}</dd>
              </div>
            </dl>
            <div className="library-list">
              {collection.entries.map((entry) => (
                <article className="library-card" key={entry.card.cardId}>
                  <div>
                    <p className="library-card-title">{entry.card.name}</p>
                    <p className="library-card-meta">
                      {entry.card.kind} · {entry.card.rarity} ·{" "}
                      {entry.card.cost} cost
                    </p>
                  </div>
                  <strong>{entry.ownedCount} owned</strong>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function DeckPanel({
  canCreatePracticeMatch,
  canCreateStarterDeck,
  decks,
  loading,
  onArchiveDeck,
  onCloneDeck,
  onCreatePracticeMatch,
  onCreateStarterDeck,
  pendingAction,
}: {
  canCreatePracticeMatch: boolean;
  canCreateStarterDeck: boolean;
  decks: DeckRecord[];
  loading: boolean;
  onArchiveDeck: (deckId: DeckId, deckName: string) => void;
  onCloneDeck: (deckId: DeckId, deckName: string) => void;
  onCreatePracticeMatch: () => void;
  onCreateStarterDeck: () => void;
  pendingAction: string | null;
}) {
  return (
    <section className="workspace-card workspace-card-dark">
      <div className="panel-stack">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Decks</p>
            <h3>Saved lists</h3>
          </div>
          <button
            className="action action-contrast"
            disabled={!canCreateStarterDeck || pendingAction !== null}
            onClick={onCreateStarterDeck}
            type="button"
          >
            {pendingAction === "create"
              ? "Creating starter deck..."
              : "Create starter deck"}
          </button>
        </div>
        <button
          className="action secondary-action"
          disabled={!canCreatePracticeMatch || pendingAction !== null}
          onClick={onCreatePracticeMatch}
          type="button"
        >
          {pendingAction === "create-practice"
            ? "Creating practice match..."
            : "Create practice match"}
        </button>
        {loading ? (
          <p className="support-copy">Loading deck records from Convex.</p>
        ) : decks.length === 0 ? (
          <p className="support-copy">
            No saved decks yet. Create the default 40-card starter list to prove
            the validation path end to end.
          </p>
        ) : (
          <div className="deck-list">
            {decks.map((deck) => (
              <article className="deck-card" key={deck.id}>
                <div className="deck-card-header">
                  <div>
                    <p className="library-card-title">{deck.name}</p>
                    <p className="library-card-meta">
                      {deck.validation.mainboardCount} mainboard ·{" "}
                      {deck.validation.sideboardCount} sideboard
                    </p>
                  </div>
                  <span
                    className={`deck-status ${
                      deck.validation.isLegal
                        ? "deck-status-legal"
                        : "deck-status-illegal"
                    }`}
                  >
                    {summarizeValidation(deck)}
                  </span>
                </div>
                {deck.validation.issues.length > 0 ? (
                  <ul className="issue-list">
                    {deck.validation.issues.map((issue, index) => (
                      <li key={`${deck.id}-${issue.code}-${index}`}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="support-copy">
                    Fully legal against the user’s seeded starter collection.
                  </p>
                )}
                <div className="inline-actions">
                  <button
                    className="action secondary-action"
                    disabled={pendingAction !== null}
                    onClick={() => onCloneDeck(deck.id, deck.name)}
                    type="button"
                  >
                    {pendingAction === `clone:${deck.id}`
                      ? "Cloning..."
                      : "Clone"}
                  </button>
                  <button
                    className="action secondary-action"
                    disabled={
                      pendingAction !== null || deck.status === "archived"
                    }
                    onClick={() => onArchiveDeck(deck.id, deck.name)}
                    type="button"
                  >
                    {pendingAction === `archive:${deck.id}`
                      ? "Archiving..."
                      : deck.status === "archived"
                        ? "Archived"
                        : "Archive"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MatchShellPanel({
  loading,
  matches,
  onSelectMatch,
  replaySummary,
  selectedMatchId,
}: {
  loading: boolean;
  matches: MatchShell[];
  onSelectMatch: (matchId: string) => void;
  replaySummary: ReplaySummary | null;
  selectedMatchId: string | null;
}) {
  return (
    <section className="workspace-card">
      <div className="panel-stack">
        <div>
          <p className="eyebrow">Matches</p>
          <h3>Recent shells</h3>
        </div>
        {loading ? (
          <p className="support-copy">Loading persisted match shells.</p>
        ) : matches.length === 0 ? (
          <p className="support-copy">
            No persisted matches yet. Create a practice match from one of your
            legal decks.
          </p>
        ) : (
          <div className="deck-list">
            {matches.map((match) => (
              <article
                className={`library-card ${
                  selectedMatchId === match.id ? "library-card-active" : ""
                }`}
                key={match.id}
              >
                <div className="panel-stack">
                  <div className="panel-header-row">
                    <div>
                      <p className="library-card-title">{match.id}</p>
                      <p className="library-card-meta">
                        {match.status} · {match.phase} · turn {match.turnNumber}
                      </p>
                    </div>
                    <strong>{match.seats.length} seats</strong>
                  </div>
                  {selectedMatchId === match.id && replaySummary ? (
                    <p className="support-copy">
                      Replay frames: {replaySummary.totalFrames} ·{" "}
                      {replaySummary.status}
                    </p>
                  ) : null}
                  <button
                    className="action secondary-action"
                    onClick={() => onSelectMatch(match.id)}
                    type="button"
                  >
                    {selectedMatchId === match.id
                      ? "Viewing live shell"
                      : "Open live shell"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LobbyPanel({
  canCreate,
  joinCode,
  lobbies,
  loading,
  onCreate,
  onJoin,
  onJoinCodeChange,
  onLeave,
  onToggleReady,
  pendingAction,
  viewerId,
}: {
  canCreate: boolean;
  joinCode: string;
  lobbies: LobbyRecord[];
  loading: boolean;
  onCreate: () => void;
  onJoin: () => void;
  onJoinCodeChange: (value: string) => void;
  onLeave: (lobbyId: LobbyRecord["id"]) => void;
  onToggleReady: (lobbyId: LobbyRecord["id"], ready: boolean) => void;
  pendingAction: string | null;
  viewerId: ViewerIdentity["id"] | null;
}) {
  const currentLobby =
    lobbies.find(
      (lobby) => lobby.status === "open" || lobby.status === "readyCheck",
    ) ??
    lobbies[0] ??
    null;
  const localParticipant = currentLobby?.participants.find(
    (participant) => participant.userId === viewerId,
  );

  return (
    <section className="workspace-card">
      <div className="panel-stack">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Private Challenge</p>
            <h3>Lobby ready check</h3>
          </div>
          <button
            className="action"
            disabled={!canCreate || pendingAction !== null}
            onClick={onCreate}
            type="button"
          >
            {pendingAction === "create-lobby"
              ? "Creating lobby..."
              : "Create private lobby"}
          </button>
        </div>
        <label className="field">
          <span>Join with code</span>
          <div className="inline-actions inline-actions-tight">
            <input
              disabled={pendingAction !== null}
              onChange={(event) => onJoinCodeChange(event.target.value)}
              placeholder="ABC123"
              value={joinCode}
            />
            <button
              className="action secondary-action"
              disabled={
                !canCreate ||
                pendingAction !== null ||
                joinCode.trim().length < 6
              }
              onClick={onJoin}
              type="button"
            >
              {pendingAction === "join-lobby" ? "Joining..." : "Join"}
            </button>
          </div>
        </label>
        {loading ? (
          <p className="support-copy">Loading private lobby state.</p>
        ) : !currentLobby ? (
          <p className="support-copy">
            No active lobby yet. Create one from your first legal active deck or
            join with an invite code.
          </p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Code</dt>
                <dd>{currentLobby.code}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{currentLobby.status}</dd>
              </div>
              <div>
                <dt>Participants</dt>
                <dd>{currentLobby.participants.length}</dd>
              </div>
            </dl>
            <div className="deck-list">
              {currentLobby.participants.map((participant) => (
                <article
                  className="deck-card"
                  key={`${currentLobby.id}-${participant.slot}`}
                >
                  <p className="library-card-title">
                    {participant.username} · {participant.slot}
                  </p>
                  <p className="library-card-meta">
                    Ready: {participant.ready ? "yes" : "no"}
                  </p>
                  <p className="support-copy">Deck {participant.deckId}</p>
                </article>
              ))}
            </div>
            {currentLobby.matchId ? (
              <p className="support-copy">
                Match created: {currentLobby.matchId}
              </p>
            ) : localParticipant ? (
              <div className="inline-actions">
                <button
                  className="action secondary-action"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    onToggleReady(currentLobby.id, !localParticipant.ready)
                  }
                  type="button"
                >
                  {pendingAction === `ready:${currentLobby.id}`
                    ? "Updating..."
                    : localParticipant.ready
                      ? "Set not ready"
                      : "Set ready"}
                </button>
                <button
                  className="action secondary-action"
                  disabled={pendingAction !== null}
                  onClick={() => onLeave(currentLobby.id)}
                  type="button"
                >
                  {pendingAction === `leave:${currentLobby.id}`
                    ? "Leaving..."
                    : "Leave lobby"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function QueuePanel({
  canQueue,
  entries,
  loading,
  onDequeue,
  onEnqueue,
  pendingAction,
}: {
  canQueue: boolean;
  entries: QueueEntryRecord[];
  loading: boolean;
  onDequeue: (entryId: QueueEntryRecord["id"]) => void;
  onEnqueue: () => void;
  pendingAction: string | null;
}) {
  const currentEntry =
    entries.find((entry) => entry.status === "queued") ?? entries[0] ?? null;

  return (
    <section className="workspace-card workspace-card-dark">
      <div className="panel-stack">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">Casual Queue</p>
            <h3>Deterministic pairing</h3>
          </div>
          <button
            className="action action-contrast"
            disabled={!canQueue || pendingAction !== null}
            onClick={onEnqueue}
            type="button"
          >
            {pendingAction === "enqueue-casual"
              ? "Entering queue..."
              : "Enter casual queue"}
          </button>
        </div>
        {loading ? (
          <p className="support-copy">Loading queue state.</p>
        ) : !currentEntry ? (
          <p className="support-copy">
            No queue entry yet. Enter the casual queue from your first legal
            active deck.
          </p>
        ) : (
          <>
            <dl className="stats">
              <div>
                <dt>Status</dt>
                <dd>{currentEntry.status}</dd>
              </div>
              <div>
                <dt>Deck</dt>
                <dd>{currentEntry.deckId}</dd>
              </div>
              <div>
                <dt>Match</dt>
                <dd>{currentEntry.matchId ?? "pending"}</dd>
              </div>
            </dl>
            {currentEntry.status === "queued" ? (
              <button
                className="action secondary-action"
                disabled={pendingAction !== null}
                onClick={() => onDequeue(currentEntry.id)}
                type="button"
              >
                {pendingAction === `dequeue:${currentEntry.id}`
                  ? "Leaving queue..."
                  : "Leave queue"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function FormatAdminPanel({
  catalog,
  formatSettings,
  loading,
  onToggleBan,
  onTogglePublished,
  pendingAction,
}: {
  catalog: CardCatalogEntry[];
  formatSettings: FormatRuntimeSettings | null;
  loading: boolean;
  onToggleBan: (cardId: string) => void;
  onTogglePublished: (isPublished: boolean) => void;
  pendingAction: string | null;
}) {
  if (!formatSettings) {
    return null;
  }

  const orderedCatalog = [...catalog].sort((left, right) => {
    if (left.isBanned !== right.isBanned) {
      return Number(right.isBanned) - Number(left.isBanned);
    }

    return left.name.localeCompare(right.name);
  });

  return (
    <section className="panel panel-secondary">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Operator Controls</p>
          <h2>Format publication and ban list</h2>
        </div>
        <p className="support-copy">
          Runtime overrides are applied centrally in Convex. Unpublishing blocks
          new deck saves and new play entry, while ban-list changes immediately
          revalidate catalog and deck legality.
        </p>
      </div>

      <div className="admin-grid">
        <section className="workspace-card">
          <div className="panel-stack">
            <div className="panel-header-row">
              <div>
                <p className="eyebrow">Runtime state</p>
                <h3>{formatSettings.name}</h3>
              </div>
              <button
                className={
                  formatSettings.isPublished
                    ? "action secondary-action"
                    : "action"
                }
                disabled={loading || pendingAction !== null}
                onClick={() => onTogglePublished(!formatSettings.isPublished)}
                type="button"
              >
                {pendingAction === "format:publish"
                  ? "Saving..."
                  : formatSettings.isPublished
                    ? "Unpublish format"
                    : "Publish format"}
              </button>
            </div>
            <dl className="stats">
              <div>
                <dt>Status</dt>
                <dd>{formatSettings.isPublished ? "Published" : "Hidden"}</dd>
              </div>
              <div>
                <dt>Banned cards</dt>
                <dd>{formatSettings.bannedCardIds.length}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>
                  {formatSettings.updatedAt
                    ? new Date(formatSettings.updatedAt).toLocaleString()
                    : "Default"}
                </dd>
              </div>
            </dl>
            <p className="microcopy">
              Existing decks and collections remain visible. New practice
              matches, private lobbies, queue entries, and deck saves respect
              the live publication status and ban list.
            </p>
          </div>
        </section>

        <section className="workspace-card">
          <div className="panel-stack">
            <div className="panel-header-row">
              <div>
                <p className="eyebrow">Ban list</p>
                <h3>Card overrides</h3>
              </div>
            </div>
            <div className="deck-list admin-card-list">
              {orderedCatalog.map((card) => (
                <article className="deck-card admin-card" key={card.cardId}>
                  <div className="deck-card-header">
                    <div>
                      <p className="library-card-title">{card.name}</p>
                      <p className="library-card-meta">
                        {card.kind} · cost {card.cost} · {card.cardId}
                      </p>
                    </div>
                    <span
                      className={`deck-status ${
                        card.isBanned
                          ? "deck-status-illegal"
                          : "deck-status-legal"
                      }`}
                    >
                      {card.isBanned ? "Banned" : "Legal"}
                    </span>
                  </div>
                  <div className="inline-actions">
                    <button
                      className={
                        card.isBanned
                          ? "action secondary-action"
                          : "action action-contrast"
                      }
                      disabled={loading || pendingAction !== null}
                      onClick={() => onToggleBan(card.cardId)}
                      type="button"
                    >
                      {pendingAction === `format:ban:${card.cardId}`
                        ? "Saving..."
                        : card.isBanned
                          ? "Unban card"
                          : "Ban card"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function MatchOpsPanel({
  loading,
  onRecoverMatch,
  pendingAction,
  recoverableMatches,
  telemetryEvents,
}: {
  loading: boolean;
  onRecoverMatch: (
    matchId: string,
    action: "cancel" | "forceConcede",
    seat?: MatchSeatId,
  ) => void;
  pendingAction: string | null;
  recoverableMatches: RecoverableMatchRecord[];
  telemetryEvents: MatchTelemetryEvent[];
}) {
  return (
    <section className="panel panel-secondary">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Operator Recovery</p>
          <h2>Stale matches and telemetry feed</h2>
        </div>
        <p className="support-copy">
          Recovery only unlocks active matches that have been idle beyond the
          stale threshold. Force concession is seat-specific; cancellation
          closes the shell without awarding a winner.
        </p>
      </div>

      <div className="admin-grid">
        <section className="workspace-card">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Recoverable matches</p>
              <h3>Idle active shells</h3>
            </div>
            {loading ? (
              <p className="support-copy">Loading stale-match candidates.</p>
            ) : recoverableMatches.length === 0 ? (
              <p className="support-copy">
                No active matches have crossed the stale recovery threshold.
              </p>
            ) : (
              <div className="deck-list">
                {recoverableMatches.map((record) => (
                  <article
                    className="deck-card admin-card"
                    key={record.match.id}
                  >
                    <div className="deck-card-header">
                      <div>
                        <p className="library-card-title">{record.match.id}</p>
                        <p className="library-card-meta">
                          {record.match.phase} · turn {record.match.turnNumber}{" "}
                          · idle {(record.idleMs / 1000).toFixed(0)}s
                        </p>
                      </div>
                      <span className="deck-status deck-status-illegal">
                        stale {(record.staleThresholdMs / 1000).toFixed(0)}s
                      </span>
                    </div>
                    <dl className="stats">
                      <div>
                        <dt>Pending prompts</dt>
                        <dd>{record.pendingPromptCount}</dd>
                      </div>
                      <div>
                        <dt>Latest event</dt>
                        <dd>{record.latestEventKind ?? "none"}</dd>
                      </div>
                    </dl>
                    <div className="inline-actions inline-actions-wrap">
                      <button
                        className="action secondary-action"
                        disabled={loading || pendingAction !== null}
                        onClick={() =>
                          onRecoverMatch(record.match.id, "cancel")
                        }
                        type="button"
                      >
                        {pendingAction === `recover:cancel:${record.match.id}`
                          ? "Cancelling..."
                          : "Cancel match"}
                      </button>
                      <button
                        className="action action-contrast"
                        disabled={loading || pendingAction !== null}
                        onClick={() =>
                          onRecoverMatch(
                            record.match.id,
                            "forceConcede",
                            "seat-0",
                          )
                        }
                        type="button"
                      >
                        {pendingAction ===
                        `recover:forceConcede:${record.match.id}:seat-0`
                          ? "Recovering..."
                          : "Force seat-0 concede"}
                      </button>
                      <button
                        className="action action-contrast"
                        disabled={loading || pendingAction !== null}
                        onClick={() =>
                          onRecoverMatch(
                            record.match.id,
                            "forceConcede",
                            "seat-1",
                          )
                        }
                        type="button"
                      >
                        {pendingAction ===
                        `recover:forceConcede:${record.match.id}:seat-1`
                          ? "Recovering..."
                          : "Force seat-1 concede"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="workspace-card">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Telemetry</p>
              <h3>Recent runtime events</h3>
            </div>
            {loading ? (
              <p className="support-copy">Loading operator telemetry.</p>
            ) : telemetryEvents.length === 0 ? (
              <p className="support-copy">
                Telemetry is enabled but there are no recorded events yet.
              </p>
            ) : (
              <div className="deck-list admin-card-list">
                {telemetryEvents.map((event, index) => (
                  <article
                    className="deck-card admin-card telemetry-card"
                    key={`${event.name}-${event.at}-${index}`}
                  >
                    <div className="deck-card-header">
                      <div>
                        <p className="library-card-title">{event.name}</p>
                        <p className="library-card-meta">
                          {new Date(event.at).toLocaleString()}
                        </p>
                      </div>
                      {event.matchId ? (
                        <span className="deck-status deck-status-legal">
                          {event.matchId}
                        </span>
                      ) : null}
                    </div>
                    <p className="telemetry-meta">
                      Seat {event.seat ?? "n/a"} · User {event.userId ?? "n/a"}
                    </p>
                    {event.tags ? (
                      <p className="telemetry-meta">
                        {Object.entries(event.tags)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {event.metrics ? (
                      <p className="telemetry-meta">
                        {Object.entries(event.metrics)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export function App() {
  const match = createMatchSkeleton();
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [loginPrivateKey, setLoginPrivateKey] = useState("");
  const [notice, setNotice] = useState<Notice | null>(
    convexWalletAuthTransport
      ? {
          body: "Create an account with email and username, or restore a seat with your saved private key.",
          title: "Wallet auth ready",
          tone: "neutral",
        }
      : {
          body: "Set VITE_CONVEX_URL before using signup or login. The auth UI is wired and waiting for a Convex deployment.",
          title: "Convex connection missing",
          tone: "warning",
        },
  );
  const [viewer, setViewer] = useState<ViewerIdentity | null>(null);
  const [viewerLoading, setViewerLoading] = useState(
    Boolean(convexWalletAuthTransport && getStoredAuthToken()),
  );
  const [pendingAction, setPendingAction] = useState<"login" | "signup" | null>(
    null,
  );
  const [revealedWallet, setRevealedWallet] = useState<LocalBscWallet | null>(
    null,
  );
  const [copiedPrivateKey, setCopiedPrivateKey] = useState(false);
  const [catalog, setCatalog] = useState<CardCatalogEntry[]>([]);
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [joinLobbyCode, setJoinLobbyCode] = useState("");
  const [lobbies, setLobbies] = useState<LobbyRecord[]>([]);
  const [matches, setMatches] = useState<MatchShell[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntryRecord[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([]);
  const [replaySummary, setReplaySummary] = useState<ReplaySummary | null>(
    null,
  );
  const [agentSessions, setAgentSessions] = useState<AgentLabSessionRecord[]>(
    [],
  );
  const [selectedAgentSessionId, setSelectedAgentSessionId] = useState<
    string | null
  >(null);
  const [agentMessages, setAgentMessages] = useState<AgentLabMessageRecord[]>(
    [],
  );
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [agentSessionsLoading, setAgentSessionsLoading] = useState(false);
  const [agentMessagesLoading, setAgentMessagesLoading] = useState(false);
  const [deckAction, setDeckAction] = useState<string | null>(null);
  const [playAction, setPlayAction] = useState<string | null>(null);
  const [agentAction, setAgentAction] = useState<string | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [formatSettings, setFormatSettings] = useState<FormatRuntimeSettings[]>(
    [],
  );
  const [recoverableMatches, setRecoverableMatches] = useState<
    RecoverableMatchRecord[]
  >([]);
  const [telemetryEvents, setTelemetryEvents] = useState<MatchTelemetryEvent[]>(
    [],
  );
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [operatorAction, setOperatorAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateViewer() {
      if (!convexWalletAuthTransport || !getStoredAuthToken()) {
        if (!cancelled) {
          setViewer(null);
          setViewerLoading(false);
        }
        return;
      }

      try {
        const nextViewer = await loadViewerIdentity(convexWalletAuthTransport);
        if (!cancelled) {
          setViewer(nextViewer);
        }
      } catch (error) {
        clearAuthToken();
        syncConvexAuth();
        if (!cancelled) {
          setViewer(null);
          setNotice({
            body: getErrorMessage(error),
            title: "Stored session expired",
            tone: "warning",
          });
        }
      } finally {
        if (!cancelled) {
          setViewerLoading(false);
        }
      }
    }

    void hydrateViewer();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshViewer() {
    if (!convexWalletAuthTransport) {
      setViewer(null);
      return;
    }

    setViewerLoading(true);
    try {
      const nextViewer = await loadViewerIdentity(convexWalletAuthTransport);
      setViewer(nextViewer);
    } finally {
      setViewerLoading(false);
    }
  }

  async function refreshMatches() {
    const nextMatches = await loadMatchSnapshot();
    setMatches(nextMatches);
  }

  async function refreshAgentSessions(matchId: string) {
    const nextSessions = await loadAgentLabSnapshot(matchId);
    setAgentSessions(nextSessions);
    return nextSessions;
  }

  async function refreshAgentMessages(sessionId: string) {
    const nextMessages = await loadAgentSessionMessages(sessionId);
    setAgentMessages(nextMessages);
    return nextMessages;
  }

  async function refreshPlay() {
    const nextPlaySnapshot = await loadPlaySnapshot();
    setLobbies(nextPlaySnapshot.lobbies);
    setQueueEntries(nextPlaySnapshot.queueEntries);
  }

  async function refreshOperatorSurface() {
    const [nextFormatSettings, nextRecoverableMatches, nextTelemetryEvents] =
      await Promise.all([
        loadFormatSettingsSnapshot(),
        loadRecoverableMatchesSnapshot(),
        loadTelemetrySnapshot(),
      ]);
    setFormatSettings(nextFormatSettings);
    setRecoverableMatches(nextRecoverableMatches);
    setTelemetryEvents(nextTelemetryEvents);
    return {
      formatSettings: nextFormatSettings,
      recoverableMatches: nextRecoverableMatches,
      telemetryEvents: nextTelemetryEvents,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function syncLibrary() {
      if (!convexWalletAuthTransport || !viewer) {
        setCatalog([]);
        setCollection(null);
        setDecks([]);
        setMatches([]);
        setSelectedMatchId(null);
        return;
      }

      setLibraryLoading(true);
      try {
        const nextLibrary = await loadLibrarySnapshot();
        if (cancelled) {
          return;
        }

        setCatalog(nextLibrary.catalog);
        setCollection(nextLibrary.collection);
        setDecks(nextLibrary.decks);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Library sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setLibraryLoading(false);
        }
      }
    }

    void syncLibrary();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    let cancelled = false;

    async function syncFormatSettings() {
      if (!convexWalletAuthTransport || !viewer?.isOperator) {
        setFormatSettings([]);
        setRecoverableMatches([]);
        setTelemetryEvents([]);
        setOperatorLoading(false);
        return;
      }

      setOperatorLoading(true);
      try {
        const [
          nextFormatSettings,
          nextRecoverableMatches,
          nextTelemetryEvents,
        ] = await Promise.all([
          loadFormatSettingsSnapshot(),
          loadRecoverableMatchesSnapshot(),
          loadTelemetrySnapshot(),
        ]);
        if (cancelled) {
          return;
        }

        setFormatSettings(nextFormatSettings);
        setRecoverableMatches(nextRecoverableMatches);
        setTelemetryEvents(nextTelemetryEvents);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Operator sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setOperatorLoading(false);
        }
      }
    }

    void syncFormatSettings();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    let cancelled = false;

    async function syncPlay() {
      if (!convexWalletAuthTransport || !viewer) {
        setLobbies([]);
        setQueueEntries([]);
        return;
      }

      setPlayLoading(true);
      try {
        const nextPlay = await loadPlaySnapshot();
        if (cancelled) {
          return;
        }

        setLobbies(nextPlay.lobbies);
        setQueueEntries(nextPlay.queueEntries);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Play sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setPlayLoading(false);
        }
      }
    }

    void syncPlay();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    let cancelled = false;

    async function syncMatches() {
      if (!convexWalletAuthTransport || !viewer) {
        setMatches([]);
        setSelectedMatchId(null);
        return;
      }

      setMatchLoading(true);
      try {
        const nextMatches = await loadMatchSnapshot();
        if (cancelled) {
          return;
        }

        setMatches(nextMatches);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Match sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setMatchLoading(false);
        }
      }
    }

    void syncMatches();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  useEffect(() => {
    if (matches.length === 0) {
      setSelectedMatchId(null);
      return;
    }

    if (
      selectedMatchId &&
      matches.some((match) => match.id === selectedMatchId)
    ) {
      return;
    }

    setSelectedMatchId(matches[0]?.id ?? null);
  }, [matches, selectedMatchId]);

  useEffect(() => {
    let cancelled = false;

    async function syncReplay() {
      if (!convexWalletAuthTransport || !selectedMatchId) {
        setReplayFrames([]);
        setReplaySummary(null);
        return;
      }

      setReplayLoading(true);
      try {
        const nextReplay = await loadReplaySnapshot(selectedMatchId);
        if (cancelled) {
          return;
        }

        setReplayFrames(nextReplay.frames);
        setReplaySummary(nextReplay.summary);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Replay sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setReplayLoading(false);
        }
      }
    }

    void syncReplay();

    return () => {
      cancelled = true;
    };
  }, [selectedMatchId]);

  useEffect(() => {
    let cancelled = false;

    async function syncAgentSessions() {
      if (!convexWalletAuthTransport || !viewer || !selectedMatchId) {
        setAgentSessions([]);
        setSelectedAgentSessionId(null);
        return;
      }

      setAgentSessionsLoading(true);
      try {
        const nextSessions = await loadAgentLabSnapshot(selectedMatchId);
        if (cancelled) {
          return;
        }

        setAgentSessions(nextSessions);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Agent session sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setAgentSessionsLoading(false);
        }
      }
    }

    void syncAgentSessions();

    return () => {
      cancelled = true;
    };
  }, [selectedMatchId, viewer]);

  useEffect(() => {
    if (agentSessions.length === 0) {
      setSelectedAgentSessionId(null);
      return;
    }

    if (
      selectedAgentSessionId &&
      agentSessions.some((session) => session.id === selectedAgentSessionId)
    ) {
      return;
    }

    setSelectedAgentSessionId(agentSessions[0]?.id ?? null);
  }, [agentSessions, selectedAgentSessionId]);

  useEffect(() => {
    let cancelled = false;

    async function syncAgentMessages() {
      if (!convexWalletAuthTransport || !selectedAgentSessionId) {
        setAgentMessages([]);
        return;
      }

      setAgentMessagesLoading(true);
      try {
        const nextMessages = await loadAgentSessionMessages(
          selectedAgentSessionId,
        );
        if (cancelled) {
          return;
        }

        setAgentMessages(nextMessages);
      } catch (error) {
        if (!cancelled) {
          setNotice({
            body: getErrorMessage(error),
            title: "Agent thread sync failed",
            tone: "error",
          });
        }
      } finally {
        if (!cancelled) {
          setAgentMessagesLoading(false);
        }
      }
    }

    void syncAgentMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedAgentSessionId]);

  async function handleSignupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!convexWalletAuthTransport) {
      setNotice({
        body: "Add VITE_CONVEX_URL to the web app environment before creating accounts.",
        title: "Convex not configured",
        tone: "warning",
      });
      return;
    }

    setPendingAction("signup");
    setCopiedPrivateKey(false);
    setNotice({
      body: "Generating a local wallet, requesting a signup challenge, and signing it in-browser.",
      title: "Creating wallet seat",
      tone: "neutral",
    });

    try {
      const result = await signUpWithGeneratedWallet(
        convexWalletAuthTransport,
        {
          email: signupEmail,
          username: signupUsername,
        },
      );

      storeAuthToken(result.session.token);
      syncConvexAuth();
      setRevealedWallet(result.wallet);
      setSignupEmail("");
      setSignupUsername("");
      setLoginPrivateKey("");
      await refreshViewer();
      setNotice({
        body: "Save the revealed private key now. It never passed through Convex and will be needed to restore access on a new device.",
        title: "Signup complete",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Signup failed",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!convexWalletAuthTransport) {
      setNotice({
        body: "Add VITE_CONVEX_URL to the web app environment before restoring a session.",
        title: "Convex not configured",
        tone: "warning",
      });
      return;
    }

    setPendingAction("login");
    setNotice({
      body: "Importing the private key locally, requesting a login challenge, and signing it in-browser.",
      title: "Restoring wallet session",
      tone: "neutral",
    });

    try {
      const result = await signInWithPrivateKey(
        convexWalletAuthTransport,
        loginPrivateKey,
      );

      storeAuthToken(result.session.token);
      syncConvexAuth();
      setLoginPrivateKey("");
      await refreshViewer();
      setNotice({
        body: `Seat restored for ${result.session.username}. The private key stayed local to this browser session.`,
        title: "Login complete",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Login failed",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  function handleSignOut() {
    clearAuthToken();
    syncConvexAuth();
    setViewer(null);
    setCatalog([]);
    setCollection(null);
    setDecks([]);
    setJoinLobbyCode("");
    setLobbies([]);
    setMatches([]);
    setQueueEntries([]);
    setFormatSettings([]);
    setRecoverableMatches([]);
    setTelemetryEvents([]);
    setSelectedMatchId(null);
    setAgentSessions([]);
    setSelectedAgentSessionId(null);
    setAgentMessages([]);
    setNotice({
      body: "The local JWT was cleared. Use your saved private key to restore access again.",
      title: "Signed out",
      tone: "neutral",
    });
  }

  async function handleCopyPrivateKey() {
    if (
      !revealedWallet ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      setNotice({
        body: "Clipboard access is unavailable in this browser. Copy the key manually before leaving this screen.",
        title: "Copy unavailable",
        tone: "warning",
      });
      return;
    }

    await navigator.clipboard.writeText(revealedWallet.privateKey);
    setCopiedPrivateKey(true);
    setNotice({
      body: "The private key is now in your clipboard. Store it in a password manager or hardware wallet workflow.",
      title: "Private key copied",
      tone: "success",
    });
  }

  async function handleCreateStarterDeck() {
    if (!convexWalletAuthTransport) {
      return;
    }
    if (catalog.length === 0) {
      setNotice({
        body: "The starter catalog has not loaded yet.",
        title: "Catalog unavailable",
        tone: "warning",
      });
      return;
    }

    setDeckAction("create");
    try {
      const deck = await convexWalletAuthTransport.createDeck({
        formatId: defaultFormatId,
        mainboard: buildStarterDeckEntries(catalog),
        name: `${starterFormat.name} Starter ${decks.length + 1}`,
        sideboard: [],
      });
      const nextLibrary = await loadLibrarySnapshot();
      setCatalog(nextLibrary.catalog);
      setCollection(nextLibrary.collection);
      setDecks(nextLibrary.decks);
      setNotice({
        body: `${deck.name} saved with ${deck.validation.mainboardCount} cards and is ready for match hookup.`,
        title: "Starter deck created",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Deck creation failed",
        tone: "error",
      });
    } finally {
      setDeckAction(null);
    }
  }

  async function handleCloneDeck(deckId: DeckId, deckName: string) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setDeckAction(`clone:${deckId}`);
    try {
      const deck = await convexWalletAuthTransport.cloneDeck({
        deckId,
        name: `${deckName} Copy`,
      });
      const nextLibrary = await loadLibrarySnapshot();
      setCatalog(nextLibrary.catalog);
      setCollection(nextLibrary.collection);
      setDecks(nextLibrary.decks);
      setNotice({
        body: `${deck.name} was cloned from the existing legal list.`,
        title: "Deck cloned",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Deck clone failed",
        tone: "error",
      });
    } finally {
      setDeckAction(null);
    }
  }

  async function handleArchiveDeck(deckId: DeckId, deckName: string) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setDeckAction(`archive:${deckId}`);
    try {
      await convexWalletAuthTransport.archiveDeck({
        deckId,
      });
      const nextLibrary = await loadLibrarySnapshot();
      setCatalog(nextLibrary.catalog);
      setCollection(nextLibrary.collection);
      setDecks(nextLibrary.decks);
      setNotice({
        body: `${deckName} moved to archived status.`,
        title: "Deck archived",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Deck archive failed",
        tone: "error",
      });
    } finally {
      setDeckAction(null);
    }
  }

  async function handleCreatePracticeMatch() {
    if (!convexWalletAuthTransport) {
      return;
    }

    const sourceDeck = getActiveLegalDeck(decks);
    if (!sourceDeck) {
      setNotice({
        body: "Create or restore at least one active legal deck before creating a match shell.",
        title: "No legal deck available",
        tone: "warning",
      });
      return;
    }

    setDeckAction("create-practice");
    try {
      const shell = await convexWalletAuthTransport.createPracticeMatch({
        deckId: sourceDeck.id,
      });
      await refreshMatches();
      setSelectedMatchId(shell.id);
      setNotice({
        body: `${shell.id} persisted with seat and spectator projections.`,
        title: "Practice match created",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Practice match failed",
        tone: "error",
      });
    } finally {
      setDeckAction(null);
    }
  }

  async function handleCreatePrivateLobby() {
    if (!convexWalletAuthTransport) {
      return;
    }

    const sourceDeck = getActiveLegalDeck(decks);
    if (!sourceDeck) {
      setNotice({
        body: "Create or restore one active legal deck before creating a private lobby.",
        title: "No legal deck available",
        tone: "warning",
      });
      return;
    }

    setPlayAction("create-lobby");
    try {
      const result = await convexWalletAuthTransport.createPrivateLobby({
        deckId: sourceDeck.id,
      });
      await refreshPlay();
      setJoinLobbyCode(result.lobby.code);
      setNotice({
        body: `Share ${result.lobby.code} with another player to join the private lobby.`,
        title: "Private lobby created",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Lobby creation failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleJoinPrivateLobby() {
    if (!convexWalletAuthTransport) {
      return;
    }

    const sourceDeck = getActiveLegalDeck(decks);
    if (!sourceDeck) {
      setNotice({
        body: "Create or restore one active legal deck before joining a private lobby.",
        title: "No legal deck available",
        tone: "warning",
      });
      return;
    }

    setPlayAction("join-lobby");
    try {
      const result = await convexWalletAuthTransport.joinPrivateLobby({
        code: joinLobbyCode,
        deckId: sourceDeck.id,
      });
      await refreshPlay();
      setJoinLobbyCode(result.lobby.code);
      setNotice({
        body: `Joined lobby ${result.lobby.code}. Set your ready state once both decks are locked.`,
        title: "Private lobby joined",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Lobby join failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleLeaveLobby(lobbyId: LobbyRecord["id"]) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setPlayAction(`leave:${lobbyId}`);
    try {
      await convexWalletAuthTransport.leaveLobby({
        lobbyId,
      });
      await refreshPlay();
      setNotice({
        body: "The private lobby state was updated.",
        title: "Lobby updated",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Lobby update failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleToggleLobbyReady(
    lobbyId: LobbyRecord["id"],
    ready: boolean,
  ) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setPlayAction(`ready:${lobbyId}`);
    try {
      const result = await convexWalletAuthTransport.setLobbyReady({
        lobbyId,
        ready,
      });
      await refreshPlay();
      if (result.match) {
        await refreshMatches();
        setSelectedMatchId(result.match.id);
      }
      setNotice({
        body: result.match
          ? `${result.match.id} was created from the private lobby ready check.`
          : `Lobby ${result.lobby.code} updated to ${ready ? "ready" : "not ready"}.`,
        title: result.match ? "Private match created" : "Ready state updated",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Ready check failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleEnqueueCasual() {
    if (!convexWalletAuthTransport) {
      return;
    }

    const sourceDeck = getActiveLegalDeck(decks);
    if (!sourceDeck) {
      setNotice({
        body: "Create or restore one active legal deck before entering the casual queue.",
        title: "No legal deck available",
        tone: "warning",
      });
      return;
    }

    setPlayAction("enqueue-casual");
    try {
      const result = await convexWalletAuthTransport.enqueueCasualQueue({
        deckId: sourceDeck.id,
      });
      await refreshPlay();
      if (result.match) {
        await refreshMatches();
        setSelectedMatchId(result.match.id);
      }
      setNotice({
        body: result.match
          ? `${result.match.id} was created from the casual queue.`
          : "You are now waiting in the casual queue for another legal deck.",
        title: result.match ? "Casual match created" : "Entered casual queue",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Queue entry failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleDequeueCasual(entryId: QueueEntryRecord["id"]) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setPlayAction(`dequeue:${entryId}`);
    try {
      await convexWalletAuthTransport.dequeueCasualQueue({
        entryId,
      });
      await refreshPlay();
      setNotice({
        body: "The active casual queue entry was cancelled.",
        title: "Left casual queue",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Queue exit failed",
        tone: "error",
      });
    } finally {
      setPlayAction(null);
    }
  }

  async function handleEnsureAgentSession(
    purpose: AgentLabSessionRecord["purpose"],
  ) {
    if (!convexWalletAuthTransport || !selectedMatchId) {
      return;
    }

    setAgentAction(`ensure:${purpose}`);
    try {
      const session = await convexWalletAuthTransport.ensureLabSession({
        matchId: selectedMatchId,
        purpose,
      });
      await refreshAgentSessions(selectedMatchId);
      setSelectedAgentSessionId(session.id);
      await refreshAgentMessages(session.id);
      setNotice({
        body:
          purpose === "coach"
            ? "Coach thread opened on your owned seat view. Suggestions remain non-authoritative."
            : "Commentator thread opened on the public spectator view.",
        title:
          purpose === "coach"
            ? "Coach thread ready"
            : "Commentator thread ready",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Agent thread setup failed",
        tone: "error",
      });
    } finally {
      setAgentAction(null);
    }
  }

  async function handleArchiveAgentSession(sessionId: string) {
    if (!convexWalletAuthTransport || !selectedMatchId) {
      return;
    }

    setAgentAction(`archive-session:${sessionId}`);
    try {
      await convexWalletAuthTransport.archiveLabSession({
        sessionId,
      });
      const nextSessions = await refreshAgentSessions(selectedMatchId);
      const fallbackSessionId = nextSessions[0]?.id ?? null;
      setSelectedAgentSessionId(fallbackSessionId);
      if (fallbackSessionId) {
        await refreshAgentMessages(fallbackSessionId);
      } else {
        setAgentMessages([]);
      }
      setNotice({
        body: "The helper thread was archived without touching live match state.",
        title: "Agent thread archived",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Agent archive failed",
        tone: "error",
      });
    } finally {
      setAgentAction(null);
    }
  }

  async function handleSendAgentPrompt(sessionId: string, prompt: string) {
    if (!convexWalletAuthTransport) {
      return;
    }

    setAgentAction(`send-session:${sessionId}`);
    try {
      const result = await convexWalletAuthTransport.sendLabPrompt({
        prompt,
        sessionId,
      });
      if (selectedMatchId) {
        await refreshAgentSessions(selectedMatchId);
      }
      setSelectedAgentSessionId(result.session.id);
      await refreshAgentMessages(result.session.id);
      setNotice({
        body: result.reply,
        title:
          result.session.purpose === "coach"
            ? "Coach reply generated"
            : "Commentator reply generated",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Agent reply failed",
        tone: "error",
      });
    } finally {
      setAgentAction(null);
    }
  }

  const currentFormatSettings =
    formatSettings.find((format) => format.formatId === defaultFormatId) ??
    null;

  async function handleToggleFormatPublished(isPublished: boolean) {
    if (!convexWalletAuthTransport || !currentFormatSettings) {
      return;
    }

    setOperatorAction("format:publish");
    try {
      await convexWalletAuthTransport.updateFormatSettings({
        bannedCardIds: currentFormatSettings.bannedCardIds,
        formatId: currentFormatSettings.formatId,
        isPublished,
      });
      const [nextOperatorSurface, nextLibrary] = await Promise.all([
        refreshOperatorSurface(),
        loadLibrarySnapshot(),
      ]);
      setCatalog(nextLibrary.catalog);
      setCollection(nextLibrary.collection);
      setDecks(nextLibrary.decks);
      await Promise.all([refreshPlay(), refreshMatches()]);
      setNotice({
        body: `${nextOperatorSurface.formatSettings[0]?.name ?? currentFormatSettings.name} is now ${
          isPublished ? "published" : "unpublished"
        } for new deck saves and play entry.`,
        title: "Format status updated",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Format status update failed",
        tone: "error",
      });
    } finally {
      setOperatorAction(null);
    }
  }

  async function handleToggleCardBan(cardId: string) {
    if (!convexWalletAuthTransport || !currentFormatSettings) {
      return;
    }

    const nextBannedCardIds = currentFormatSettings.bannedCardIds.includes(
      cardId,
    )
      ? currentFormatSettings.bannedCardIds.filter(
          (bannedCardId) => bannedCardId !== cardId,
        )
      : [...currentFormatSettings.bannedCardIds, cardId];

    setOperatorAction(`format:ban:${cardId}`);
    try {
      await convexWalletAuthTransport.updateFormatSettings({
        bannedCardIds: nextBannedCardIds,
        formatId: currentFormatSettings.formatId,
        isPublished: currentFormatSettings.isPublished,
      });
      await Promise.all([
        refreshOperatorSurface(),
        refreshPlay(),
        refreshMatches(),
      ]);
      const nextLibrary = await loadLibrarySnapshot();
      setCatalog(nextLibrary.catalog);
      setCollection(nextLibrary.collection);
      setDecks(nextLibrary.decks);
      const cardName =
        catalog.find((card) => card.cardId === cardId)?.name ?? cardId;
      setNotice({
        body: nextBannedCardIds.includes(cardId)
          ? `${cardName} is now banned in ${currentFormatSettings.name}.`
          : `${cardName} was removed from the ${currentFormatSettings.name} ban list.`,
        title: "Ban list updated",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Ban list update failed",
        tone: "error",
      });
    } finally {
      setOperatorAction(null);
    }
  }

  async function handleRecoverStaleMatch(
    matchId: string,
    action: "cancel" | "forceConcede",
    seat?: MatchSeatId,
  ) {
    if (!convexWalletAuthTransport) {
      return;
    }

    const actionKey =
      action === "cancel"
        ? `recover:cancel:${matchId}`
        : `recover:forceConcede:${matchId}:${seat ?? "active"}`;
    setOperatorAction(actionKey);
    try {
      const result = await convexWalletAuthTransport.recoverStaleMatch({
        action,
        matchId,
        seat,
      });
      await Promise.all([
        refreshOperatorSurface(),
        refreshMatches(),
        refreshPlay(),
      ]);
      if (selectedMatchId === result.match.id) {
        const nextReplay = await loadReplaySnapshot(result.match.id);
        setReplayFrames(nextReplay.frames);
        setReplaySummary(nextReplay.summary);
      }
      setNotice({
        body:
          result.outcome === "cancelled"
            ? `${result.match.id} was cancelled by operator recovery.`
            : `${result.match.id} forced ${result.recoveredSeat} to concede and awarded ${result.match.winnerSeat}.`,
        title: "Stale match recovered",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        body: getErrorMessage(error),
        title: "Match recovery failed",
        tone: "error",
      });
    } finally {
      setOperatorAction(null);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Phase 18 Ops Hardening And Release Gating</p>
          <h1>{APP_NAME}</h1>
          <p className="lede">
            Email and username create the player record. A fresh BSC wallet is
            generated in-browser, challenged by Convex, and signed locally so
            the private key never leaves the player’s machine.
          </p>
          <p className="support-copy">
            This phase hardens the live product for external testing: operator
            controls now sit on top of the existing match, replay, and agent
            surfaces so format publication and ban-list changes propagate
            through the same canonical Convex rules path.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span className="metric-label">Convex</span>
            <strong>
              {convexWalletAuthTransport ? "Connected" : "Awaiting URL"}
            </strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Format</span>
            <strong>
              {currentFormatSettings
                ? `${starterFormat.name} · ${
                    currentFormatSettings.isPublished ? "Published" : "Hidden"
                  }`
                : starterFormat.name}
            </strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Agent Lab</span>
            <strong>
              {selectedMatchId
                ? `${agentSessions.length} active thread${
                    agentSessions.length === 1 ? "" : "s"
                  }`
                : "Awaiting match"}
            </strong>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Player Access</p>
            <h2>Create or restore a seat</h2>
          </div>
          <p className="support-copy">
            Signup only asks for email and username. Login only asks for the
            saved private key and recreates the wallet locally before signing.
          </p>
        </div>

        <StatusBanner notice={notice} />

        <div className="auth-grid">
          <form className="auth-panel" onSubmit={handleSignupSubmit}>
            <p className="panel-kicker">New player</p>
            <h3>Create account + wallet</h3>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={pendingAction !== null}
                onChange={(event) => setSignupEmail(event.target.value)}
                placeholder="mage@lunchtable.gg"
                required
                type="email"
                value={signupEmail}
              />
            </label>
            <label className="field">
              <span>Username</span>
              <input
                autoCapitalize="off"
                autoComplete="username"
                disabled={pendingAction !== null}
                maxLength={24}
                minLength={3}
                onChange={(event) => setSignupUsername(event.target.value)}
                pattern="[A-Za-z0-9_]{3,24}"
                placeholder="tablemage"
                required
                type="text"
                value={signupUsername}
              />
            </label>
            <p className="microcopy">
              Submitting this form generates a new BSC keypair in the browser
              and creates the canonical user, wallet, and starter collection
              records through Convex.
            </p>
            <button
              className="action"
              disabled={pendingAction !== null}
              type="submit"
            >
              {pendingAction === "signup"
                ? "Creating wallet seat..."
                : "Create wallet seat"}
            </button>
          </form>

          <form
            className="auth-panel auth-panel-dark"
            onSubmit={handleLoginSubmit}
          >
            <p className="panel-kicker">Returning player</p>
            <h3>Restore with private key</h3>
            <label className="field">
              <span>Private key</span>
              <textarea
                autoCapitalize="off"
                disabled={pendingAction !== null}
                onChange={(event) => setLoginPrivateKey(event.target.value)}
                placeholder="0x..."
                required
                rows={6}
                value={loginPrivateKey}
              />
            </label>
            <p className="microcopy">
              The key is imported only in this browser session, the address is
              derived locally, and only the signed challenge goes to Convex.
            </p>
            <button
              className="action action-contrast"
              disabled={pendingAction !== null}
              type="submit"
            >
              {pendingAction === "login"
                ? "Restoring session..."
                : "Restore wallet session"}
            </button>
          </form>
        </div>

        <div className="utility-grid">
          <SessionPanel
            canSignOut={pendingAction === null}
            loading={viewerLoading}
            onSignOut={handleSignOut}
            viewer={viewer}
          />
          <PrivateKeyReveal
            copied={copiedPrivateKey}
            onCopy={handleCopyPrivateKey}
            onDismiss={() => {
              setRevealedWallet(null);
              setCopiedPrivateKey(false);
            }}
            wallet={revealedWallet}
          />
        </div>
      </section>

      <section className="panel panel-secondary">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Deck Workspace</p>
            <h2>Collection and legal deck records</h2>
          </div>
          <p className="support-copy">
            The starter catalog is static, but collection ownership and deck
            legality are resolved through canonical Convex tables for the
            signed-in user.
          </p>
        </div>
        <div className="library-grid">
          <CollectionPanel collection={collection} loading={libraryLoading} />
          <DeckPanel
            canCreatePracticeMatch={Boolean(getActiveLegalDeck(decks))}
            canCreateStarterDeck={Boolean(viewer && catalog.length > 0)}
            decks={decks}
            loading={libraryLoading}
            onArchiveDeck={handleArchiveDeck}
            onCloneDeck={handleCloneDeck}
            onCreatePracticeMatch={handleCreatePracticeMatch}
            onCreateStarterDeck={handleCreateStarterDeck}
            pendingAction={deckAction}
          />
        </div>
      </section>

      {viewer?.isOperator ? (
        <>
          <FormatAdminPanel
            catalog={catalog}
            formatSettings={currentFormatSettings}
            loading={operatorLoading}
            onToggleBan={handleToggleCardBan}
            onTogglePublished={handleToggleFormatPublished}
            pendingAction={operatorAction}
          />
          <MatchOpsPanel
            loading={operatorLoading}
            onRecoverMatch={handleRecoverStaleMatch}
            pendingAction={operatorAction}
            recoverableMatches={recoverableMatches}
            telemetryEvents={telemetryEvents}
          />
        </>
      ) : null}

      <section className="panel panel-secondary">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Play Surface</p>
            <h2>Private lobbies and casual queue</h2>
          </div>
          <p className="support-copy">
            Private lobbies use invite codes and ready checks. The casual queue
            rejects duplicate active entries and deterministically pairs the
            oldest compatible players.
          </p>
        </div>
        <div className="library-grid">
          <LobbyPanel
            canCreate={Boolean(viewer && getActiveLegalDeck(decks))}
            joinCode={joinLobbyCode}
            lobbies={lobbies}
            loading={playLoading}
            onCreate={handleCreatePrivateLobby}
            onJoin={handleJoinPrivateLobby}
            onJoinCodeChange={setJoinLobbyCode}
            onLeave={handleLeaveLobby}
            onToggleReady={handleToggleLobbyReady}
            pendingAction={playAction}
            viewerId={viewer?.id ?? null}
          />
          <QueuePanel
            canQueue={Boolean(viewer && getActiveLegalDeck(decks))}
            entries={queueEntries}
            loading={playLoading}
            onDequeue={handleDequeueCasual}
            onEnqueue={handleEnqueueCasual}
            pendingAction={playAction}
          />
        </div>
      </section>

      <section className="panel panel-secondary">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Match Persistence</p>
            <h2>Shells and isolated cached views</h2>
          </div>
          <p className="support-copy">
            Choose a persisted match and mount the live seat shell. The same
            section can fall back to the spectator projection without exposing
            private hand data.
          </p>
        </div>
        <div className="library-grid">
          <MatchShellPanel
            loading={matchLoading}
            matches={matches}
            onSelectMatch={setSelectedMatchId}
            replaySummary={replaySummary}
            selectedMatchId={selectedMatchId}
          />
          {convexWalletAuthTransport ? (
            <LiveMatchShell
              catalog={catalog}
              matchId={selectedMatchId}
              transport={convexWalletAuthTransport}
              viewerEnabled={Boolean(viewer)}
            />
          ) : (
            <section className="workspace-card workspace-card-dark match-shell">
              <div className="panel-stack">
                <div>
                  <p className="eyebrow">Live Match Shell</p>
                  <h3>Convex connection required</h3>
                </div>
                <p className="support-copy">
                  Set <code>VITE_CONVEX_URL</code> before mounting the live
                  match shell.
                </p>
              </div>
            </section>
          )}
        </div>
      </section>

      <section className="panel panel-secondary">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Replay Frames</p>
            <h2>Spectator-safe deterministic playback</h2>
          </div>
          <p className="support-copy">
            Replay capture stores public frame checkpoints only. The player
            below reuses the Pixi board renderer and never receives seat-private
            hand contents.
          </p>
        </div>
        <ReplayPlayer
          frames={replayFrames}
          loading={replayLoading}
          summary={replaySummary}
        />
      </section>

      <AgentLabPanel
        loadingMessages={agentMessagesLoading}
        loadingSessions={agentSessionsLoading}
        messages={agentMessages}
        onArchiveSession={handleArchiveAgentSession}
        onEnsureSession={handleEnsureAgentSession}
        onSelectSession={setSelectedAgentSessionId}
        onSendPrompt={handleSendAgentPrompt}
        pendingAction={agentAction}
        replaySummary={replaySummary}
        selectedMatchId={selectedMatchId}
        selectedSessionId={selectedAgentSessionId}
        sessions={agentSessions}
      />

      <section className="panel panel-secondary">
        <div>
          <p className="eyebrow">Engine baseline</p>
          <h2>Current match kernel</h2>
          <dl className="stats">
            <div>
              <dt>Status</dt>
              <dd>{match.status}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{match.version}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{match.phase}</dd>
            </div>
          </dl>
        </div>
        <div>
          <p className="eyebrow">Delivery gates</p>
          <h2>Bootstrap checklist</h2>
          <ul className="checklist">
            {bootstrapChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
