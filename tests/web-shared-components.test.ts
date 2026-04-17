import { describe, expect, it } from "vitest";

import { getStatusBannerA11yProps } from "../apps/web/src/components/shared";

describe("shared status banner", () => {
  it("exposes a polite live-region contract for async notices", () => {
    expect(getStatusBannerA11yProps()).toEqual({
      "aria-atomic": "true",
      "aria-live": "polite",
    });
  });
});
