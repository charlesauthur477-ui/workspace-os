"use client";

// Phase 3: there was no existing Sidebar component in the codebase before
// this — the dashboard was a single flat page. This is the minimal rail the
// Phase 3 layout needs (a persistent way to tell where you are and get back
// to the dashboard), built to match the existing dark/glass visual language
// rather than introducing a new design.

import { LayoutGrid, Home } from "lucide-react";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";

export function Sidebar() {
  const { activeKey, goHome } = useWorkspace();

  return (
    <aside className="glass flex w-16 flex-shrink-0 flex-col items-center gap-2 border-r border-border py-4">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent">
        <LayoutGrid className="h-4 w-4" />
      </div>
      <button
        onClick={goHome}
        title="Dashboard"
        aria-label="Dashboard"
        className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
          activeKey === "home"
            ? "bg-accent/20 text-accent"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Home className="h-5 w-5" />
      </button>
    </aside>
  );
}
