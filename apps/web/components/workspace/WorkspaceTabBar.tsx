"use client";

import * as Icons from "lucide-react";
import { X, Home } from "lucide-react";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";

// Always-present "Home" entry plus one entry per open app tab. Clicking a
// tab switches WorkspacePane's content; the close button removes it. Tabs
// are in-memory only (WorkspaceContext), so this bar resets on refresh.
export function WorkspaceTabBar() {
  const { tabs, activeKey, activateTab, closeTab, goHome } = useWorkspace();

  return (
    <div className="glass flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
      <button
        onClick={goHome}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          activeKey === "home"
            ? "bg-accent/20 text-white"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Home className="h-3.5 w-3.5" />
        Home
      </button>

      {tabs.map((tab) => {
        const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[tab.icon] ?? Icons.AppWindow;
        const active = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            className={`group flex flex-shrink-0 items-center gap-1 rounded-md pl-3 pr-1 py-1.5 text-xs font-medium transition ${
              active ? "bg-accent/20 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <button onClick={() => activateTab(tab.key)} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="max-w-[10rem] truncate">{tab.title}</span>
            </button>
            <button
              onClick={() => closeTab(tab.key)}
              aria-label={`Close ${tab.title}`}
              className="rounded p-1 opacity-0 transition hover:bg-white/10 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
