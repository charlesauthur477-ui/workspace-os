"use client";

// Phase 3: client-side workspace state. Plain React Context — no state
// library, no backend persistence. Tabs live only in memory for the
// lifetime of the page; a refresh intentionally resets to the Home view,
// per the Phase 3 spec ("Do NOT persist tabs to the database yet").

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

export interface WorkspaceTab {
  // Stable identity for a tab — the AppInstance id when one exists (it
  // always should, since only configured instances reach AppTile), falling
  // back to the AppDefinition id. Used both to activate the right tab and
  // to dedupe: clicking the same app twice re-activates instead of opening
  // a second tab.
  key: string;
  title: string;
  icon: string;
  openMode: "embedded" | "internal" | "rdp" | "terminal";
  launchUrl?: string; // embedded only
  componentKey?: string; // internal only — looked up in lib/internalApps.ts
  rdpConnectionId?: string; // rdp only — the RdpConnection id, used to start a Guacamole session
}

interface WorkspaceContextValue {
  tabs: WorkspaceTab[];
  activeKey: string; // "home" or a WorkspaceTab.key
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (key: string) => void;
  activateTab: (key: string) => void;
  goHome: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  initialTab,
}: {
  children: ReactNode;
  initialTab?: WorkspaceTab;
}) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initialTab ? [initialTab] : []);
  const [activeKey, setActiveKey] = useState<string>(initialTab ? initialTab.key : "home");

  const openTab = useCallback((tab: WorkspaceTab) => {
    setTabs((prev) => (prev.some((t) => t.key === tab.key) ? prev : [...prev, tab]));
    setActiveKey(tab.key);
  }, []);

  const closeTab = useCallback(
    (key: string) => {
      const idx = tabs.findIndex((t) => t.key === key);
      const remaining = tabs.filter((t) => t.key !== key);
      setTabs(remaining);
      setActiveKey((current) => {
        if (current !== key) return current;
        const fallback = remaining[idx - 1] ?? remaining[0];
        return fallback ? fallback.key : "home";
      });
    },
    [tabs]
  );

  const activateTab = useCallback((key: string) => setActiveKey(key), []);
  const goHome = useCallback(() => setActiveKey("home"), []);

  const value = useMemo(
    () => ({ tabs, activeKey, openTab, closeTab, activateTab, goHome }),
    [tabs, activeKey, openTab, closeTab, activateTab, goHome]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return ctx;
}
