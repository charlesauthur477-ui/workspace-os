import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";
import { requireDeviceAuth, DeviceAuthedRequest } from "../../middleware/requireDeviceAuth";
import { encryptSecret, decryptSecret } from "../credentials/encryption";
import { writeAuditLog } from "../audit/auditLog";

export const rdpRouter = Router();

// In-memory one-time-token store for the Connector handoff. A real deployment
// would use Redis so tokens survive an API restart, but the single-use +
// 30s-expiry design keeps the blast radius tiny either way.
const connectTokens = new Map<string, { rdpConnectionId: string; userId: string; expiresAt: number }>();

// Every route below except /connector/redeem is browser-facing and needs a
// normal user session. /connector/redeem is called by the Connector app,
// which authenticates with its own device token instead (see below) — it
// must NOT go through requireAuth.
rdpRouter.use((req, res, next) => {
  if (req.path === "/connector/redeem") return next();
  return requireAuth(req, res, next);
});

rdpRouter.get("/", async (req: AuthedRequest, res) => {
  const list = await prisma.rdpConnection.findMany({ where: { ownerUserId: req.auth!.userId } });
  res.json(list.map(({ credentialId, ...rest }) => rest)); // never return credentialId to the browser
});

const createSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().default(3389),
  username: z.string().min(1),
  password: z.string().min(1),
  groupName: z.string().optional(),
  notes: z.string().optional(),
});

rdpRouter.post("/", requirePermission("rdp.manage"), async (req: AuthedRequest, res) => {
  const data = createSchema.parse(req.body);
  const { blob, keyId } = encryptSecret(data.password);
  const credential = await prisma.credential.create({
    data: { ownerType: "user", ownerId: req.auth!.userId, encryptedBlob: blob, encryptionKeyId: keyId },
  });
  const connection = await prisma.rdpConnection.create({
    data: {
      ownerUserId: req.auth!.userId,
      name: data.name,
      host: data.host,
      port: data.port,
      username: data.username,
      credentialId: credential.id,
      groupName: data.groupName,
      notes: data.notes,
    },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "rdp.create", targetType: "rdp_connection", targetId: connection.id });
  res.status(201).json({ id: connection.id, name: connection.name });
});

rdpRouter.delete("/:id", requirePermission("rdp.manage"), async (req: AuthedRequest, res) => {
  const connection = await prisma.rdpConnection.findUnique({ where: { id: req.params.id } });
  if (!connection || connection.ownerUserId !== req.auth!.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  await prisma.rdpConnection.delete({ where: { id: req.params.id } });
  await prisma.credential.deleteMany({ where: { id: connection.credentialId } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "rdp.delete", targetType: "rdp_connection", targetId: req.params.id });
  res.json({ ok: true });
});

// Step 1 of the Connector handoff: the dashboard tile calls this to mint a
// short-lived, single-use token, then redirects the browser to
// workspaceos://connect?kind=rdp&token=<token>. The Connector app (installed
// on the user's machine, registered as that protocol's handler) picks that
// up and exchanges it in step 2.
rdpRouter.post("/:id/connect-token", requirePermission("rdp.connect"), async (req: AuthedRequest, res) => {
  const connection = await prisma.rdpConnection.findUnique({ where: { id: req.params.id } });
  if (!connection || connection.ownerUserId !== req.auth!.userId) {
    return res.status(404).json({ error: "Not found" });
  }
  const token = crypto.randomBytes(24).toString("base64url");
  connectTokens.set(token, { rdpConnectionId: connection.id, userId: req.auth!.userId, expiresAt: Date.now() + 30_000 });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "rdp.connect_token_issued", targetType: "rdp_connection", targetId: connection.id });
  res.json({ token, protocolUrl: `workspaceos://connect?kind=rdp&token=${token}` });
});

// Step 2: called by the local Connector app, authenticated with its own
// long-lived device token (paired via POST /connector/pair/redeem) — never
// the browser's short-lived user session. We also check the token's userId
// matches the device's owner, so one paired device can never redeem another
// user's connect token even if it somehow guessed/observed it.
rdpRouter.post("/connector/redeem", requireDeviceAuth, async (req: DeviceAuthedRequest, res) => {
  const { token } = z.object({ token: z.string() }).parse(req.body);
  const entry = connectTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
  if (entry.userId !== req.device!.userId) {
    return res.status(403).json({ error: "Token does not belong to this device's user" });
  }
  connectTokens.delete(token); // single use

  const connection = await prisma.rdpConnection.findUnique({ where: { id: entry.rdpConnectionId } });
  if (!connection) return res.status(404).json({ error: "Connection not found" });

  const credential = await prisma.credential.findUnique({ where: { id: connection.credentialId } });
  if (!credential) return res.status(404).json({ error: "Credential not found" });

  const password = decryptSecret(Buffer.from(credential.encryptedBlob));

  await writeAuditLog({ actorUserId: entry.userId, action: "rdp.connect", targetType: "rdp_connection", targetId: connection.id });

  res.json({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password, // only ever sent to the authenticated local Connector, never the browser
  });
});
