import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "./requireAuth";

// Centralized permission check — every protected route goes through this,
// so access control never depends on the frontend hiding a button.
export function requirePermission(permissionKey: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Not authenticated" });

    if (!req.auth.roleId) return res.status(403).json({ error: "No role assigned yet" });

    const hasPermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: req.auth.roleId,
        permission: { key: permissionKey },
      },
    });

    if (!hasPermission) {
      return res.status(403).json({ error: `Missing permission: ${permissionKey}` });
    }
    next();
  };
}
