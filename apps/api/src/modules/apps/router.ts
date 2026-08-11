import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requirePermission } from "../../middleware/requirePermission";
import { writeAuditLog } from "../audit/auditLog";
import { assertSafeConfig, UnsafeUrlError } from "../../lib/urlSafety";

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

// Kept in one place so every route that accepts an openMode (create AND
// update) validates against the same set — including the three new modes
// added for the App Registry Admin work (internal/rdp/terminal are schema-
// ready now; their actual launch handling lands in later phases).
const openModeEnum = z.enum(["embedded", "new_tab", "desktop_launch", "internal", "rdp", "terminal", "custom"]);

function handleUnsafeUrl(res: Response, e: unknown): boolean {
  if (e instanceof UnsafeUrlError) {
    res.status(400).json({ error: e.message });
    return true;
  }
  return false;
}

// Owner/Admin: create a new App Definition (the "+ Add App" flow) — this is
// the whole point of the plugin system: no source change needed to add an app.
const createAppDefSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  icon: z.string().default("app-window"),
  description: z.string().default(""),
  openMode: openModeEnum,
  configSchema: z.record(z.unknown()).default({}),
  capabilities: z.array(z.string()).default([]),
  launchCommand: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

appsRouter.post("/definitions", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const data = createAppDefSchema.parse(req.body);
  const def = await prisma.appDefinition.create({ data });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_definition.create", targetType: "app_definition", targetId: def.id, metadata: { name: def.name, slug: def.slug } });
  res.status(201).json(def);
});

appsRouter.get("/definitions", requirePermission("app.manage"), async (_req, res) => {
  res.json(await prisma.appDefinition.findMany({ include: { category: true }, orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }] }));
});

// Single definition + its instances, for the admin edit form.
appsRouter.get("/definitions/:id", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const def = await prisma.appDefinition.findUnique({
    where: { id: req.params.id },
    include: { category: true, instances: true },
  });
  if (!def) return res.status(404).json({ error: "Not found" });
  res.json(def);
});

// Partial update — every field optional so the admin form can send only
// what changed. openMode/categoryId, if present, are still validated.
const updateAppDefSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  openMode: openModeEnum.optional(),
  configSchema: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
  launchCommand: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

appsRouter.patch("/definitions/:id", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const existing = await prisma.appDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const data = updateAppDefSchema.parse(req.body);
  const updated = await prisma.appDefinition.update({ where: { id: req.params.id }, data });
  await writeAuditLog({
    actorUserId: req.auth!.userId,
    action: "app_definition.update",
    targetType: "app_definition",
    targetId: updated.id,
    metadata: { changedFields: Object.keys(data) },
  });
  res.json(updated);
});

// Soft-delete by default (isActive: false) so it disappears from the
// dashboard without breaking any AppInstance rows that reference it. Only
// hard-deletes the row if literally no instance references it — otherwise a
// hard delete would either cascade-fail on the FK or orphan instances.
appsRouter.delete("/definitions/:id", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const existing = await prisma.appDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const instanceCount = await prisma.appInstance.count({ where: { appDefinitionId: req.params.id } });

  if (instanceCount === 0) {
    await prisma.appDefinition.delete({ where: { id: req.params.id } });
    await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_definition.delete", targetType: "app_definition", targetId: req.params.id, metadata: { hardDeleted: true, name: existing.name } });
    return res.json({ ok: true, hardDeleted: true });
  }

  await prisma.appDefinition.update({ where: { id: req.params.id }, data: { isActive: false } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_definition.delete", targetType: "app_definition", targetId: req.params.id, metadata: { hardDeleted: false, instanceCount, name: existing.name } });
  res.json({ ok: true, hardDeleted: false, softDeleted: true, instanceCount });
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
  try {
    await assertSafeConfig(data.config);
  } catch (e) {
    if (handleUnsafeUrl(res, e)) return;
    throw e;
  }
  const instance = await prisma.appInstance.create({
    data: { ...data, ownerUserId: req.auth!.userId },
  });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_instance.create", targetType: "app_instance", targetId: instance.id });
  res.status(201).json(instance);
});

// Partial update for an existing instance — owner (or app.manage for
// workspace-shared instances) can change displayName/config/visibility.
const updateInstanceSchema = z.object({
  displayName: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  visibilityScope: z.enum(["private", "role", "workspace"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

appsRouter.patch("/instances/:id", async (req: AuthedRequest, res) => {
  const instance = await prisma.appInstance.findUnique({ where: { id: req.params.id } });
  if (!instance) return res.status(404).json({ error: "Not found" });

  // Workspace-shared instances (ownerUserId: null) can only be edited by
  // someone with app.manage; a private instance can only be edited by its owner.
  if (instance.ownerUserId === null) {
    const hasManage = await prisma.rolePermission.findFirst({
      where: { roleId: req.auth!.roleId ?? undefined, permission: { key: "app.manage" } },
    });
    if (!hasManage) return res.status(403).json({ error: "Missing permission: app.manage" });
  } else if (instance.ownerUserId !== req.auth!.userId) {
    return res.status(403).json({ error: "Not your instance" });
  }

  const data = updateInstanceSchema.parse(req.body);
  if (data.config) {
    try {
      await assertSafeConfig(data.config);
    } catch (e) {
      if (handleUnsafeUrl(res, e)) return;
      throw e;
    }
  }

  const updated = await prisma.appInstance.update({ where: { id: req.params.id }, data });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_instance.update", targetType: "app_instance", targetId: updated.id, metadata: { changedFields: Object.keys(data) } });
  res.json(updated);
});

appsRouter.delete("/instances/:id", async (req: AuthedRequest, res) => {
  const instance = await prisma.appInstance.findUnique({ where: { id: req.params.id } });
  if (!instance) return res.status(404).json({ error: "Not found" });
  if (instance.ownerUserId !== req.auth!.userId) return res.status(403).json({ error: "Not your instance" });
  await prisma.appInstance.delete({ where: { id: req.params.id } });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "app_instance.delete", targetType: "app_instance", targetId: req.params.id });
  res.json({ ok: true });
});

// Category CRUD — needed so the admin UI's "change category" / "add new
// category inline" flows don't require a DB console. GET is gated behind
// app.manage too since it's currently only consumed by the admin UI, not
// the public dashboard (which gets categories bundled via /apps/dashboard).
appsRouter.get("/categories", requirePermission("app.manage"), async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { sortOrder: "asc" } }));
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().default("folder"),
  sortOrder: z.number().int().default(0),
});

appsRouter.post("/categories", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const data = createCategorySchema.parse(req.body);
  const category = await prisma.category.create({ data });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "category.create", targetType: "category", targetId: category.id, metadata: { name: category.name } });
  res.status(201).json(category);
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

appsRouter.patch("/categories/:id", requirePermission("app.manage"), async (req: AuthedRequest, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const data = updateCategorySchema.parse(req.body);
  const updated = await prisma.category.update({ where: { id: req.params.id }, data });
  await writeAuditLog({ actorUserId: req.auth!.userId, action: "category.update", targetType: "category", targetId: updated.id, metadata: { changedFields: Object.keys(data) } });
  res.json(updated);
});
