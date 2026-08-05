import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";
import { writeAuditLog } from "../audit/auditLog";

export const appsRouter = Router();
appsRouter.use(requireAuth);

// Categories + app definitions the current user is allowed to see, grouped
// for the dashboard grid. This is the endpoint the frontend dashboard calls.
appsRouter.get("/dashboard", async (req: AuthedRequest, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      appDefinitions: {
        where: { isActive: true },
        include: {
          instances: {
            where: {
              OR: [
                { ownerUserId: req.auth!.userId },
                { visibilityScope: "workspace" },
              ],
              status: "active",
            },
          },
        },
      },
    },
  });
  res.json(categories);
});

// Owner/Admin: create a new App Definition (the "+ Add App" flow) — this is
// the whole point of the plugin system: no source change needed to add an app.
const createAppDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  icon: z.string().default("app-window"),
  description: z.string().default(""),
  openMode: z.enum(["embedded", "new_tab", "desktop_launch", "custom"]),
  configSchema: z.record(z.unknown()).default({}),
  capabilities: z.array(z.string()).default([]),
});

appsRouter.post("/definitions", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const data = createAppDefSchema.parse(req.body);
  // zod's z.record(z.unknown()) types as Record<string, unknown>, which isn't
  // structurally assignable to Prisma's InputJsonValue — cast at the boundary
  // since this is genuinely arbitrary, caller-supplied JSON.
  const def = await prisma.appDefinition.create({
    data: { ...data, configSchema: data.configSchema as Prisma.InputJsonValue },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_definition.create", targetType: "app_definition", targetId: def.id });
  res.status(201).json(def);
});

appsRouter.get("/definitions", requirePermission("app.manage"), async (_req, res) => {
  res.json(await prisma.appDefinition.findMany({ include: { category: true } }));
});

// Any authenticated user: create their own instance of an app (e.g. "my Gmail").
const createInstanceSchema = z.object({
  appDefinitionId: z.string().uuid(),
  displayName: z.string().min(1),
  config: z.record(z.unknown()).default({}),
  visibilityScope: z.enum(["private", "role", "workspace"]).default("private"),
});

appsRouter.post("/instances", async (req: AuthedRequest, res) => {
  const data = createInstanceSchema.parse(req.body);
  const instance = await prisma.appInstance.create({
    data: { ...data, config: data.config as Prisma.InputJsonValue, ownerUserId: req.auth!.userId },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_instance.create", targetType: "app_instance", targetId: instance.id });
  res.status(201).json(instance);
});

appsRouter.delete("/instances/:id", async (req: AuthedRequest, res) => {
  const instance = await prisma.appInstance.findUnique({ where: { id: req.params.id } });
  if (!instance) return res.status(404).json({ error: "Not found" });
  if (instance.ownerUserId !== req.auth!.userId) return res.status(403).json({ error: "Not your instance" });
  await prisma.appInstance.delete({ where: { id: req.params.id } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_instance.delete", targetType: "app_instance", targetId: req.params.id });
  res.json({ ok: true });
});
