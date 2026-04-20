import type {
  AgentLabMessageRecord,
  AgentLabPurpose,
  AgentLabSessionId,
  AgentLabSessionRecord,
  AgentLabTurnResult,
  CardCatalogEntry,
  CollectionSummary,
  DeckCardEntry,
  DeckId,
  DeckRecord,
  DeckStatus,
  DeckValidationResult,
  FormatRuntimeSettings,
  LobbyMutationResult,
  LobbyRecord,
  MatchEventKind,
  MatchSeatId,
  MatchSeatView,
  MatchShell,
  MatchSpectatorView,
  MatchStatus,
  MatchTelemetryEvent,
  QueueEntryId,
  QueueEntryRecord,
  QueueMutationResult,
  RecoverMatchResult,
  RecoverableMatchRecord,
  ReplayFrame,
  ReplayFrameSlice,
  ReplaySummary,
  ViewerIdentity,
  WalletAuthSession,
  WalletChallengeId,
  WalletChallengeResponse,
} from "@lunchtable/shared-types";
import type { ConvexReactClient } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export interface WalletAuthTransport {
  completeWalletLogin(args: {
    challengeId: WalletChallengeId;
    signature: `0x${string}`;
  }): Promise<WalletAuthSession>;
  completeWalletSignup(args: {
    challengeId: WalletChallengeId;
    signature: `0x${string}`;
  }): Promise<WalletAuthSession>;
  getViewer(): Promise<ViewerIdentity | null>;
  requestLoginChallenge(args: {
    address: `0x${string}`;
  }): Promise<WalletChallengeResponse>;
  requestSignupChallenge(args: {
    address: `0x${string}`;
    email: string;
    username: string;
  }): Promise<WalletChallengeResponse>;
}

export interface SubmitIntentResult {
  accepted: boolean;
  appendedEventKinds?: MatchEventKind[];
  outcome: "applied" | "noop" | "rejected";
  reason: string | null;
  seatView: MatchSeatView | null;
  shell: MatchShell | null;
}

type SubmitIntentBase<TKind extends string, TPayload> = {
  intentId: string;
  kind: TKind;
  matchId: string;
  payload: TPayload;
  seat: "seat-0" | "seat-1";
  stateVersion: number;
};

export type SubmitIntent =
  | SubmitIntentBase<
      "activateAbility",
      {
        abilityId: string;
        sourceInstanceId: string;
        targetIds?: string[];
      }
    >
  | SubmitIntentBase<
      "assignCombatDamage",
      {
        assignments: Array<{
          amount: number;
          sourceId: string;
          targetId: string;
        }>;
      }
    >
  | SubmitIntentBase<"chooseCosts", { costIds: string[]; promptId: string }>
  | SubmitIntentBase<"chooseModes", { modeIds: string[]; promptId: string }>
  | SubmitIntentBase<
      "choosePromptOptions",
      {
        choiceIds: string[];
        promptId: string;
      }
    >
  | SubmitIntentBase<"chooseTargets", { promptId: string; targetIds: string[] }>
  | SubmitIntentBase<
      "concede",
      {
        reason: "disconnect" | "manual" | "timeout";
      }
    >
  | SubmitIntentBase<
      "declareAttackers",
      {
        attackers: Array<{
          attackerId: string;
          defenderSeat: "seat-0" | "seat-1";
          laneId: string | null;
        }>;
      }
    >
  | SubmitIntentBase<
      "declareBlockers",
      {
        blocks: Array<{
          attackerId: string;
          blockerId: string;
        }>;
      }
    >
  | SubmitIntentBase<"keepOpeningHand", Record<string, never>>
  | SubmitIntentBase<"passPriority", Record<string, never>>
  | SubmitIntentBase<
      "playCard",
      {
        alternativeCostId: string | null;
        cardInstanceId: string;
        sourceZone:
          | "battlefield"
          | "command"
          | "deck"
          | "graveyard"
          | "hand"
          | "laneReserve"
          | "objective"
          | "sideboard"
          | "stack"
          | "exile";
        targetSlotId: string | null;
      }
    >
  | SubmitIntentBase<"takeMulligan", { targetHandSize: number | null }>
  | SubmitIntentBase<"toggleAutoPass", { enabled: boolean }>;

