"use client";

import { useCallback } from "react";
import * as Icons from "lucide-react";
import { apiFetch } from "@/lib/api";

export interface AppTileData {
  id: string;
  name: string;
  icon: string;
  openMode: "embedded" | "new_tab" | "desktop_launch" | "custom";
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
      case "embedded":
        // Handled by the parent dashboard mounting an <iframe> panel; here we
        // just signal intent by navigating to a panel route.
        window.location.href = `/apps/${app.instanceId ?? app.id}`;
        break;
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
