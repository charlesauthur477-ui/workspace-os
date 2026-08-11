"use client";

// Deep-link entry point for an internal app, e.g. /workspace/notes. This is
// NOT a generic route that imports arbitrary files based on a database
// string — it resolves `slug` against the same permission-filtered
// /apps/dashboard payload the dashboard itself uses, finds the matching
// AppDefinition's componentKey (if any, and if the user is authorized to
// see it), and hands that opaque key to WorkspacePane, which looks it up in
// the fixed lib/internalApps.ts registry. Knowing a slug is not enough to
// render anything: if the definition isn't in the user's own authorized
// dashboard payload, this shows the same "not available" state a stranger
// would see.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CategoryDto } from "@/lib/types";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DashboardHome } from "@/components/workspace/DashboardHome";
import { WorkspaceTab } from "@/lib/workspace/WorkspaceContext";

export default function WorkspaceSlugPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);

  useEffect(() => {
    apiFetch<CategoryDto[]>("/apps/dashboard")
      .then(setCategories)
      .catch(() => router.replace("/login"));
  }, [router]);

  const resolvedTab: WorkspaceTab | undefined = useMemo(() => {
    if (!categories) return undefined;
    for (const cat of categories) {
      for (const def of cat.appDefinitions) {
        if (def.openMode !== "internal") continue;
        if (def.workspaceRoute?.routeSlug !== params.slug) continue;
        // instances[] here already only contains instances this user is
        // authorized to see (owned, or workspace-shared) — same filter the
        // dashboard grid uses. No instance = not authorized = not found.
        const inst = def.instances[0];
        if (!inst) return undefined;
        return {
          key: inst.id,
          title: inst.displayName || def.name,
          icon: def.icon,
          openMode: "internal",
          componentKey: def.workspaceRoute?.componentKey,
        };
      }
    }
    return undefined;
  }, [categories, params.slug]);

  if (!categories) {
    return <main className="p-8 text-gray-400">Loading your workspace…</main>;
  }

  if (!resolvedTab) {
    return (
      <WorkspaceShell>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-gray-400">
          <p>This app isn&apos;t available, or you don&apos;t have access to it.</p>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell initialTab={resolvedTab}>
      <DashboardHome categories={categories} />
    </WorkspaceShell>
  );
}
