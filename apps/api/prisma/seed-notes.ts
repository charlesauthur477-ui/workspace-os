import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Phase 3: seeds the first "internal" Workspace app — Notes — so the
// AppDefinition -> WorkspaceAppRoute -> AppInstance -> WorkspaceShell chain
// is actually exercisable on the live dashboard. Safe to re-run (upsert by
// slug / unique routeSlug).

async function main() {
  let category = await prisma.category.findUnique({ where: { name: "Workspace" } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Workspace", icon: "LayoutGrid", sortOrder: 0 },
    });
    console.log(`✔ Created category "Workspace"`);
  }

  const def = await prisma.appDefinition.upsert({
    where: { slug: "notes" },
    update: {
      name: "Notes",
      categoryId: category.id,
      icon: "StickyNote",
      description: "Quick notes, saved to your account.",
      openMode: "internal",
      isActive: true,
    },
    create: {
      slug: "notes",
      name: "Notes",
      categoryId: category.id,
      icon: "StickyNote",
      description: "Quick notes, saved to your account.",
      openMode: "internal",
    },
  });
  console.log(`✔ AppDefinition "notes" -> ${def.id}`);

  await prisma.workspaceAppRoute.upsert({
    where: { appDefinitionId: def.id },
    update: { routeSlug: "notes", componentKey: "notes" },
    create: { appDefinitionId: def.id, routeSlug: "notes", componentKey: "notes" },
  });
  console.log(`✔ WorkspaceAppRoute routeSlug "notes" -> componentKey "notes"`);

  const existingInstance = await prisma.appInstance.findFirst({
    where: { appDefinitionId: def.id, ownerUserId: null, visibilityScope: "workspace" },
  });

  if (existingInstance) {
    await prisma.appInstance.update({
      where: { id: existingInstance.id },
      data: { displayName: "Notes", status: "active" },
    });
    console.log(`✔ AppInstance already existed -> updated`);
  } else {
    await prisma.appInstance.create({
      data: {
        appDefinitionId: def.id,
        ownerUserId: null,
        displayName: "Notes",
        config: {},
        visibilityScope: "workspace",
        status: "active",
      },
    });
    console.log(`✔ AppInstance created (workspace-shared)`);
  }

  console.log("\nNotes app seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
