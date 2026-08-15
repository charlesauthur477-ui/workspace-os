import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import type { Duplex } from "stream";
import { Client as SshClient, ClientChannel } from "ssh2";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { decryptSecret } from "../credentials/encryption";
import { writeAuditLog } from "../audit/auditLog";
import { env } from "../../config/env";
import {
  consumePendingSession,
  registerActiveSession,
  unregisterActiveSession,
  MAX_CONCURRENT_SESSIONS_PER_USER,
} from "./sessionRegistry";

// Phase 5A: the ONLY way terminal input/output ever travels between the
// browser and a target host. There is deliberately no HTTP endpoint that
// accepts a command string — everything here is an interactive PTY stream
// tunneled over this one authenticated WebSocket. See router.ts's
// /:id/terminal-session for how the single-use token below is minted.
//
// Audit logging here intentionally never includes terminal input, terminal
// output, passwords, or private keys — only connection metadata (name,
// host) and outcome (started/ended/failed/reason).

const TERMINAL_WS_PATH = "/terminal/ws";
const SSH_READY_TIMEOUT_MS = 15_000;

type ClientFrame =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "disconnect" };

function send(ws: WebSocket, frame: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

export function attachTerminalWebSocketServer(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "", "http://internal");
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== TERMINAL_WS_PATH) return; // not ours — leave the socket alone

    // Origin validation: the terminal WS must only ever be opened by the
    // Workspace OS frontend itself, never a third-party page. Cookies/CORS
    // don't cover the WebSocket handshake, so this check is the actual
    // defense against cross-site WebSocket hijacking here.
    const origin = req.headers.origin;
    if (!origin || origin !== env.appUrl) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Single-use: a token that was already redeemed (or never existed, or
    // expired) fails here — knowing/replaying a token is not enough on its
    // own even within its TTL.
    const pending = consumePendingSession(token);
    if (!pending) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, pending.sshConnectionId, pending.userId);
    });
  });
}

