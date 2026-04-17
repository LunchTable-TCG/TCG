import {
  MATCH_TELEMETRY_EVENT_NAMES,
  type MatchTelemetryEvent,
  type MatchTelemetryEventName,
} from "@lunchtable/shared-types";

import type { Doc } from "../_generated/dataModel";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { isMatchTelemetryEventName } from "./domainGuards";

export async function recordTelemetryEvent(
  db: DatabaseWriter,
  event: MatchTelemetryEvent,
) {
  await db.insert("telemetryEvents", {
    at: event.at,
    matchId: event.matchId,
    metrics: event.metrics,
    name: event.name,
    seat: event.seat,
    tags: event.tags,
    userId: event.userId ?? undefined,
  });
}

function toTelemetryEvent(
  doc: Doc<"telemetryEvents">,
): MatchTelemetryEvent<MatchTelemetryEventName> {
  if (!isMatchTelemetryEventName(doc.name)) {
    throw new Error(`Invalid telemetry event name: ${doc.name}`);
  }

  return {
    at: doc.at,
    matchId: doc.matchId,
    metrics: doc.metrics,
    name: doc.name,
    seat: doc.seat,
    tags: doc.tags,
    userId: doc.userId ?? null,
  };
}

export async function listRecentTelemetryEvents(
  db: DatabaseReader,
  input: {
    limit: number;
    matchId?: string;
    name?: string;
  },
) {
  const limit = Math.min(Math.max(input.limit, 1), 100);

  if (input.matchId) {
    const docs = await db
      .query("telemetryEvents")
      .withIndex("by_matchId_and_at", (query) =>
        query.eq("matchId", input.matchId),
      )
      .order("desc")
      .take(input.name ? Math.max(limit * 4, 50) : limit);

    const filteredDocs = input.name
      ? docs.filter((doc) => doc.name === input.name).slice(0, limit)
      : docs;

    return filteredDocs.map(toTelemetryEvent);
  }

  if (input.name) {
    const telemetryName = input.name;
    const docs = await db
      .query("telemetryEvents")
      .withIndex("by_name_and_at", (query) => query.eq("name", telemetryName))
      .order("desc")
      .take(limit);

    return docs.map(toTelemetryEvent);
  }

  const docs = await db
    .query("telemetryEvents")
    .withIndex("by_at")
    .order("desc")
    .take(limit);
  return docs.map(toTelemetryEvent);
}

function isTelemetryEventName(value: string): value is MatchTelemetryEventName {
  return MATCH_TELEMETRY_EVENT_NAMES.some((name) => name === value);
}