export interface WalletLibraryTransport extends WalletAuthTransport {
  archiveDeck(args: {
    deckId: DeckId;
  }): Promise<DeckRecord>;
  archiveLabSession(args: {
    sessionId: AgentLabSessionId;
  }): Promise<AgentLabSessionRecord>;
  addBotGuest(args: {
    lobbyId: LobbyRecord["id"];
  }): Promise<LobbyMutationResult>;
  createPrivateLobby(args: {
    deckId: DeckId;
  }): Promise<LobbyMutationResult>;
  cloneDeck(args: {
    deckId: DeckId;
    name?: string;
  }): Promise<DeckRecord>;
  createDeck(args: {
    formatId: string;
    mainboard: DeckCardEntry[];
    name: string;
    sideboard: DeckCardEntry[];
  }): Promise<DeckRecord>;
  createPracticeMatch(args: {
    deckId: DeckId;
  }): Promise<MatchShell>;
  ensureLabSession(args: {
    matchId: string;
    purpose: AgentLabPurpose;
  }): Promise<AgentLabSessionRecord>;
  dequeueCasualQueue(args: {
    entryId: QueueEntryId;
  }): Promise<QueueMutationResult>;
  listFormatSettings(): Promise<FormatRuntimeSettings[]>;
  getCollectionSummary(args: {
    formatId: string;
  }): Promise<CollectionSummary>;
  getLobbyByCode(args: {
    code: string;
  }): Promise<LobbyRecord | null>;
  getMatchShell(args: {
    matchId: string;
  }): Promise<MatchShell | null>;
  getSeatView(args: {
    matchId: string;
  }): Promise<MatchSeatView | null>;
  getSpectatorView(args: {
    matchId: string;
  }): Promise<MatchSpectatorView | null>;
  getReplayFrames(args: {
    limit?: number;
    matchId: string;
    start?: number;
  }): Promise<ReplayFrameSlice>;
  getReplaySummary(args: {
    matchId: string;
  }): Promise<ReplaySummary | null>;
  joinPrivateLobby(args: {
    code: string;
    deckId: DeckId;
  }): Promise<LobbyMutationResult>;
  listAgentMessages(args: {
    sessionId: AgentLabSessionId;
  }): Promise<AgentLabMessageRecord[]>;
  listAgentSessions(args: {
    includeArchived?: boolean;
    matchId?: string;
  }): Promise<AgentLabSessionRecord[]>;
  listCatalog(args: {
    formatId: string;
  }): Promise<CardCatalogEntry[]>;
  listDecks(args: {
    formatId?: string;
    status?: DeckStatus;
  }): Promise<DeckRecord[]>;
  listMyLobbies(): Promise<LobbyRecord[]>;
  listMyMatches(args: {
    status?: MatchStatus;
  }): Promise<MatchShell[]>;
  listMyQueueEntries(args: {
    status?: "cancelled" | "matched" | "queued";
  }): Promise<QueueEntryRecord[]>;
  listRecoverableMatches(args: {
    limit?: number;
    staleAfterMs?: number;
  }): Promise<RecoverableMatchRecord[]>;
  listTelemetry(args: {
    limit?: number;
    matchId?: string;
    name?: MatchTelemetryEvent["name"];
  }): Promise<MatchTelemetryEvent[]>;
  enqueueCasualQueue(args: {
    deckId: DeckId;
  }): Promise<QueueMutationResult>;
  leaveLobby(args: {
    lobbyId: LobbyRecord["id"];
  }): Promise<LobbyMutationResult>;
  validateDeck(args: {
    formatId: string;
    mainboard: DeckCardEntry[];
    sideboard: DeckCardEntry[];
  }): Promise<DeckValidationResult>;
  setLobbyReady(args: {
    lobbyId: LobbyRecord["id"];
    ready: boolean;
  }): Promise<LobbyMutationResult>;
  updateFormatSettings(args: {
    bannedCardIds: string[];
    formatId: string;
    isPublished: boolean;
  }): Promise<FormatRuntimeSettings>;
  sendLabPrompt(args: {
    prompt: string;
    sessionId: AgentLabSessionId;
  }): Promise<AgentLabTurnResult>;
  recoverStaleMatch(args: {
    action: "cancel" | "forceConcede";
    matchId: string;
    seat?: MatchSeatId;
    staleAfterMs?: number;
  }): Promise<RecoverMatchResult>;
  submitIntent(args: {
    intent: SubmitIntent;
  }): Promise<SubmitIntentResult>;
}

