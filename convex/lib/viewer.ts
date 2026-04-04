import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseUserSubject } from "./walletAuth";

type ViewerCtx = QueryCtx | MutationCtx;
const OPERATOR_EMAIL_ALLOWLIST_ENV = "OPERATOR_EMAIL_ALLOWLIST";

function getOperatorEmailAllowlist(): Set<string> {
  const rawValue = process.env[OPERATOR_EMAIL_ALLOWLIST_ENV];
  if (!rawValue) {
    return new Set();
  }

  return new Set(
    rawValue
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getViewerUser(
  ctx: ViewerCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const userId = ctx.db.normalizeId(
    "users",
    parseUserSubject(identity.subject),
  );
  if (!userId) {
    return null;
  }

  return ctx.db.get(userId);
}

export async function requireViewerUser(ctx: ViewerCtx): Promise<Doc<"users">> {
  const user = await getViewerUser(ctx);
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export function isOperatorUser(
  user: Pick<Doc<"users">, "emailNormalized"> | null,
): boolean {
  if (!user) {
    return false;
  }

  return getOperatorEmailAllowlist().has(user.emailNormalized);
}

export async function requireOperatorUser(
  ctx: ViewerCtx,
): Promise<Doc<"users">> {
  const user = await requireViewerUser(ctx);
  if (!isOperatorUser(user)) {
    throw new Error("Operator access required");
  }
  return user;
}
