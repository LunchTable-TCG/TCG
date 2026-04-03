import { isHex, verifyMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const BSC_CHAIN_ID = 56;

export interface LocalBscWallet {
  address: `0x${string}`;
  chainId: typeof BSC_CHAIN_ID;
  privateKey: `0x${string}`;
}

export interface WalletChallengePayload {
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

export function createLocalBscWallet(): LocalBscWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    chainId: BSC_CHAIN_ID,
    privateKey,
  };
}

export function importLocalBscWallet(privateKeyInput: string): LocalBscWallet {
  const privateKey = normalizePrivateKey(privateKeyInput);
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    chainId: BSC_CHAIN_ID,
    privateKey,
  };
}

export function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x")
    ? (trimmed as `0x${string}`)
    : (`0x${trimmed}` as `0x${string}`);

  if (!isHex(prefixed, { strict: true }) || prefixed.length !== 66) {
    throw new Error("Invalid private key format");
  }

  return prefixed;
}

export function buildSignupChallengeMessage(
  payload: WalletChallengePayload,
): string {
  return [
    `${payload.domain} wants you to sign in with your BSC account:`,
    payload.address,
    "",
    payload.statement,
    payload.username ? `Username: ${payload.username}` : undefined,
    payload.email ? `Email: ${payload.email}` : undefined,
    `URI: ${payload.uri}`,
    "Version: 1",
    `Chain ID: ${BSC_CHAIN_ID}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${payload.issuedAt}`,
    payload.requestId ? `Request ID: ${payload.requestId}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function signChallenge(
  privateKey: `0x${string}`,
  message: string,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);

  return account.signMessage({ message });
}

export async function verifyChallengeSignature(input: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  return verifyMessage({
    address: input.address,
    message: input.message,
    signature: input.signature,
  });
}
