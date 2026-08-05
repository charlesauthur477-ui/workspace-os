export interface AppDefinitionDto {
  id: string;
  slug: string;
  name: string;
  icon: string;
  openMode: "embedded" | "new_tab" | "desktop_launch" | "custom";
  instances: { id: string; displayName: string; config: Record<string, unknown> }[];
}

export interface CategoryDto {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  appDefinitions: AppDefinitionDto[];
}