async function handleConnection(ws: WebSocket, sshConnectionId: string, userId: string): Promise<void> {
  const sessionId = crypto.randomUUID();
  let stream: ClientChannel | null = null;
  let sessionCounted = false;
  let endedLogged = false;
  const sshClient = new SshClient();

  const logEndedOnce = (metadata: Record<string, unknown> = {}) => {
    if (endedLogged) return;
    endedLogged = true;
    writeAuditLog({
      actorUserId: userId,
      action: "terminal.session_ended",
      targetType: "ssh_connection",
      targetId: sshConnectionId,
      metadata,
    }).catch(() => {});
  };

  const cleanup = () => {
    if (sessionCounted) {
      sessionCounted = false;
      unregisterActiveSession(userId, sessionId);
    }
    try {
      stream?.close();
    } catch {
      // best effort
    }
    try {
      sshClient.end();
    } catch {
      // best effort
    }
  };

  // Re-verify authorization at connect time, not just at token-mint time:
  // the REST /terminal-session call already confirmed ownership + enabled
  // seconds ago, but re-checking here closes the (small) window where the
  // connection could be disabled/deleted/reassigned in between.
  const connection = await prisma.sshConnection.findUnique({ where: { id: sshConnectionId } });
  if (!connection || connection.ownerUserId !== userId || !connection.enabled) {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.authorization_failed",
      targetType: "ssh_connection",
      targetId: sshConnectionId,
      metadata: { reason: "revoked_before_connect" },
    });
    send(ws, { type: "error", message: "This connection is no longer available." });
    ws.close();
    return;
  }

  if (!registerActiveSession(userId, sessionId)) {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.connection_failed",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { reason: "max_concurrent_sessions", limit: MAX_CONCURRENT_SESSIONS_PER_USER },
    });
    send(ws, { type: "error", message: "Too many open terminal sessions. Close one and try again." });
    ws.close();
    return;
  }
  sessionCounted = true;

  if (!connection.credentialId) {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.connection_failed",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { reason: "no_credential" },
    });
    send(ws, { type: "error", message: "This connection has no saved credential." });
    cleanup();
    ws.close();
    return;
  }

  const credential = await prisma.credential.findUnique({ where: { id: connection.credentialId } });
  if (!credential) {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.connection_failed",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { reason: "credential_missing" },
    });
    send(ws, { type: "error", message: "This connection's credential could not be found." });
    cleanup();
    ws.close();
    return;
  }

  // Decrypted only into this local variable, for the lifetime of the ssh2
  // connect call — never logged, never echoed back to the browser.
  let secret: string;
  try {
    secret = decryptSecret(Buffer.from(credential.encryptedBlob));
  } catch {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.connection_failed",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { reason: "credential_decrypt_failed" },
    });
    send(ws, { type: "error", message: "This connection's credential could not be decrypted." });
    cleanup();
    ws.close();
    return;
  }

  let readyReached = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectConfig: any = {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    readyTimeout: SSH_READY_TIMEOUT_MS,
  };
  if (connection.authMethod === "private_key") {
    connectConfig.privateKey = secret;
  } else {
    connectConfig.password = secret;
  }

  sshClient.on("ready", () => {
    readyReached = true;
    writeAuditLog({
      actorUserId: userId,
      action: "terminal.session_started",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { name: connection.name, host: connection.host },
    }).catch(() => {});

    sshClient.shell({ term: "xterm-256color" }, (err, ch) => {
      if (err || !ch) {
        writeAuditLog({
          actorUserId: userId,
          action: "terminal.connection_failed",
          targetType: "ssh_connection",
          targetId: connection.id,
          metadata: { reason: "shell_open_failed" },
        }).catch(() => {});
        send(ws, { type: "error", message: "Couldn't open a shell on the remote host." });
        cleanup();
        ws.close();
        return;
      }
      stream = ch;

      ch.on("data", (data: Buffer) => send(ws, { type: "output", data: data.toString("utf8") }));
      ch.stderr?.on("data", (data: Buffer) => send(ws, { type: "output", data: data.toString("utf8") }));
      ch.on("close", () => {
        cleanup();
        logEndedOnce();
        ws.close();
      });
    });
  });

  sshClient.on("error", () => {
    if (!readyReached) {
      writeAuditLog({
        actorUserId: userId,
        action: "terminal.connection_failed",
        targetType: "ssh_connection",
        targetId: connection.id,
        metadata: { name: connection.name, host: connection.host },
      }).catch(() => {});
      send(ws, {
        type: "error",
        message: "Couldn't connect to the remote host. Check the host, port, and credentials.",
      });
    } else {
      logEndedOnce({ reason: "ssh_error" });
    }
    cleanup();
    ws.close();
  });

  sshClient.on("close", () => {
    cleanup();
    logEndedOnce();
  });

  ws.on("message", (raw: Buffer) => {
    let frame: ClientFrame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed frames rather than tear down the session
    }
    if (frame.type === "input" && typeof frame.data === "string") {
      stream?.write(frame.data);
    } else if (frame.type === "resize" && Number.isFinite(frame.cols) && Number.isFinite(frame.rows)) {
      const cols = Math.max(1, Math.min(1000, Math.floor(frame.cols)));
      const rows = Math.max(1, Math.min(1000, Math.floor(frame.rows)));
      stream?.setWindow(rows, cols, 0, 0);
    } else if (frame.type === "disconnect") {
      cleanup();
      ws.close();
    }
  });

  ws.on("close", () => {
    cleanup();
    logEndedOnce();
  });

  ws.on("error", () => {
    cleanup();
  });

  try {
    sshClient.connect(connectConfig);
  } catch {
    await writeAuditLog({
      actorUserId: userId,
      action: "terminal.connection_failed",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { reason: "connect_threw" },
    });
    send(ws, { type: "error", message: "Couldn't connect to the remote host." });
    cleanup();
    ws.close();
  }
}
