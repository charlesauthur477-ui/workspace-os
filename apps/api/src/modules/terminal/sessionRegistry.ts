import crypto from "crypto";

// In-memory registries for the terminal feature. Mirrors the established
// pattern from apps/api/src/modules/rdp/router.ts's `connectTokens` Map: the
// browser is only ever handed a random opaque token, never a credential or a
// raw connection id it could reuse — the token is minted by an authenticated,
// authorized, rate-limited REST call (POST /terminal/:id/terminal-session)
// and redeemed exactly once by the WebSocket upgrade handler.
//
// Single-process, in-memory by design (same tradeoff RDP already made) — a
// restart or horizontal scale-out would invalidate pending/active sessions,
// which is acceptable for a short-lived (30s) authorization token and an
// interactive terminal session that's tied to one live process anyway.

export interface PendingTerminalSession {
  sshConnectionId: string;
  userId: string;
  expiresAt: number;
}

const PENDING_TTL_MS = 30_000;
export const MAX_CONCURRENT_SESSIONS_PER_USER = 6;

const pendingSessions = new Map<string, PendingTerminalSession>();
const activeSessionsByUser = new Map<string, Set<string>>();

function sweepExpiredPending(): void {
  const now = Date.now();
  for (const [token, session] of pendingSessions) {
    if (session.expiresAt <= now) pendingSessions.delete(token);
  }
}

// Mint a single-use, short-lived token authorizing exactly one user to open
// exactly one WebSocket terminal session against exactly one SshConnection.
export function createPendingSession(sshConnectionId: string, userId: string): string {
  sweepExpiredPending();
  const token = crypto.randomBytes(32).toString("base64url");
  pendingSessions.set(token, { sshConnectionId, userId, expiresAt: Date.now() + PENDING_TTL_MS });
  return token;
}

// Redeems (and immediately invalidates) a pending session token. Returns
// null if the token is unknown, already used, or expired.
export function consumePendingSession(token: string): PendingTerminalSession | null {
  const session = pendingSessions.get(token);
  if (!session) return null;
  pendingSessions.delete(token); // single-use, regardless of outcome below
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

export function countActiveSessions(userId: string): number {
  return activeSessionsByUser.get(userId)?.size ?? 0;
}

// Reserves a concurrency slot for a live SSH session. Returns false (and
// reserves nothing) if the user is already at the concurrent-session limit —
// callers must reject/close the connection in that case.
export function registerActiveSession(userId: string, sessionId: string): boolean {
  let set = activeSessionsByUser.get(userId);
  if (!set) {
    set = new Set();
    activeSessionsByUser.set(userId, set);
  }
  if (set.size >= MAX_CONCURRENT_SESSIONS_PER_USER) return false;
  set.add(sessionId);
  return true;
}

export function unregisterActiveSession(userId: string, sessionId: string): void {
  const set = activeSessionsByUser.get(userId);
  if (!set) return;
  set.delete(sessionId);
  if (set.size === 0) activeSessionsByUser.delete(userId);
}
