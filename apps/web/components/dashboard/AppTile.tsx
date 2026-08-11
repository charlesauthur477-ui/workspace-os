"use client";

import { useCallback } from "react";
import * as Icons from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";

export interface AppTileData {
  id: string;
  name: string;
  icon: string;
  openMode: "embedded" | "new_tab" | "desktop_launch" | "internal" | "rdp" | "terminal" | "custom";
  launchUrl?: string;
  instanceId?: string; // present once the user has configured this app
  componentKey?: string; // Phase 3 — only meaningful when openMode is "internal"
}

// The core tile component: it doesn't know *what* the app is, only how to
// resolve its openMode into an action, driven entirely by the metadata on
// `app`. Phase 3 changes where embedded/internal/rdp/terminal apps open
// (into the WorkspaceShell as a tab, instead of a full-page navigation) but
// still never hard-codes a single app name — new apps never require a new
// tile component or an AppTile code change.
export function AppTile({ app }: { app: AppTileData }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[app.icon] ?? Icons.AppWindow;
  const { openTab } = useWorkspace();

  const launch = useCallback(async () => {
    switch (app.openMode) {
      case "new_tab":
        // Unchanged: existing external-browser behavior.
        if (app.launchUrl) window.open(app.launchUrl, "_blank", "noopener,noreferrer");
        break;
      case "embedded":
        // Phase 3: opens inside the Workspace OS shell as a tab instead of a
        // full-page navigation, so the dashboard stays open behind it.
        openTab({
          key: app.instanceId ?? app.id,
          title: app.name,
          icon: app.icon,
          openMode: "embedded",
          launchUrl: app.launchUrl,
        });
        break;
      case "desktop_launch": {
        // Unchanged: mint a one-time token, hand off to the local Workspace
        // OS Connector via its custom protocol handler.
        const res = await apiFetch<{ protocolUrl: string }>(
          `/rdp/${app.instanceId}/connect-token`,
          { method: "POST" }
        );
        window.location.href = res.protocolUrl;
        break;
      }
      case "custom":
        // Unchanged: full-page navigation to the generic app panel.
        window.location.href = `/apps/${app.instanceId ?? app.id}`;
        break;
      case "internal":
        // Phase 3: opens the registered internal React component inside the
        // shell, keyed by the opaque componentKey resolved server-side from
        // WorkspaceAppRoute — never a raw path/import driven by the DB.
        openTab({
          key: app.instanceId ?? app.id,
          title: app.name,
          icon: app.icon,
          openMode: "internal",
          componentKey: app.componentKey,
        });
        break;
      case "rdp":
        // Phase 3: still just a clearly-marked placeholder tab — does NOT
        // connect to Guacamole. Actual browser-based RDP is a later phase.
        openTab({ key: app.instanceId ?? app.id, title: app.name, icon: app.icon, openMode: "rdp" });
        break;
      case "terminal":
        // Phase 3: still just a clearly-marked placeholder tab — does NOT
        // open an SSH session or execute anything. Later phase.
        openTab({ key: app.instanceId ?? app.id, title: app.name, icon: app.icon, openMode: "terminal" });
        break;
    }
  }, [app, openTab]);

  return (
    <button
      onClick={launch}
      className="glass group flex flex-col items-center gap-2 rounded-xl p-4 text-center transition hover:border-accent/50 hover:bg-white/[0.07]"
    >
      <Icon className="h-6 w-6 text-gray-300 group-hover:text-white" />
      <span className="text-xs font-medium text-gray-300 group-hover:text-white">{app.name}</span>
    </button>
  );
}
