export { BSC_CHAIN_ID } from "@lunchtable/shared-types";
export { clearAuthToken, getStoredAuthToken, storeAuthToken } from "./session";
export type { WalletChallengeMessageInput as WalletChallengePayload } from "@lunchtable/shared-types";
export {
  buildSignupChallengeMessage,
  createLocalBscWallet,
  importLocalBscWallet,
  normalizePrivateKey,
  signChallenge,
  verifyChallengeSignature,
} from "./wallet";
export {
  loadViewerIdentity,
  signInWithPrivateKey,
  signUpWithGeneratedWallet,
} from "./service";

export type { LocalBscWallet } from "./wallet";
export type { SignupInput, WalletAuthResult } from "./service";
