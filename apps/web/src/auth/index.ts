export {
  BSC_CHAIN_ID,
  buildSignupChallengeMessage,
  createLocalBscWallet,
  importLocalBscWallet,
  normalizePrivateKey,
  signChallenge,
  verifyChallengeSignature,
} from "./wallet";

export type { LocalBscWallet, WalletChallengePayload } from "./wallet";
