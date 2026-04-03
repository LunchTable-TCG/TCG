/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as cards from "../cards.js";
import type * as collections from "../collections.js";
import type * as decks from "../decks.js";
import type * as lib_agents from "../lib/agents.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_library from "../lib/library.js";
import type * as lib_matches from "../lib/matches.js";
import type * as lib_participation from "../lib/participation.js";
import type * as lib_play from "../lib/play.js";
import type * as lib_replays from "../lib/replays.js";
import type * as lib_viewer from "../lib/viewer.js";
import type * as lib_walletAuth from "../lib/walletAuth.js";
import type * as lobbies from "../lobbies.js";
import type * as matches from "../matches.js";
import type * as matchmaking from "../matchmaking.js";
import type * as replays from "../replays.js";
import type * as viewer from "../viewer.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  auth: typeof auth;
  cards: typeof cards;
  collections: typeof collections;
  decks: typeof decks;
  "lib/agents": typeof lib_agents;
  "lib/jwt": typeof lib_jwt;
  "lib/library": typeof lib_library;
  "lib/matches": typeof lib_matches;
  "lib/participation": typeof lib_participation;
  "lib/play": typeof lib_play;
  "lib/replays": typeof lib_replays;
  "lib/viewer": typeof lib_viewer;
  "lib/walletAuth": typeof lib_walletAuth;
  lobbies: typeof lobbies;
  matches: typeof matches;
  matchmaking: typeof matchmaking;
  replays: typeof replays;
  viewer: typeof viewer;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
