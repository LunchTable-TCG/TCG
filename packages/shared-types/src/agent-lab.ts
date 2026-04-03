export const AGENT_LAB_PURPOSES = ["coach", "commentator"] as const;
export const AGENT_LAB_SESSION_STATUSES = ["active", "archived"] as const;

export type AgentLabPurpose = (typeof AGENT_LAB_PURPOSES)[number];
export type AgentLabSessionStatus = (typeof AGENT_LAB_SESSION_STATUSES)[number];
export type AgentLabSessionId = string;

export interface AgentLabSessionRecord {
  id: AgentLabSessionId;
  latestReplyPreview: string | null;
  matchId: string;
  ownerUserId: string;
  purpose: AgentLabPurpose;
  status: AgentLabSessionStatus;
  threadId: string;
  title: string;
  updatedAt: number;
  createdAt: number;
}

export interface AgentLabMessageRecord {
  agentName: string | null;
  createdAt: number;
  id: string;
  key: string;
  order: number;
  role: "assistant" | "system" | "user";
  status: string;
  text: string;
}

export interface AgentLabTurnResult {
  reply: string;
  session: AgentLabSessionRecord;
}
