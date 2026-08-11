"use client";

import { useCallback } from "react";
import * as Icons from "lucide-react";
import { apiFetch } from "@/lib/api";

export interface AppTileData {
  id: string;
  name: string;
  icon: string;
  openMode: "embedded" | "new_tab" | "desktop_launch" | "internal" | "rdp" | "terminal" | "custom";
  launchUrl?: string;
  instanceId?: string; // present once the user has configured this app
}

// The core tile component: it doesn't know *what* the app is, only how to
// resolve its openMode into an action. This is the piece that makes the
// plugin system real — new apps never require a new tile component.
export function AppTile({ app }: { app: AppTileData }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[app.icon] ?? Icons.AppWindow;

  const launch = useCallback(async () => {
    switch (app.openMode) {
      case "new_tab":
        if (app.launchUrl) window.open(app.launchUrl, "_blank", "noopener,noreferrer");
        break;
      case "embedded": {
        // Panel route renders the app in an iframe with a "open in new tab"
        // escape hatch — pass along what it needs via query string so the
        // panel doesn't need its own API round-trip just to render.
        const params = new URLSearchParams({ name: app.name, ...(app.launchUrl ? { url: app.launchUrl } : {}) });
        window.location.href = `/apps/${app.instanceId ?? app.id}?${params.toString()}`;
        break;
      }
      case "desktop_launch": {
        // RDP / desktop apps: mint a one-time token, hand off to the local
        // Workspace OS Connector via its custom protocol handler.
        const res = await apiFetch<{ protocolUrl: string }>(
          `/rdp/${app.instanceId}/connect-token`,
          { method: "POST" }
        );
        window.location.href = res.protocolUrl;
        break;
      }
      case "custom":
        window.location.href = `/apps/${app.instanceId ?? app.id}`;
        break;
      case "internal": {
        // Phase 2: no WorkspaceShell yet — route to the generic app panel
        // in a clearly-marked "coming soon" state. Phase 3 will replace
        // this with an in-shell native view instead of a full navigation.
        const params = new URLSearchParams({ name: app.name, mode: "internal" });
        window.location.href = `/apps/${app.instanceId ?? app.id}?${params.toString()}`;
        break;
      }
      case "rdp": {
        // Phase 2 placeholder only — does NOT connect to Guacamole. Actual
        // browser-based RDP gateway is a separate, later phase requiring
        // its own approval. Existing Remote Servers (.rdp download) cards
        // are untouched and do not go through this openMode path.
        const params = new URLSearchParams({ name: app.name, mode: "rdp" });
        window.location.href = `/apps/${app.instanceId ?? app.id}?${params.toString()}`;
        break;
      }
      case "terminal": {
        // Phase 2 placeholder only — does NOT open an SSH session or
        // execute any command. Terminal/SSH bridge is a later phase.
        const params = new URLSearchParams({ name: app.name, mode: "terminal" });
        window.location.href = `/apps/${app.instanceId ?? app.id}?${params.toString()}`;
        break;
      }
    }
  }, [app]);

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
