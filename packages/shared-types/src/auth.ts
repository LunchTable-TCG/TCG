import type { GenericId } from "convex/values";

export const BSC_CHAIN_ID = 56 as const;
export type UserId = GenericId<"users">;
export type WalletChallengeId = GenericId<"walletChallenges">;

export type WalletChallengePurpose = "signup" | "login" | "link-wallet";

export interface WalletChallengeMessageInput {
  address: `0x${string}`;
  domain: string;
  email?: string;
  issuedAt: string;
  nonce: string;
  requestId?: string;
  statement: string;
  uri: string;
  username?: string;
}

export interface WalletChallengeResponse {
  address: `0x${string}`;
  chainId: typeof BSC_CHAIN_ID;
  challengeId: WalletChallengeId;
  expiresAt: number;
  message: string;
  nonce: string;
}

export interface WalletAuthSession {
  address: `0x${string}`;
  chainId: typeof BSC_CHAIN_ID;
  token: string;
  userId: UserId;
  username: string;
}

export interface ViewerIdentity {
  email: string;
  id: UserId;
  isOperator: boolean;
  username: string;
  walletAddress: string | null;
}

export function buildWalletChallengeMessage(
  input: WalletChallengeMessageInput,
): string {
  return [
    `${input.domain} wants you to sign in with your BSC account:`,
    input.address,
    "",
    input.statement,
    input.username ? `Username: ${input.username}` : undefined,
    input.email ? `Email: ${input.email}` : undefined,
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: ${BSC_CHAIN_ID}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    input.requestId ? `Request ID: ${input.requestId}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
