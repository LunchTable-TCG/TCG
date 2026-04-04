import { v } from "convex/values";

import { query } from "./_generated/server";
import { listCatalogEntries, loadFormatRuntime } from "./lib/library";

export const listCatalog = query({
  args: {
    formatId: v.string(),
  },
  handler: async (ctx, args) => {
    const runtime = await loadFormatRuntime(ctx.db, args.formatId);
    return listCatalogEntries(runtime);
  },
});
