import { v } from "convex/values";

import { query } from "./_generated/server";
import {
  buildCollectionSummary,
  listCollectionEntriesForUser,
  loadFormatRuntime,
} from "./lib/library";
import { requireViewerUser } from "./lib/viewer";

export const getSummary = query({
  args: {
    formatId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireViewerUser(ctx);
    const [entries, runtime] = await Promise.all([
      listCollectionEntriesForUser(ctx.db, user._id, args.formatId),
      loadFormatRuntime(ctx.db, args.formatId),
    ]);

    return buildCollectionSummary(runtime, entries);
  },
});
