"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CategoryDto } from "@/lib/types";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { DashboardHome } from "@/components/workspace/DashboardHome";

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

  // Phase 3: the dashboard grid itself (DashboardHome) is byte-for-byte the
  // same rendering logic as before Phase 3 — it's just now the "Home" tab
  // content inside WorkspaceShell instead of the whole page. Loading/error
  // states render outside the shell, same as before, since there's nothing
  // to show tabs for yet.
  if (error) return <main className="p-8 text-red-400">{error}</main>;
  if (!categories) return <main className="p-8 text-gray-400">Loading your workspace…</main>;

  return (
    <WorkspaceShell>
      <DashboardHome categories={categories} />
    </WorkspaceShell>
  );
}
