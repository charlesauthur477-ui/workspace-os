import { AppTile, AppTileData } from "./AppTile";

export function CategorySection({ title, apps }: { title: string; apps: AppTileData[] }) {
  if (apps.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {apps.map((app) => (
          <AppTile key={app.id} app={app} />
        ))}
      </div>
    </section>
  );
}
