import { v } from "convex/values";

import { query } from "./_generated/server";
import { buildReplaySummary, deserializeReplayFrames } from "./lib/replays";

export const getSummary = query({
  args: {
    matchId: v.string(),
  },
  handler: async (ctx, args) => {
    const matchId = ctx.db.normalizeId("matches", args.matchId);
    if (!matchId) {
      return null;
    }

    const replay = await ctx.db
      .query("replays")
      .withIndex("by_matchId", (queryBuilder) =>
        queryBuilder.eq("matchId", matchId),
      )
      .unique();

    if (!replay) {
      return null;
    }

    return buildReplaySummary({
      completedAt: replay.completedAt ?? null,
      createdAt: replay.createdAt,
      formatId: replay.formatId,
      lastEventSequence: replay.lastEventSequence,
      matchId: replay.matchId,
      ownerUserId: replay.ownerUserId ?? null,
      status: replay.status,
      totalFrames: replay.totalFrames,
      updatedAt: replay.updatedAt,
      winnerSeat: replay.winnerSeat ?? null,
    });
  },
});

export const getFrames = query({
  args: {
    limit: v.optional(v.number()),
    matchId: v.string(),
    start: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const matchId = ctx.db.normalizeId("matches", args.matchId);
    if (!matchId) {
      return {
        frames: [],
        totalFrames: 0,
      };
    }

    const replay = await ctx.db
      .query("replays")
      .withIndex("by_matchId", (queryBuilder) =>
        queryBuilder.eq("matchId", matchId),
      )
      .unique();

    if (!replay) {
      return {
        frames: [],
        totalFrames: 0,
      };
    }

    const sliceDocs = await ctx.db
      .query("replayFrameSlices")
      .withIndex("by_matchId_and_sliceIndex", (queryBuilder) =>
        queryBuilder.eq("matchId", matchId),
      )
      .order("asc")
      .collect();

    const frames =
      sliceDocs.length > 0
        ? [
            ...deserializeReplayFrames(replay.framesJson),
            ...sliceDocs.flatMap((sliceDoc) =>
              deserializeReplayFrames(sliceDoc.framesJson),
            ),
          ]
        : deserializeReplayFrames(replay.framesJson);
    const start = Math.max(0, args.start ?? 0);
    const limit = Math.min(Math.max(args.limit ?? 60, 1), 240);

    return {
      frames: frames.slice(start, start + limit),
      totalFrames: replay.totalFrames,
    };
  },
});
