import type { AuthTokens } from "@flowmint/shared";
import { api, ApiRequestError } from "../api/client";
import { saveTokens, loadTokens, clearTokens } from "../storage/secureStore";

type Listener = (state: { accessToken: string | null }) => void;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l({ accessToken }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function hydrate(): Promise<void> {
  const tokens = await loadTokens();
  if (tokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  }
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await saveTokens(tokens.accessToken, tokens.refreshToken);
  notify();
}

export async function clear(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await clearTokens();
  notify();
}

// Only one refresh call in flight even if several screens' requests 401 at
// the same moment (e.g. app resumed from background after the 15-minute
// access-token TTL passed) — they all await the same promise instead of
// racing separate refresh calls, any of which would rotate the refresh
// token and invalidate the others.
async function doRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = api
      .post<AuthTokens>("/auth/refresh", { refreshToken })
      .then(async (tokens) => {
        await setTokens(tokens);
        return tokens.accessToken;
      })
      .catch(async () => {
        await clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Every authenticated screen calls the API through this rather than `api.*`
// directly — it attaches the current access token and, on a 401, refreshes
// once and retries transparently. If refresh itself fails (refresh token
// also expired or revoked — e.g. a password reset elsewhere), tokens are
// cleared and the 401 propagates, which drops the navigator back to Login.
export async function authedRequest<T>(
  method: "get" | "post" | "patch",
  path: string,
  body?: unknown
): Promise<T> {
  const attempt = (): Promise<T> =>
    method === "get" ? api.get<T>(path, accessToken ?? undefined) : api[method]<T>(path, body, accessToken ?? undefined);

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      const newAccessToken = await doRefresh();
      if (newAccessToken) return attempt();
    }
    throw err;
  }
}
