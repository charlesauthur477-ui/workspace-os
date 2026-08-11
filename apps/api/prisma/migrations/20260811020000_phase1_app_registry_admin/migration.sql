-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OpenMode" ADD VALUE 'internal';
ALTER TYPE "OpenMode" ADD VALUE 'rdp';
ALTER TYPE "OpenMode" ADD VALUE 'terminal';

-- AlterTable
ALTER TABLE "app_definitions" ADD COLUMN     "launchCommand" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rdp_connections" ADD COLUMN     "guacamoleConnectionId" TEXT;

-- CreateTable
CREATE TABLE "workspace_app_routes" (
    "id" TEXT NOT NULL,
    "appDefinitionId" TEXT NOT NULL,
    "routeSlug" TEXT NOT NULL,
    "componentKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_app_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssh_connections" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "credentialId" TEXT,
    "authMethod" TEXT NOT NULL DEFAULT 'password',
    "groupName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ssh_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_app_routes_appDefinitionId_key" ON "workspace_app_routes"("appDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_app_routes_routeSlug_key" ON "workspace_app_routes"("routeSlug");

-- AddForeignKey
ALTER TABLE "workspace_app_routes" ADD CONSTRAINT "workspace_app_routes_appDefinitionId_fkey" FOREIGN KEY ("appDefinitionId") REFERENCES "app_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_connections" ADD CONSTRAINT "ssh_connections_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

