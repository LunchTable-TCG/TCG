import {
  type FormatRuntimeSettings,
  MATCH_EVENT_KINDS,
  MATCH_TELEMETRY_EVENT_NAMES,
  type MatchEventKind,
  type MatchTelemetryEventName,
  type RecoverableMatchRecord,
} from "@lunchtable/shared-types";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  listSupportedFormatIds,
  loadFormatRuntime,
  saveFormatRuntime,
} from "./lib/library";
import { deserializeMatchShell } from "./lib/matches";
import {
  listRecentTelemetryEvents,
  recordTelemetryEvent,
} from "./lib/telemetry";
import { requireOperatorUser } from "./lib/viewer";

function toRuntimeSettings(
  runtime: Awaited<ReturnType<typeof loadFormatRuntime>>,
): FormatRuntimeSettings {
  return runtime.settings;
}

export const listFormatSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorUser(ctx);

    const runtimes = await Promise.all(
      listSupportedFormatIds().map((formatId) =>
        loadFormatRuntime(ctx.db, formatId),
      ),
    );

    return runtimes.map(toRuntimeSettings);
  },
});

export const updateFormatSettings = mutation({
  args: {
    bannedCardIds: v.array(v.string()),
    formatId: v.string(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireOperatorUser(ctx);
    const now = Date.now();

    const runtime = await saveFormatRuntime(ctx.db, {
      banList: args.bannedCardIds,
      formatId: args.formatId,
      isPublished: args.isPublished,
      now,
      updatedByUserId: user._id,
    });
    await recordTelemetryEvent(ctx.db, {
      at: now,
      metrics: {
        bannedCardCount: runtime.settings.bannedCardIds.length,
      },
      name: "ops.format.updated",
      tags: {
        formatId: runtime.settings.formatId,
        isPublished: runtime.settings.isPublished ? "true" : "false",
      },
      userId: user._id,
    });

    return toRuntimeSettings(runtime);
  },
});

async function buildRecoverableMatchRecord(
  ctx: Pick<QueryCtx, "db">,
  input: {
    match: Doc<"matches">;
    staleThresholdMs: number;
  },
): Promise<RecoverableMatchRecord | null> {
  const match = input.match;
  if (!match || match.status !== "active") {
    return null;
  }

  const shell = deserializeMatchShell(match.shellJson);
  const [latestEventDoc, seat0Prompts, seat1Prompts] = await Promise.all([
    ctx.db
      .query("matchEvents")
      .withIndex("by_matchId_and_sequence", (query) =>
        query.eq("matchId", match._id),
      )
      .order("desc")
      .take(1),
    ctx.db
      .query("matchPrompts")
      .withIndex("by_matchId_and_ownerSeat_and_status", (query) =>
        query
          .eq("matchId", match._id)
          .eq("ownerSeat", "seat-0")
          .eq("status", "pending"),
      )
      .collect(),
    ctx.db
      .query("matchPrompts")
      .withIndex("by_matchId_and_ownerSeat_and_status", (query) =>
        query
          .eq("matchId", match._id)
          .eq("ownerSeat", "seat-1")
          .eq("status", "pending"),
      )
      .collect(),
  ]);

  const latestEventKind = latestEventDoc[0]
    ? toMatchEventKind(latestEventDoc[0].kind)
    : null;

  return {
    idleMs: Date.now() - match.updatedAt,
    latestEventAt: latestEventDoc[0]?.at ?? null,
    latestEventKind,
    match: shell,
    pendingPromptCount: seat0Prompts.length + seat1Prompts.length,
    staleThresholdMs: input.staleThresholdMs,
  };
}

export const listRecoverableMatches = query({
  args: {
    limit: v.optional(v.number()),
    staleAfterMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOperatorUser(ctx);

    const staleAfterMs = Math.max(
      args.staleAfterMs ?? 5 * 60 * 1000,
      60 * 1000,
    );
    const cutoff = Date.now() - staleAfterMs;
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_status_and_updatedAt", (query) =>
        query.eq("status", "active").lt("updatedAt", cutoff),
      )
      .order("asc")
      .take(Math.min(Math.max(args.limit ?? 10, 1), 50));

    const records = await Promise.all(
      matches.map((match) =>
        buildRecoverableMatchRecord(ctx, {
          match,
          staleThresholdMs: staleAfterMs,
        }),
      ),
    );

    return records.filter(
      (record): record is RecoverableMatchRecord => record !== null,
    );
  },
});

export const listTelemetry = query({
  args: {
    limit: v.optional(v.number()),
    matchId: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperatorUser(ctx);

    return listRecentTelemetryEvents(ctx.db, {
      limit: args.limit ?? 25,
      matchId: args.matchId,
      name: parseTelemetryEventName(args.name),
    });
  },
});

function parseTelemetryEventName(
  value: string | undefined,
): MatchTelemetryEventName | undefined {
  if (!value) {
    return undefined;
  }

  if (!isTelemetryEventName(value)) {
    throw new Error(`Invalid telemetry event name: ${value}`);
  }

  return value;
}

function toMatchEventKind(value: string): MatchEventKind {
  if (!isMatchEventKind(value)) {
    throw new Error(`Unexpected match event kind: ${value}`);
  }

  return value;
}

function isTelemetryEventName(value: string): value is MatchTelemetryEventName {
  return MATCH_TELEMETRY_EVENT_NAMES.some((name) => name === value);
}

function isMatchEventKind(value: string): value is MatchEventKind {
  return MATCH_EVENT_KINDS.some((kind) => kind === value);
}
