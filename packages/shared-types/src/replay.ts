import type { UserId } from "./auth";
import type { MatchEventKind } from "./kinds";
import type { MatchId, MatchSpectatorView, MatchStatus, SeatId } from "./match";

export interface ReplayFrame {
  eventKind: MatchEventKind | "matchSnapshot";
  eventSequence: number;
  frameIndex: number;
  label: string;
  recordedAt: number;
  view: MatchSpectatorView;
}

export interface ReplaySummary {
  completedAt: number | null;
  createdAt: number;
  formatId: string;
  lastEventSequence: number;
  matchId: MatchId;
  ownerUserId: UserId | null;
  status: MatchStatus;
  totalFrames: number;
  updatedAt: number;
  winnerSeat: SeatId | null;
}

export interface ReplayFrameSlice {
  frames: ReplayFrame[];
  totalFrames: number;
}
