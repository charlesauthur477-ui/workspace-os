import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";

export const notesRouter = Router();
notesRouter.use(requireAuth);

// Phase 3: backs the first "internal" Workspace app (componentKey "notes"),
// proving the AppDefinition -> AppInstance -> WorkspaceShell -> componentKey
// -> React component chain end-to-end. One note per user for now — no
// sharing, no collaboration, strictly owner-scoped via the existing
// requireAuth middleware (same pattern as every other authed route).
notesRouter.get("/", async (req: AuthedRequest, res) => {
  const note = await prisma.note.findFirst({ where: { userId: req.auth!.userId } });
  res.json({ content: note?.content ?? "" });
});

const putNoteSchema = z.object({ content: z.string().max(50_000) });

notesRouter.put("/", async (req: AuthedRequest, res) => {
  const { content } = putNoteSchema.parse(req.body);
  const existing = await prisma.note.findFirst({ where: { userId: req.auth!.userId } });
  const note = existing
    ? await prisma.note.update({ where: { id: existing.id }, data: { content } })
    : await prisma.note.create({ data: { userId: req.auth!.userId, content } });
  res.json({ content: note.content });
});
