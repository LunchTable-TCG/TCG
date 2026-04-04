import type { FormatRuntimeSettings } from "@lunchtable/shared-types";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  listSupportedFormatIds,
  loadFormatRuntime,
  saveFormatRuntime,
} from "./lib/library";
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

    const runtime = await saveFormatRuntime(ctx.db, {
      banList: args.bannedCardIds,
      formatId: args.formatId,
      isPublished: args.isPublished,
      now: Date.now(),
      updatedByUserId: user._id,
    });

    return toRuntimeSettings(runtime);
  },
});
