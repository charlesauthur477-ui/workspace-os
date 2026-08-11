// Shared types used by both apps/web and apps/api.
// Keep this package framework-agnostic (no React, no Express types here).

// "internal", "rdp", and "terminal" are Phase 2 additions: the dispatch
// logic and DB enum values exist now, but they route to placeholder UI
// only — no WorkspaceShell, no Guacamole, no SSH execution yet (those are
// later phases, each requiring separate approval).
export type OpenMode = "embedded" | "new_tab" | "desktop_launch" | "internal" | "rdp" | "terminal" | "custom";

export type UserStatus = "pending" | "active" | "disabled";

export type SystemRole = "owner" | "admin" | "user";

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface Permission {
  id: string;
  key: string; // e.g. "app.view", "rdp.connect", "user.manage"
  description: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface AppDefinition {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  icon: string;
  description: string;
  openMode: OpenMode;
  configSchema: Record<string, unknown>;
  capabilities: string[];
  pluginSource: string | null;
  isActive: boolean;
}

export interface AppInstance {
  id: string;
  appDefinitionId: string;
  ownerUserId: string | null; // null = shared/workspace-level
  displayName: string;
  config: Record<string, unknown>;
  credentialRef: string | null;
  visibilityScope: "private" | "role" | "workspace";
  status: "active" | "disabled";
  healthStatus: "unknown" | "healthy" | "unhealthy";
}

export interface RdpConnection {
  id: string;
  ownerUserId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  credentialRef: string;
  groupName: string | null;
  notes: string | null;
}

export interface InternalServer {
  id: string;
  name: string;
  baseUrl: string;
  healthCheckUrl: string | null;
  description: string | null;
  ownerUserId: string;
  groupName: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roleId: string;
  roleName: SystemRole | string;
  status: UserStatus;
}

// Well-known permission keys, referenced across frontend + backend
export const PERMISSIONS = {
  APP_VIEW: "app.view",
  APP_MANAGE: "app.manage",
  RDP_CONNECT: "rdp.connect",
  RDP_MANAGE: "rdp.manage",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  AUDIT_VIEW: "audit.view",
} as const;
