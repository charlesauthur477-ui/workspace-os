import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

rolesRouter.get("/", requirePermission("role.manage"), async (_req, res) => {
  const roles = await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  res.json(roles.map((r) => ({
    id: r.id, name: r.name, isSystem: r.isSystem,
    permissions: r.rolePermissions.map((rp) => rp.permission.key),
  })));
});

rolesRouter.get("/permissions", requirePermission("role.manage"), async (_req, res) => {
  res.json(await prisma.permission.findMany());
});
