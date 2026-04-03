import { describe, expect, it } from "vitest";

import { shouldRefreshSeatViewAfterSubmit } from "../apps/bot-runner/src/refresh";

describe("shouldRefreshSeatViewAfterSubmit", () => {
  it("refreshes after accepted intents so in-flight subscription updates are not lost", () => {
    expect(
      shouldRefreshSeatViewAfterSubmit({
        accepted: true,
        reason: null,
      }),
    ).toBe(true);
  });

  it("refreshes after stale-state rejections so the runner can retry on the latest view", () => {
    expect(
      shouldRefreshSeatViewAfterSubmit({
        accepted: false,
        reason: "staleStateVersion",
      }),
    ).toBe(true);
  });

  it("does not refresh for terminal non-stale rejections", () => {
    expect(
      shouldRefreshSeatViewAfterSubmit({
        accepted: false,
        reason: "notPriorityOwner",
      }),
    ).toBe(false);
  });
});
