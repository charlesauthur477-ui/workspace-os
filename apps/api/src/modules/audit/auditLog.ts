import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export async function writeAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      ip: params.ip,
    },
  });
}
