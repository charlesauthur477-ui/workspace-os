export interface AppDefinitionDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  openMode: "embedded" | "new_tab" | "desktop_launch" | "internal" | "rdp" | "terminal" | "custom";
  instances: { id: string; displayName: string; config: Record<string, unknown> }[];
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
