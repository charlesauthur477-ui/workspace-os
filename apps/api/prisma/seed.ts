import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seeds the system roles, the base permission set, and the default
// dashboard categories from the proposal. Run once after first migrate.
async function main() {
  const permissions = [
    { key: "app.view", description: "View apps on the dashboard" },
    { key: "app.manage", description: "Create/edit/delete app definitions" },
    { key: "rdp.connect", description: "Connect to an RDP entry" },
    { key: "rdp.manage", description: "Create/edit/delete RDP entries" },
    { key: "ssh.connect", description: "Open a browser-based terminal session on an SSH entry" },
    { key: "ssh.manage", description: "Create/edit/delete SSH entries" },
    { key: "user.manage", description: "Approve, disable, and assign roles to users" },
    { key: "role.manage", description: "Manage roles and their permissions" },
    { key: "audit.view", description: "View the audit log" },
  ];
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { key: p.key }, update: {}, create: p });
  }

  const owner = await prisma.role.upsert({
    where: { name: "Owner" }, update: {}, create: { name: "Owner", isSystem: true },
  });
  const admin = await prisma.role.upsert({
    where: { name: "Admin" }, update: {}, create: { name: "Admin", isSystem: true },
  });
  const user = await prisma.role.upsert({
    where: { name: "User" }, update: {}, create: { name: "User", isSystem: true },
  });

  const allPerms = await prisma.permission.findMany();
  const grant = async (roleId: string, keys: string[]) => {
    for (const key of keys) {
      const perm = allPerms.find((p) => p.key === key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
  };
  await grant(owner.id, allPerms.map((p) => p.key));
  await grant(admin.id, [
    "app.view", "app.manage", "rdp.connect", "rdp.manage", "ssh.connect", "ssh.manage", "user.manage", "audit.view",
  ]);
  await grant(user.id, ["app.view", "rdp.connect", "ssh.connect"]);

  const categories = [
    { name: "AI Agent", icon: "bot", sortOrder: 1 },
    { name: "Communication", icon: "message-circle", sortOrder: 2 },
    { name: "Email", icon: "mail", sortOrder: 3 },
    { name: "Browser Profiles", icon: "chrome", sortOrder: 4 },
    { name: "Remote Servers", icon: "monitor", sortOrder: 5 },
    { name: "AI", icon: "sparkles", sortOrder: 6 },
    { name: "Numbers", icon: "phone", sortOrder: 7 },
    { name: "My Servers", icon: "server", sortOrder: 8 },
    { name: "Terminal", icon: "terminal", sortOrder: 9 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }

  console.log("Seed complete: roles, permissions, categories.");
}

main().finally(() => prisma.$disconnect());
