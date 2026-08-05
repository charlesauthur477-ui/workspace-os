import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get("/", requirePermission("audit.view"), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true, displayName: true } } },
  });
  res.json(logs);
});
