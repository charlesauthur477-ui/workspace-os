// The "Home" tab content inside WorkspaceShell — identical rendering logic
// to the pre-Phase-3 dashboard page, just extracted so it can be reused by
// both "/" and the "/workspace/[slug]" deep-link route (both mount their own
// WorkspaceShell and pass this as `children`).

import { CategorySection } from "@/components/dashboard/CategorySection";
import { SystemUsage } from "@/components/dashboard/SystemUsage";
import { AppTileData } from "@/components/dashboard/AppTile";
import { RemoteServersSection } from "@/components/RemoteServers/RemoteServersSection";
import { SshConnectionsSection } from "@/components/Terminal/SshConnectionsSection";
import { CategoryDto } from "@/lib/types";

export function DashboardHome({ categories }: { categories: CategoryDto[] }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome Back</h1>
          <p className="text-sm text-gray-400">Everything you use, in one place.</p>
        </div>
        <SystemUsage />
      </div>
      {categories.map((cat) => {
        if (cat.name === "Remote Servers") {
          return <RemoteServersSection key={cat.id} />;
        }
        if (cat.name === "Terminal") {
          return <SshConnectionsSection key={cat.id} />;
        }
        const apps: AppTileData[] = cat.appDefinitions.flatMap((def) =>
          def.instances.length > 0
            ? def.instances.map((inst) => ({
                id: def.id,
                instanceId: inst.id,
                name: inst.displayName || def.name,
                icon: def.icon,
                openMode: def.openMode,
                launchUrl: (inst.config as { url?: string })?.url,
                componentKey: def.workspaceRoute?.componentKey ?? undefined,
              }))
            : []
        );
        return <CategorySection key={cat.id} title={cat.name} apps={apps} />;
      })}
    </main>
  );
}
