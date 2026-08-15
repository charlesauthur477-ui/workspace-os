import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";
import { encryptSecret } from "../credentials/encryption";
import { writeAuditLog } from "../audit/auditLog";
import { assertSafeSshHost, UnsafeSshHostError } from "./sshSafety";
import { createPendingSession } from "./sessionRegistry";

export const terminalRouter = Router();

// Phase 5A: dedicated limiter for the session-authorize endpoint, same
// reasoning as RDP's guacamoleSessionLimiter — this endpoint is the only way
// to obtain a token the WebSocket upgrade will accept, so it's the natural
// rate-limiting choke point for the whole terminal feature.
const terminalSessionLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many terminal session requests. Please wait a moment and try again." },
});

terminalRouter.use(requireAuth);

terminalRouter.get("/", async (req: AuthedRequest, res) => {
  const list = await prisma.sshConnection.findMany({ where: { ownerUserId: req.auth!.userId } });
  res.json(list.map(({ credentialId, ...rest }) => rest)); // never return credentialId to the browser
});

const authMethodSchema = z.enum(["password", "private_key"]);
const networkRouteSchema = z.enum(["public", "tailscale"]);

const createSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  authMethod: authMethodSchema.default("password"),
  secret: z.string().min(1), // password, or private key contents — never persisted as-is
  groupName: z.string().optional(),
  enabled: z.boolean().default(true),
  networkRoute: networkRouteSchema.default("public"),
});

terminalRouter.post("/", requirePermission("ssh.manage"), async (req: AuthedRequest, res) => {
  const data = createSchema.parse(req.body);

  try {
    await assertSafeSshHost(data.host);
  } catch (e) {
    if (e instanceof UnsafeSshHostError) return res.status(400).json({ error: e.message });
    throw e;
  }

  const { blob, keyId } = encryptSecret(data.secret);
  const credential = await prisma.credential.create({
    data: { ownerType: "user", ownerId: req.auth!.userId, encryptedBlob: blob, encryptionKeyId: keyId },
  });
  const connection = await prisma.sshConnection.create({
    data: {
      ownerUserId: req.auth!.userId,
      name: data.name,
      host: data.host,
      port: data.port,
      username: data.username,
      authMethod: data.authMethod,
      credentialId: credential.id,
      groupName: data.groupName,
      enabled: data.enabled,
      networkRoute: data.networkRoute,
    },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "ssh.create", targetType: "ssh_connection", targetId: connection.id });
  res.status(201).json({ id: connection.id, name: connection.name });
});

const updateSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  authMethod: authMethodSchema.default("password"),
  secret: z.string().min(1).optional(), // omit to keep the existing credential
  groupName: z.string().optional(),
  enabled: z.boolean().default(true),
  networkRoute: networkRouteSchema.default("public"),
});

terminalRouter.put("/:id", requirePermission("ssh.manage"), async (req: AuthedRequest, res) => {
  const connection = await prisma.sshConnection.findUnique({ where: { id: req.params.id } });
  if (!connection || connection.ownerUserId !== req.auth!.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  const data = updateSchema.parse(req.body);

  if (data.host !== connection.host) {
    try {
      await assertSafeSshHost(data.host);
    } catch (e) {
      if (e instanceof UnsafeSshHostError) return res.status(400).json({ error: e.message });
      throw e;
    }
  }

  let credentialId = connection.credentialId;
  if (data.secret) {
    const { blob, keyId } = encryptSecret(data.secret);
    if (credentialId) {
      await prisma.credential.update({ where: { id: credentialId }, data: { encryptedBlob: blob, encryptionKeyId: keyId } });
    } else {
      const credential = await prisma.credential.create({
        data: { ownerType: "user", ownerId: req.auth!.userId, encryptedBlob: blob, encryptionKeyId: keyId },
      });
      credentialId = credential.id;
    }
  }

  const updated = await prisma.sshConnection.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      host: data.host,
      port: data.port,
      username: data.username,
      authMethod: data.authMethod,
      credentialId,
      groupName: data.groupName,
      enabled: data.enabled,
      networkRoute: data.networkRoute,
    },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "ssh.update", targetType: "ssh_connection", targetId: updated.id });
  res.json({ id: updated.id, name: updated.name });
});

terminalRouter.delete("/:id", requirePermission("ssh.manage"), async (req: AuthedRequest, res) => {
  const connection = await prisma.sshConnection.findUnique({ where: { id: req.params.id } });
  if (!connection || connection.ownerUserId !== req.auth!.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.sshConnection.delete({ where: { id: req.params.id } });
  if (connection.credentialId) {
    await prisma.credential.deleteMany({ where: { id: connection.credentialId } });
  }
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "ssh.delete", targetType: "ssh_connection", targetId: req.params.id });
  res.json({ ok: true });
});

// Authorizes exactly one browser-based terminal session for one connection.
// Mints a short-lived, single-use opaque token — the browser gets that
// token and NOTHING else (no credential, no decrypted secret, and the
// connection id it already had access to is not itself sufficient to open a
// session; every check below runs again here regardless of what the
// frontend already believes). The actual SSH connection + credential
// decryption happens only after this token is redeemed by the authenticated
// WebSocket upgrade handler (see ./wsServer.ts) — never in this handler.
terminalRouter.post(
  "/:id/terminal-session",
  terminalSessionLimiter,
  requirePermission("ssh.connect"),
  async (req: AuthedRequest, res) => {
    const connection = await prisma.sshConnection.findUnique({ where: { id: req.params.id } });

    if (!connection || connection.ownerUserId !== req.auth!.userId) {
      await writeAuditLog({
        actorUserId: req.auth!.userId,
        action: "terminal.authorization_failed",
        targetType: "ssh_connection",
        targetId: req.params.id,
        metadata: { reason: "not_found_or_not_owner" },
      });
      return res.status(404).json({ error: "Not found" });
    }

    if (!connection.enabled) {
      await writeAuditLog({
        actorUserId: req.auth!.userId,
        action: "terminal.authorization_failed",
        targetType: "ssh_connection",
        targetId: connection.id,
        metadata: { reason: "connection_disabled" },
      });
      return res.status(403).json({ error: "This connection is disabled." });
    }

    if (!connection.credentialId) {
      await writeAuditLog({
        actorUserId: req.auth!.userId,
        action: "terminal.authorization_failed",
        targetType: "ssh_connection",
        targetId: connection.id,
        metadata: { reason: "no_credential" },
      });
      return res.status(409).json({ error: "This connection has no saved credential." });
    }

    const token = createPendingSession(connection.id, req.auth!.userId);

    await writeAuditLog({
      actorUserId: req.auth!.userId,
      action: "terminal.session_authorized",
      targetType: "ssh_connection",
      targetId: connection.id,
      metadata: { name: connection.name, host: connection.host },
    });

    res.json({ token });
  }
);
