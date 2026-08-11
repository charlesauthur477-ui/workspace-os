import { ComponentType } from "react";
import { NotesApp } from "@/components/workspace/internal-apps/NotesApp";

export interface InternalAppEntry {
  component: ComponentType;
  title: string;
}

// SECURITY (Phase 3): the database (WorkspaceAppRoute.componentKey) only
// ever stores an opaque string — never a component path, import specifier,
// or executable code. This map is the ONLY place a componentKey is turned
// into an actual React component. WorkspacePane looks up keys here and
// falls back to a safe "unavailable" state for anything unrecognized; it
// never attempts a dynamic import or eval based on a database value. This
// is what keeps the database from becoming an arbitrary-code-execution path.
export const internalApps: Record<string, InternalAppEntry> = {
  notes: { component: NotesApp, title: "Notes" },
};
