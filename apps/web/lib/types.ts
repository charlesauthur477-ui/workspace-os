export type OpenMode = "embedded" | "new_tab" | "desktop_launch" | "internal" | "rdp" | "terminal" | "custom";

export interface AppDefinitionDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  openMode: OpenMode;
  instances: { id: string; displayName: string; config: Record<string, unknown> }[];
  // Phase 3: only present for openMode "internal" — resolved server-side from
  // the WorkspaceAppRoute table. componentKey is an opaque string; the
  // frontend's internalApps registry (lib/internalApps.ts) is the only place
  // it is ever mapped to a real React component.
  workspaceRoute?: { routeSlug: string; componentKey: string } | null;
}

export interface CategoryDto {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  appDefinitions: AppDefinitionDto[];
}

// Remote Servers (RDP) — deliberately its own type, not routed through the
// generic App Definition system: RDP entries are always private per-user,
// carry connection details instead of a launch URL, and get a dedicated
// "Saved PCs" style grid instead of a plain tile.
export interface RdpConnectionDto {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  groupName: string | null;
  notes: string | null;
  createdAt: string;
}

// Terminal (SSH) — mirrors RdpConnectionDto's reasoning: private per-user
// connection details, never routed through the generic App Definition
// system. `authMethod` drives which secret field AddSshModal shows; the
// browser never receives credentialId or any decrypted secret.
export interface SshConnectionDto {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "private_key";
  networkRoute: "public" | "tailscale";
  groupName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
