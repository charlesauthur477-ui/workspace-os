import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireDeviceAuth, DeviceAuthedRequest, hashDeviceToken } from "../../middleware/requireDeviceAuth";
import { writeAuditLog } from "../audit/auditLog";

export const connectorRouter = Router();

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes to type the code in

function generatePairingCode(): string {
  // Human-typeable: 8 chars, split for readability, avoids ambiguous glyphs (0/O, 1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// --- Browser-side (requires a normal logged-in user session) ---------------

// Dashboard "Settings > Connector > Pair a new device" calls this to get a
// short code to type into the Connector app during its first-run setup.
connectorRouter.post("/pair/init", requireAuth, async (req: AuthedRequest, res) => {
  const code = generatePairingCode();
  const pairing = await prisma.pairingCode.create({
    data: { code, userId: req.auth!.userId, expiresAt: new Date(Date.now() + PAIRING_TTL_MS) },
  });
  res.status(201).json({ code: pairing.code, expiresAt: pairing.expiresAt });
});

connectorRouter.get("/devices", requireAuth, async (req: AuthedRequest, res) => {
  const devices = await prisma.deviceToken.findMany({
    where: { userId: req.auth!.userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json(devices.map(({ tokenHash, ...rest }) => rest)); // never return the hash
});

connectorRouter.post("/devices/:id/revoke", requireAuth, async (req: AuthedRequest, res) => {
  const device = await prisma.deviceToken.findUnique({ where: { id: req.params.id } });
  if (!device || device.userId !== req.auth!.userId) return res.status(404).json({ error: "Not found" });
  await prisma.deviceToken.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "device.revoke", targetType: "device_token", targetId: device.id });
  res.json({ ok: true });
});

// --- Connector-side (no user session; only has a pairing code) -------------

const redeemPairingSchema = z.object({ code: z.string().min(4), deviceName: z.string().min(1) });

// The Connector's first-run flow: user typed the pairing code shown in the
// dashboard, Connector posts it here (unauthenticated) and gets back a
// long-lived device token it stores locally (DPAPI-protected file).
connectorRouter.post("/pair/redeem", async (req, res) => {
  const { code, deviceName } = redeemPairingSchema.parse(req.body);

  const pairing = await prisma.pairingCode.findUnique({ where: { code } });
  if (!pairing || pairing.redeemedAt || pairing.expiresAt < new Date()) {
    return res.status(400).json({ error: "Invalid or expired pairing code" });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const device = await prisma.deviceToken.create({
    data: { userId: pairing.userId, name: deviceName, tokenHash: hashDeviceToken(token) },
  });
  await prisma.pairingCode.update({ where: { id: pairing.id }, data: { redeemedAt: new Date() } });
  await writeAuditLog({ actorUserId: pairing.userId, action: "device.pair", targetType: "device_token", targetId: device.id });

  res.status(201).json({ deviceToken: token, deviceId: device.id });
});

// What the Connector needs to know it can launch: this user's RDP list
// (connection metadata only, never credentials — those come one at a time
// via /rdp/:id/connect-token + connector/redeem) and every App Definition
// configured for desktop_launch, so it can match against its local
// launchers.json (slug -> installed exe path) without the API needing to
// know anything about the user's filesystem.
connectorRouter.get("/launch-config", requireDeviceAuth, async (req: DeviceAuthedRequest, res) => {
  const [rdps, desktopApps] = await Promise.all([
    prisma.rdpConnection.findMany({
      where: { ownerUserId: req.device!.userId },
      select: { id: true, name: true, host: true, port: true, groupName: true },
    }),
    prisma.appDefinition.findMany({
      where: { openMode: "desktop_launch", isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        instances: {
          where: { OR: [{ ownerUserId: req.device!.userId }, { visibilityScope: "workspace" }], status: "active" },
          select: { id: true, displayName: true, config: true },
        },
      },
    }),
  ]);
  res.json({ rdps, desktopApps });
});
