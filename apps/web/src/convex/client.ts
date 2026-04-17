import { ConvexReactClient } from "convex/react";

import { getStoredAuthToken } from "../auth/session";
import { createConvexWalletAuthTransport } from "./api";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

export const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function syncConvexAuth() {
  if (!convexClient) {
    return;
  }
  convexClient.setAuth(async () => getStoredAuthToken());
}

if (convexClient) {
  syncConvexAuth();
}

export const convexWalletAuthTransport = convexClient
  ? createConvexWalletAuthTransport(convexClient)
  : null;

export function requireConvexWalletAuthTransport() {
  if (!convexWalletAuthTransport) {
    throw new Error("Convex transport unavailable");
  }

  return convexWalletAuthTransport;
}
