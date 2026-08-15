-- Phase 5A: Web Terminal / SSH.
-- Additive only — the `ssh_connections` table itself already exists
-- (created by the Phase 1 app-registry migration). This adds the two
-- columns the terminal feature needs: `enabled` (checked on every terminal
-- session authorization so an owner can disable a saved connection without
-- deleting it) and `updatedAt` (maintained by Prisma Client on every write,
-- same pattern as `notes.updatedAt`).
ALTER TABLE "ssh_connections" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ssh_connections" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
