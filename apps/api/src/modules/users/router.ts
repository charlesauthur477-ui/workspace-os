import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";
import { writeAuditLog } from "../audit/auditLog";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Current user's own profile — no special permission needed.
usersRouter.get("/me", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    role: user.role ? { id: user.role.id, name: user.role.name } : null,
    permissions: user.role?.rolePermissions.map((rp) => rp.permission.key) ?? [],
  });
});

// Owner/Admin: list all users (including pending ones awaiting approval).
usersRouter.get("/", requirePermission("user.manage"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map((u) => ({
    id: u.id, email: u.email, displayName: u.displayName, status: u.status,
    role: u.role?.name ?? null, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
  })));
});

const approveSchema = z.object({ roleId: z.string().uuid() });

// Owner/Admin: approve a pending user and assign a role.
usersRouter.post("/:id/approve", requirePermission("user.manage"), async (req: AuthedRequest, res) => {
  const { roleId } = approveSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: "active", roleId },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "user.approve", targetType: "user", targetId: user.id, metadata: { roleId } });
  res.json({ ok: true });
});

// Owner/Admin: disable a user (revokes access, keeps their data).
usersRouter.post("/:id/disable", requirePermission("user.manage"), async (req: AuthedRequest, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { status: "disabled" } });
  await prisma.session.updateMany({ where: { userId: req.params.id }, data: { revokedAt: new Date() } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "user.disable", targetType: "user", targetId: req.params.id });
  res.json({ ok: true });
});

// Owner/Admin: change a user's role.
const roleSchema = z.object({ roleId: z.string().uuid() });
usersRouter.post("/:id/role", requirePermission("user.manage"), async (req: AuthedRequest, res) => {
  const { roleId } = roleSchema.parse(req.body);
  await prisma.user.update({ where: { id: req.params.id }, data: { roleId } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "user.role_change", targetType: "user", targetId: req.params.id, metadata: { roleId } });
  res.json({ ok: true });
});
