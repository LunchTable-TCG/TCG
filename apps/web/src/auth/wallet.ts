import { BSC_CHAIN_ID } from "@lunchtable/shared-types";
import { isHex, verifyMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

type HexString = `0x${string}`;

export interface LocalBscWallet {
  address: `0x${string}`;
  chainId: typeof BSC_CHAIN_ID;
  privateKey: `0x${string}`;
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

function isPrivateKey(value: string): value is HexString {
  return isHex(value, { strict: true }) && value.length === 66;
}

export function normalizePrivateKey(value: string): HexString {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  if (!isPrivateKey(prefixed)) {
    throw new Error("Invalid private key format");
  }

  return prefixed;
}

export { buildWalletChallengeMessage as buildSignupChallengeMessage } from "@lunchtable/shared-types";

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
