"use client";

// Phase 3: the persistent Workspace OS container. Wraps a page's Home
// content (the dashboard grid) plus the tab bar / sidebar / pane that let an
// application open without navigating away. Deliberately does not replace
// the existing dashboard UI — `children` (rendered when activeKey === "home")
// is exactly the same dashboard content as before.

import { ReactNode } from "react";
import { WorkspaceProvider, useWorkspace, WorkspaceTab } from "@/lib/workspace/WorkspaceContext";
import { Sidebar } from "./Sidebar";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { WorkspacePane } from "./WorkspacePane";

export function WorkspaceShell({
  children,
  initialTab,
}: {
  children: ReactNode;
  initialTab?: WorkspaceTab;
}) {
  return (
    <WorkspaceProvider initialTab={initialTab}>
      <ShellLayout>{children}</ShellLayout>
    </WorkspaceProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const { activeKey } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <WorkspaceTabBar />
        <div className="flex-1 overflow-auto">
          {activeKey === "home" ? children : <WorkspacePane />}
        </div>
      </div>
    </div>
  );
}
