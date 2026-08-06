import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

export interface DeviceAuthedRequest extends Request {
  device?: { deviceTokenId: string; userId: string };
}

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Separate from requireAuth (which verifies a short-lived user JWT). The
// Connector never sees a user's login session — it holds its own long-lived,
// per-machine, revocable token issued at pairing time. Header format:
// `Authorization: Device <token>`.
export async function requireDeviceAuth(req: DeviceAuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Device ")) {
    return res.status(401).json({ error: "Missing device token" });
  }
  const token = header.slice("Device ".length);
  const tokenHash = hashDeviceToken(token);

  const record = await prisma.deviceToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt) {
    return res.status(401).json({ error: "Invalid or revoked device token" });
  }

  await prisma.deviceToken.update({ where: { id: record.id }, data: { lastSeenAt: new Date() } });

  req.device = { deviceTokenId: record.id, userId: record.userId };
  next();
}
