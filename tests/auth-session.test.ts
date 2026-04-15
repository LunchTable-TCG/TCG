import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from "../apps/web/src/auth";

describe("auth session storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores and clears the auth token through browser storage only", () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
    };

    vi.stubGlobal("window", { localStorage });

    expect(getStoredAuthToken()).toBe(null);

    storeAuthToken("token_123");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "lunchtable.auth.token",
      "token_123",
    );
    expect(getStoredAuthToken()).toBe("token_123");

    clearAuthToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      "lunchtable.auth.token",
    );
    expect(getStoredAuthToken()).toBe(null);
  });
});
