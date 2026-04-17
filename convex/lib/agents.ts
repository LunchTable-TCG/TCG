import type {
  BotAssignmentRecord,
  BotAssignmentStatus,
  BotIdentityRecord,
  MatchStatus,
} from "@lunchtable/shared-types";

import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { deserializeMatchShell } from "./matches";

export const DEFAULT_BOT_SLUG = "table-bot";
export const DEFAULT_BOT_DISPLAY_NAME = "Table Bot";
export const DEFAULT_BOT_POLICY_KEY = "baseline-v1";
const BOT_EMAIL_DOMAIN = "bots.lunchtable.local";

export function normalizeBotSlug(slug: string): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error("Bot slug must contain at least one letter or number");
  }

  return normalized;
}

export function buildBotEmail(slug: string): string {
  return `${normalizeBotSlug(slug)}@${BOT_EMAIL_DOMAIN}`;
}

export function buildBotUsernameNormalized(slug: string): string {
  return `bot:${normalizeBotSlug(slug)}`;
}

export function deriveBotAssignmentStatus(
  matchStatus: MatchStatus,
): BotAssignmentStatus {
  switch (matchStatus) {
    case "pending":
      return "pending";
    case "active":
      return "active";
    case "complete":
      return "complete";
    case "cancelled":
      return "cancelled";
  }
}

export function toBotIdentityRecord(
  doc: Doc<"botIdentities">,
): BotIdentityRecord {
  return {
    createdAt: doc.createdAt,
    displayName: doc.displayName,
    id: doc._id,
    policyKey: doc.policyKey,
    slug: doc.slug,
    status: doc.status,
    updatedAt: doc.updatedAt,
    userId: doc.userId,
  };
}

export function toBotAssignmentRecord(
  doc: Doc<"botAssignments">,
): BotAssignmentRecord {
  return {
    botIdentityId: doc.botIdentityId,
    completedAt: doc.completedAt ?? null,
    createdAt: doc.createdAt,
    id: doc._id,
    lastIntentAt: doc.lastIntentAt ?? null,
    lastObservedVersion: doc.lastObservedVersion ?? null,
    matchId: doc.matchId,
    seat: doc.seat,
    status: doc.status,
    updatedAt: doc.updatedAt,
    userId: doc.botUserId,
  };
}

export async function ensureBotIdentity(
  db: DatabaseWriter,
  input: {
    displayName?: string;
    now: number;
    policyKey?: string;
    slug?: string;
  },
) {
  const slug = normalizeBotSlug(input.slug ?? DEFAULT_BOT_SLUG);
  const displayName = input.displayName?.trim() || DEFAULT_BOT_DISPLAY_NAME;
  const policyKey = input.policyKey?.trim() || DEFAULT_BOT_POLICY_KEY;
  const existingIdentity = await db
    .query("botIdentities")
    .withIndex("by_slug", (query) => query.eq("slugNormalized", slug))
    .unique();

  if (existingIdentity) {
    const existingUser = await db.get(existingIdentity.userId);
    if (!existingUser) {
      throw new Error("Bot identity is missing its backing user");
    }

    if (
      existingIdentity.displayName !== displayName ||
      existingIdentity.policyKey !== policyKey ||
      existingIdentity.status !== "active" ||
      existingUser.actorType !== "bot" ||
      existingUser.status !== "active"
    ) {
      await db.patch(existingIdentity._id, {
        displayName,
        policyKey,
        status: "active",
        updatedAt: input.now,
      });
      await db.patch(existingUser._id, {
        actorType: "bot",
        email: buildBotEmail(slug),
        emailNormalized: buildBotEmail(slug),
        status: "active",
        updatedAt: input.now,
        username: displayName,
        usernameNormalized: buildBotUsernameNormalized(slug),
      });
    }

    return {
      botIdentity: existingIdentity,
      user: existingUser,
    };
  }

  const email = buildBotEmail(slug);
  const userId = await db.insert("users", {
    actorType: "bot",
    email,
    emailNormalized: email,
    status: "active",
    updatedAt: input.now,
    username: displayName,
    usernameNormalized: buildBotUsernameNormalized(slug),
  });
  const botIdentityId = await db.insert("botIdentities", {
    createdAt: input.now,
    displayName,
    policyKey,
    slug,
    slugNormalized: slug,
    status: "active",
    updatedAt: input.now,
    userId,
  });

  const [botIdentity, user] = await Promise.all([
    db.get(botIdentityId),
    db.get(userId),
  ]);

  if (!botIdentity || !user) {
    throw new Error("Failed to create bot identity");
  }

  return {
    botIdentity,
    user,
  };
}

export async function syncBotAssignmentsForMatch(
  db: DatabaseWriter,
  input: {
    completedAt?: number | null;
    lastIntentAt?: number | null;
    lastObservedVersion?: number | null;
    matchId: Id<"matches">;
    matchStatus: MatchStatus;
    updatedAt: number;
  },
) {
  const assignmentDocs = await db
    .query("botAssignments")
    .withIndex("by_matchId", (query) => query.eq("matchId", input.matchId))
    .collect();
  const nextStatus = deriveBotAssignmentStatus(input.matchStatus);

  await Promise.all(
    assignmentDocs.map((assignmentDoc) =>
      db.patch(assignmentDoc._id, {
        completedAt:
          input.completedAt === null
            ? undefined
            : (input.completedAt ?? undefined),
        lastIntentAt:
          input.lastIntentAt === null
            ? undefined
            : (input.lastIntentAt ?? assignmentDoc.lastIntentAt),
        lastObservedVersion:
          input.lastObservedVersion === null
            ? undefined
            : (input.lastObservedVersion ?? assignmentDoc.lastObservedVersion),
        status: nextStatus,
        updatedAt: input.updatedAt,
      }),
    ),
  );
}

export async function listBotAssignmentsByStatuses(
  db: DatabaseReader,
  userId: Id<"users">,
  statuses: BotAssignmentStatus[],
) {
  const docs = await Promise.all(
    statuses.map((status) =>
      db
        .query("botAssignments")
        .withIndex("by_botUserId_and_status_and_updatedAt", (query) =>
          query.eq("botUserId", userId).eq("status", status),
        )
        .order("desc")
        .take(20),
    ),
  );

  return docs.flat().sort((left, right) => {
    if (left.updatedAt === right.updatedAt) {
      return left._id.localeCompare(right._id);
    }
    return right.updatedAt - left.updatedAt;
  });
}

export async function listBotAssignmentSnapshots(
  db: DatabaseReader,
  userId: Id<"users">,
  statuses: BotAssignmentStatus[],
) {
  const assignments = await listBotAssignmentsByStatuses(db, userId, statuses);

  return Promise.all(
    assignments.map(async (assignment) => {
      const match = await db.get(assignment.matchId);
      return {
        assignment: toBotAssignmentRecord(assignment),
        match: match ? deserializeMatchShell(match.shellJson) : null,
      };
    }),
  );
}
