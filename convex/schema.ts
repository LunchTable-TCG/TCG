import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agentSessions: defineTable({
    createdAt: v.number(),
    latestReplyPreview: v.optional(v.string()),
    matchId: v.id("matches"),
    ownerUserId: v.id("users"),
    purpose: v.union(v.literal("coach"), v.literal("commentator")),
    status: v.union(v.literal("active"), v.literal("archived")),
    threadId: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_ownerUserId_and_updatedAt", ["ownerUserId", "updatedAt"])
    .index("by_ownerUserId_and_matchId_and_purpose_and_status", [
      "ownerUserId",
      "matchId",
      "purpose",
      "status",
    ])
    .index("by_matchId_and_updatedAt", ["matchId", "updatedAt"]),

  authAudits: defineTable({
    failureCode: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    purpose: v.union(v.literal("signup"), v.literal("login")),
    success: v.boolean(),
    userAgent: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    walletId: v.optional(v.id("wallets")),
  }).index("by_purpose", ["purpose"]),

  users: defineTable({
    actorType: v.optional(v.union(v.literal("human"), v.literal("bot"))),
    email: v.string(),
    emailNormalized: v.string(),
    primaryWalletId: v.optional(v.id("wallets")),
    status: v.union(v.literal("active"), v.literal("suspended")),
    updatedAt: v.number(),
    username: v.string(),
    usernameNormalized: v.string(),
  })
    .index("by_email", ["emailNormalized"])
    .index("by_actorType_and_updatedAt", ["actorType", "updatedAt"])
    .index("by_username", ["usernameNormalized"]),

  botIdentities: defineTable({
    createdAt: v.number(),
    displayName: v.string(),
    policyKey: v.string(),
    slug: v.string(),
    slugNormalized: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    updatedAt: v.number(),
    userId: v.id("users"),
  })
    .index("by_slug", ["slugNormalized"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_userId", ["userId"]),

  botAssignments: defineTable({
    botIdentityId: v.id("botIdentities"),
    botUserId: v.id("users"),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    lastIntentAt: v.optional(v.number()),
    lastObservedVersion: v.optional(v.number()),
    matchId: v.id("matches"),
    seat: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("complete"),
      v.literal("cancelled"),
    ),
    updatedAt: v.number(),
  })
    .index("by_botUserId_and_status_and_updatedAt", [
      "botUserId",
      "status",
      "updatedAt",
    ])
    .index("by_matchId", ["matchId"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  gameAssets: defineTable({
    createdAt: v.number(),
    mediaType: v.string(),
    metadataJson: v.string(),
    name: v.string(),
    ownerUserId: v.id("users"),
    prompt: v.optional(v.string()),
    source: v.union(v.literal("generated"), v.literal("imported")),
    status: v.union(v.literal("active"), v.literal("archived")),
    storageId: v.id("_storage"),
    updatedAt: v.number(),
  })
    .index("by_ownerUserId_and_updatedAt", ["ownerUserId", "updatedAt"])
    .index("by_ownerUserId_and_status_and_updatedAt", [
      "ownerUserId",
      "status",
      "updatedAt",
    ]),

  collectionEntries: defineTable({
    cardId: v.string(),
    formatId: v.string(),
    ownedCount: v.number(),
    source: v.union(v.literal("starterGrant")),
    updatedAt: v.number(),
    userId: v.id("users"),
  })
    .index("by_user_card", ["userId", "cardId"])
    .index("by_user_format", ["userId", "formatId"]),

  decks: defineTable({
    createdAt: v.number(),
    formatId: v.string(),
    mainboard: v.array(
      v.object({
        cardId: v.string(),
        count: v.number(),
      }),
    ),
    name: v.string(),
    sideboard: v.array(
      v.object({
        cardId: v.string(),
        count: v.number(),
      }),
    ),
    status: v.union(v.literal("active"), v.literal("archived")),
    updatedAt: v.number(),
    userId: v.id("users"),
  })
    .index("by_user_status_updated", ["userId", "status", "updatedAt"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  formatSettings: defineTable({
    banList: v.array(v.string()),
    formatId: v.string(),
    isPublished: v.boolean(),
    updatedAt: v.number(),
    updatedByUserId: v.id("users"),
  })
    .index("by_formatId", ["formatId"])
    .index("by_isPublished_and_updatedAt", ["isPublished", "updatedAt"]),

  lobbies: defineTable({
    code: v.string(),
    codeNormalized: v.string(),
    createdAt: v.number(),
    guestActorType: v.optional(v.union(v.literal("human"), v.literal("bot"))),
    guestBotIdentityId: v.optional(v.id("botIdentities")),
    formatId: v.string(),
    guestDeckId: v.optional(v.id("decks")),
    guestJoinedAt: v.optional(v.number()),
    guestReady: v.optional(v.boolean()),
    guestUserId: v.optional(v.id("users")),
    guestUsername: v.optional(v.string()),
    guestWalletAddress: v.optional(v.string()),
    hostDeckId: v.id("decks"),
    hostReady: v.boolean(),
    hostUserId: v.id("users"),
    hostUsername: v.string(),
    hostWalletAddress: v.optional(v.string()),
    matchId: v.optional(v.id("matches")),
    status: v.union(
      v.literal("open"),
      v.literal("readyCheck"),
      v.literal("matched"),
      v.literal("cancelled"),
    ),
    updatedAt: v.number(),
  })
    .index("by_code", ["codeNormalized"])
    .index("by_hostUserId_and_updatedAt", ["hostUserId", "updatedAt"])
    .index("by_guestUserId_and_updatedAt", ["guestUserId", "updatedAt"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"]),

  queueEntries: defineTable({
    createdAt: v.number(),
    deckId: v.id("decks"),
    formatId: v.string(),
    kind: v.literal("casual"),
    matchId: v.optional(v.id("matches")),
    status: v.union(
      v.literal("queued"),
      v.literal("matched"),
      v.literal("cancelled"),
    ),
    updatedAt: v.number(),
    userId: v.id("users"),
    username: v.string(),
    walletAddress: v.optional(v.string()),
  })
    .index("by_status_format_createdAt", ["status", "formatId", "createdAt"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_and_status", ["userId", "status"]),

  matches: defineTable({
    activeSeat: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    formatId: v.string(),
    phase: v.union(
      v.literal("bootstrap"),
      v.literal("mulligan"),
      v.literal("ready"),
      v.literal("upkeep"),
      v.literal("draw"),
      v.literal("main1"),
      v.literal("attack"),
      v.literal("block"),
      v.literal("damage"),
      v.literal("main2"),
      v.literal("end"),
      v.literal("cleanup"),
    ),
    shellJson: v.string(),
    startedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("complete"),
      v.literal("cancelled"),
    ),
    turnNumber: v.number(),
    updatedAt: v.number(),
    version: v.number(),
    winnerSeat: v.optional(v.string()),
  })
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_createdAt", ["createdAt"]),

  matchEvents: defineTable({
    at: v.number(),
    eventJson: v.string(),
    kind: v.string(),
    matchId: v.id("matches"),
    seat: v.optional(v.string()),
    sequence: v.number(),
    stateVersion: v.number(),
  }).index("by_matchId_and_sequence", ["matchId", "sequence"]),

  matchPrompts: defineTable({
    kind: v.string(),
    matchId: v.id("matches"),
    ownerSeat: v.string(),
    promptId: v.string(),
    promptJson: v.string(),
    status: v.union(v.literal("pending"), v.literal("resolved")),
    updatedAt: v.number(),
  }).index("by_matchId_and_ownerSeat_and_status", [
    "matchId",
    "ownerSeat",
    "status",
  ]),

  matchStates: defineTable({
    matchId: v.id("matches"),
    snapshotJson: v.string(),
    updatedAt: v.number(),
    version: v.number(),
  }).index("by_matchId", ["matchId"]),

  matchViews: defineTable({
    kind: v.union(v.literal("seat"), v.literal("spectator")),
    matchId: v.id("matches"),
    updatedAt: v.number(),
    viewJson: v.string(),
    viewerSeat: v.optional(v.string()),
    viewerUserId: v.optional(v.id("users")),
  })
    .index("by_matchId_and_kind", ["matchId", "kind"])
    .index("by_matchId_and_viewerUserId_and_kind", [
      "matchId",
      "viewerUserId",
      "kind",
    ])
    .index("by_viewerUserId_and_updatedAt", ["viewerUserId", "updatedAt"]),

  replays: defineTable({
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    formatId: v.string(),
    framesJson: v.string(),
    lastEventSequence: v.number(),
    matchId: v.id("matches"),
    ownerUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("complete"),
      v.literal("cancelled"),
    ),
    totalFrames: v.number(),
    updatedAt: v.number(),
    winnerSeat: v.optional(v.string()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_ownerUserId_and_createdAt", ["ownerUserId", "createdAt"]),

  replayFrameSlices: defineTable({
    createdAt: v.number(),
    endFrameIndex: v.number(),
    frameCount: v.number(),
    framesJson: v.string(),
    matchId: v.id("matches"),
    replayId: v.id("replays"),
    sliceIndex: v.number(),
    startFrameIndex: v.number(),
    updatedAt: v.number(),
  })
    .index("by_matchId_and_sliceIndex", ["matchId", "sliceIndex"])
    .index("by_replayId_and_sliceIndex", ["replayId", "sliceIndex"]),

  telemetryEvents: defineTable({
    at: v.number(),
    matchId: v.optional(v.string()),
    metrics: v.optional(v.record(v.string(), v.number())),
    name: v.string(),
    seat: v.optional(v.string()),
    tags: v.optional(v.record(v.string(), v.string())),
    userId: v.optional(v.id("users")),
  })
    .index("by_at", ["at"])
    .index("by_matchId_and_at", ["matchId", "at"])
    .index("by_name_and_at", ["name", "at"]),

  walletChallenges: defineTable({
    address: v.string(),
    addressNormalized: v.string(),
    chainId: v.number(),
    consumedAt: v.optional(v.number()),
    emailSnapshot: v.optional(v.string()),
    expiresAt: v.number(),
    issuedAt: v.string(),
    message: v.string(),
    nonce: v.string(),
    purpose: v.union(
      v.literal("signup"),
      v.literal("login"),
      v.literal("link-wallet"),
    ),
    requestId: v.optional(v.string()),
    usernameSnapshot: v.optional(v.string()),
  })
    .index("by_address", ["addressNormalized"])
    .index("by_address_purpose", ["addressNormalized", "purpose"]),

  wallets: defineTable({
    address: v.string(),
    addressNormalized: v.string(),
    chainId: v.number(),
    custodyModel: v.literal("self-custodied"),
    lastAuthenticatedAt: v.optional(v.number()),
    userId: v.id("users"),
    walletType: v.literal("evm-local"),
  })
    .index("by_address", ["addressNormalized"])
    .index("by_user", ["userId"]),
});
