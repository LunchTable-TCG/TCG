const AUTH_TOKEN_KEY = "lunchtable.auth.token";

function getAuthStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getStoredAuthToken(): string | null {
  return getAuthStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
}

export function storeAuthToken(token: string) {
  getAuthStorage()?.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  getAuthStorage()?.removeItem(AUTH_TOKEN_KEY);
}
