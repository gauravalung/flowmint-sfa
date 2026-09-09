import type { AuthTokens } from "@flowmint/shared";
import { api, ApiRequestError } from "../api/client";

// Tradeoff worth stating plainly: tokens live in localStorage, which is
// readable by any script on this origin (an XSS vector) — the same
// tradeoff every plain-React admin SPA without a same-site cookie session
// makes. Acceptable at this "prototype posture" (see claude/DECISIONS.md);
// worth revisiting (httpOnly cookie session, or at least sessionStorage +
// short-lived access tokens) before this is exposed beyond a trusted admin
// network.
const ACCESS_TOKEN_KEY = "flowmint_admin.accessToken";
const REFRESH_TOKEN_KEY = "flowmint_admin.refreshToken";

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

export function hydrate(): void {
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  notify();
}

export function clear(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  notify();
}

// Only one refresh call in flight even if several requests 401 at the same
// moment — same reasoning as the mobile app's tokenStore.
async function doRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = api
      .post<AuthTokens>("/auth/refresh", { refreshToken })
      .then((tokens) => {
        setTokens(tokens);
        return tokens.accessToken;
      })
      .catch(() => {
        clear();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

type Method = "get" | "post" | "patch" | "put" | "delete";

// Every authenticated screen goes through this rather than `api.*` directly
// — it attaches the current access token and, on a 401, refreshes once and
// retries transparently.
export async function authedRequest<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const attempt = (): Promise<T> =>
    method === "get" || method === "delete"
      ? api[method]<T>(path, accessToken ?? undefined)
      : api[method]<T>(path, body, accessToken ?? undefined);

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

export async function authedUpload<T>(path: string, formData: FormData): Promise<T> {
  const attempt = () => api.upload<T>(path, formData, accessToken ?? undefined);
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

export async function authedBlob(path: string): Promise<Blob> {
  const attempt = () => api.blob(path, accessToken ?? undefined);
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