export function createConvexWalletAuthTransport(
  client: ConvexReactClient,
): WalletLibraryTransport {
  return {
    archiveDeck(args) {
      return client.mutation(api.decks.archive, args) as Promise<DeckRecord>;
    },
    archiveLabSession(args) {
      return client.mutation(
        api.agents.archiveLabSession,
        args,
      ) as Promise<AgentLabSessionRecord>;
    },
    addBotGuest(args) {
      return client.mutation(
        api.lobbies.addBotGuest,
        args,
      ) as Promise<LobbyMutationResult>;
    },
    createPrivateLobby(args) {
      return client.mutation(
        api.lobbies.createPrivate,
        args,
      ) as Promise<LobbyMutationResult>;
    },
    cloneDeck(args) {
      return client.mutation(api.decks.clone, args) as Promise<DeckRecord>;
    },
    completeWalletLogin(args) {
      return client.action(
        api.auth.completeWalletLogin,
        args,
      ) as Promise<WalletAuthSession>;
    },
    completeWalletSignup(args) {
      return client.action(
        api.auth.completeWalletSignup,
        args,
      ) as Promise<WalletAuthSession>;
    },
    createDeck(args) {
      return client.mutation(api.decks.create, args) as Promise<DeckRecord>;
    },
    createPracticeMatch(args) {
      return client.mutation(
        api.matches.createPractice,
        args,
      ) as Promise<MatchShell>;
    },
    ensureLabSession(args) {
      return client.mutation(
        api.agents.ensureLabSession,
        args,
      ) as Promise<AgentLabSessionRecord>;
    },
    dequeueCasualQueue(args) {
      return client.mutation(
        api.matchmaking.dequeue,
        args,
      ) as Promise<QueueMutationResult>;
    },
    getCollectionSummary(args) {
      return client.query(
        api.collections.getSummary,
        args,
      ) as Promise<CollectionSummary>;
    },
    listFormatSettings() {
      return client.query(api.admin.listFormatSettings, {}) as Promise<
        FormatRuntimeSettings[]
      >;
    },
    getLobbyByCode(args) {
      return client.query(
        api.lobbies.getByCode,
        args,
      ) as Promise<LobbyRecord | null>;
    },
    getMatchShell(args) {
      return client.query(
        api.matches.getShell,
        args,
      ) as Promise<MatchShell | null>;
    },
    getSeatView(args) {
      return client.query(
        api.matches.getSeatView,
        args,
      ) as Promise<MatchSeatView | null>;
    },
    getSpectatorView(args) {
      return client.query(
        api.matches.getSpectatorView,
        args,
      ) as Promise<MatchSpectatorView | null>;
    },
    getReplayFrames(args) {
      return client.query(
        api.replays.getFrames,
        args,
      ) as Promise<ReplayFrameSlice>;
    },
    getReplaySummary(args) {
      return client.query(
        api.replays.getSummary,
        args,
      ) as Promise<ReplaySummary | null>;
    },
    joinPrivateLobby(args) {
      return client.mutation(
        api.lobbies.join,
        args,
      ) as Promise<LobbyMutationResult>;
    },
    listAgentMessages(args) {
      return client.query(api.agents.listLabMessages, args) as Promise<
        AgentLabMessageRecord[]
      >;
    },
    listAgentSessions(args) {
      return client.query(api.agents.listLabSessions, args) as Promise<
        AgentLabSessionRecord[]
      >;
    },
    getViewer() {
      return client.query(api.viewer.get, {}) as Promise<ViewerIdentity | null>;
    },
    listCatalog(args) {
      return client.query(api.cards.listCatalog, args) as Promise<
        CardCatalogEntry[]
      >;
    },
    listDecks(args) {
      return client.query(api.decks.list, args) as Promise<DeckRecord[]>;
    },
    listMyLobbies() {
      return client.query(api.lobbies.listMine, {}) as Promise<LobbyRecord[]>;
    },
    listMyMatches(args) {
      return client.query(api.matches.listMyMatches, args) as Promise<
        MatchShell[]
      >;
    },
    listMyQueueEntries(args) {
      return client.query(api.matchmaking.listMine, args) as Promise<
        QueueEntryRecord[]
      >;
    },
    listRecoverableMatches(args) {
      return client.query(api.admin.listRecoverableMatches, args) as Promise<
        RecoverableMatchRecord[]
      >;
    },
    listTelemetry(args) {
      return client.query(api.admin.listTelemetry, args) as Promise<
        MatchTelemetryEvent[]
      >;
    },
    enqueueCasualQueue(args) {
      return client.mutation(
        api.matchmaking.enqueue,
        args,
      ) as Promise<QueueMutationResult>;
    },
    leaveLobby(args) {
      return client.mutation(
        api.lobbies.leave,
        args,
      ) as Promise<LobbyMutationResult>;
    },
    requestLoginChallenge(args) {
      return client.mutation(
        api.auth.requestLoginChallenge,
        args,
      ) as Promise<WalletChallengeResponse>;
    },
    requestSignupChallenge(args) {
      return client.mutation(
        api.auth.requestSignupChallenge,
        args,
      ) as Promise<WalletChallengeResponse>;
    },
    setLobbyReady(args) {
      return client.mutation(
        api.lobbies.setReady,
        args,
      ) as Promise<LobbyMutationResult>;
    },
    updateFormatSettings(args) {
      return client.mutation(
        api.admin.updateFormatSettings,
        args,
      ) as Promise<FormatRuntimeSettings>;
    },
    sendLabPrompt(args) {
      return client.mutation(
        api.agents.sendLabPrompt,
        args,
      ) as Promise<AgentLabTurnResult>;
    },
    recoverStaleMatch(args) {
      return client.mutation(
        api.matches.recoverStaleMatch,
        args,
      ) as Promise<RecoverMatchResult>;
    },
    submitIntent(args) {
      return client.mutation(
        api.matches.submitIntent,
        args,
      ) as Promise<SubmitIntentResult>;
    },
    validateDeck(args) {
      return client.query(
        api.decks.validate,
        args,
      ) as Promise<DeckValidationResult>;
    },
  };
}
