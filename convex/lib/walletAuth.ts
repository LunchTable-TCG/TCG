import {
  BSC_CHAIN_ID,
  type WalletChallengeMessageInput,
  type WalletChallengePurpose,
  buildWalletChallengeMessage as buildSharedWalletChallengeMessage,
} from "@lunchtable/shared-types";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hashMessage, hexToBytes, isAddressEqual } from "viem";
import { publicKeyToAddress } from "viem/accounts";

export const AUTH_CHAIN_ID = BSC_CHAIN_ID;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_RE = /^0x[a-fA-F0-9]{130}$/;

type HexString = `0x${string}`;

export interface WalletChallengeRecordInput
  extends Omit<WalletChallengeMessageInput, "issuedAt" | "nonce"> {
  now?: number;
  purpose: WalletChallengePurpose;
}

export interface WalletChallengeRecord {
  address: `0x${string}`;
  addressNormalized: string;
  chainId: typeof AUTH_CHAIN_ID;
  expiresAt: number;
  issuedAt: string;
  message: string;
  nonce: string;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new Error("Invalid email format");
  }
  return normalized;
}

export function normalizeUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(
      "Username must be 3-24 characters and only contain letters, numbers, and underscores",
    );
  }
  return trimmed.toLowerCase();
}

export function normalizeAddress(address: string): `0x${string}` {
  const normalized = address.trim().toLowerCase();
  if (!isAddress(normalized)) {
    throw new Error("Invalid wallet address");
  }
  return normalized;
}

export function normalizeSignature(signature: string): HexString {
  const normalized = signature.trim().toLowerCase();
  if (!isSignature(normalized)) {
    throw new Error("Invalid wallet signature");
  }
  return normalized;
}

export function createChallengeNonce(bytes = 16): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export const buildWalletChallengeMessage = buildSharedWalletChallengeMessage;

export function createWalletChallengeRecord(
  input: WalletChallengeRecordInput,
): WalletChallengeRecord {
  const now = input.now ?? Date.now();
  const nonce = createChallengeNonce();
  const issuedAt = new Date(now).toISOString();
  const address = normalizeAddress(input.address);
  const message = buildWalletChallengeMessage({
    address,
    domain: input.domain,
    email: input.email,
    issuedAt,
    nonce,
    requestId: input.requestId,
    statement: input.statement,
    uri: input.uri,
    username: input.username,
  });

  return {
    address,
    addressNormalized: address.toLowerCase(),
    chainId: AUTH_CHAIN_ID,
    expiresAt: now + CHALLENGE_TTL_MS,
    issuedAt,
    message,
    nonce,
  };
}

export async function verifyWalletChallengeSignature(input: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  const signature = input.signature;
  if (signature.length !== 132) {
    throw new Error("Invalid wallet signature");
  }

  const recoveryBit = toRecoveryBit(Number.parseInt(signature.slice(130), 16));
  const compactSignature = hexToBytes(`0x${signature.slice(2, 130)}`);
  const recoveredPublicKey = secp256k1.Signature.fromBytes(
    compactSignature,
    "compact",
  )
    .addRecoveryBit(recoveryBit)
    .recoverPublicKey(hexToBytes(hashMessage(input.message)))
    .toBytes(false);

  return isAddressEqual(
    publicKeyToAddress(bytesToHex(recoveredPublicKey)),
    input.address,
  );
}

function toRecoveryBit(yParityOrV: number) {
  if (yParityOrV === 0 || yParityOrV === 1) {
    return yParityOrV;
  }
  if (yParityOrV === 27) {
    return 0;
  }
  if (yParityOrV === 28) {
    return 1;
  }
  throw new Error("Invalid wallet signature");
}

export function parseUserSubject(subject: string): string {
  if (!subject.startsWith("user:")) {
    throw new Error("Invalid auth subject");
  }
  return subject.slice("user:".length);
}

function isAddress(value: string): value is HexString {
  return ADDRESS_RE.test(value);
}

function isSignature(value: string): value is HexString {
  return SIGNATURE_RE.test(value);
}
