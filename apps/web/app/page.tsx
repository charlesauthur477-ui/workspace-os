"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CategorySection } from "@/components/dashboard/CategorySection";
import { SystemUsage } from "@/components/dashboard/SystemUsage";
import { AppTileData } from "@/components/dashboard/AppTile";
import { RemoteServersSection } from "@/components/RemoteServers/RemoteServersSection";
import { CategoryDto } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CategoryDto[]>("/apps/dashboard")
      .then(setCategories)
      .catch(() => {
        // No valid session in memory (e.g. hard refresh) — send back to login.
        router.replace("/login");
      });
  }, [router]);

  if (error) return <main className="p-8 text-red-400">{error}</main>;
  if (!categories) return <main className="p-8 text-gray-400">Loading your workspace…</main>;

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
        // Remote Servers is a dedicated RDP grid, not a generic app category
        // (RDP entries are private-per-user connection details, not App
        // Definitions) — render it in the same sort position instead.
        if (cat.name === "Remote Servers") {
          return <RemoteServersSection key={cat.id} />;
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
              }))
            : []
        );
        return <CategorySection key={cat.id} title={cat.name} apps={apps} />;
      })}
    </main>
  );
}
