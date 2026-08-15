// Thin fetch wrapper for calling the Express API. Access tokens are kept in
// memory (module-level) after the Google OAuth callback exchanges them —
// never in localStorage, since this is an artifact-adjacent security habit
// worth keeping everywhere.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function googleLoginUrl(): string {
  return `${API_URL}/auth/google`;
}

// Phase 5A: builds a browser-reachable WebSocket URL against the same API
// origin (ws/wss mirrors whatever scheme API_URL uses). The terminal
// WebSocket authenticates via a short-lived one-time token minted by
// POST /terminal/:id/terminal-session — passed as a query param here — not
// the JWT access token, so this deliberately does not attach one.
export function apiWebSocketUrl(path: string, params?: Record<string, string>): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return `${wsBase}${path}${query}`;
}
