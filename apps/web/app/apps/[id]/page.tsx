"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft, Monitor, Terminal, LayoutGrid } from "lucide-react";

// Phase 2 placeholder content for the three openModes that don't have a
// real workspace built yet. Deliberately not a fake loading spinner or
// blank page — clearly tells the user this is a future feature, per Phase
// 2's requirement for "a clearly marked placeholder". No network calls,
// no Guacamole, no SSH — this is pure static UI.
const PLACEHOLDER_COPY: Record<string, { icon: typeof Monitor; title: string; body: string }> = {
  internal: {
    icon: LayoutGrid,
    title: "Coming soon",
    body: "This app will open inside the Workspace OS shell once it's built. For now there's nothing to launch here yet.",
  },
  rdp: {
    icon: Monitor,
    title: "Browser-based RDP coming soon",
    body: "This app will open a remote desktop session in-browser once the RDP workspace is built. In the meantime, use Remote Servers to download a .rdp file for this connection.",
  },
  terminal: {
    icon: Terminal,
    title: "Terminal coming soon",
    body: "This app will open an in-browser terminal session once the terminal workspace is built. No SSH session is available yet.",
  },
};

// The embedded-app panel. Whether an app embeds cleanly is a per-app
// decision made by whoever configured it (openMode: "embedded" is only set
// for sites confirmed to allow framing) — this page doesn't try to guess.
// It still gives a visible "open in new tab" escape hatch and a load-timeout
// nudge, since even an allowed site can be slow or briefly misconfigured.
//
// Phase 2 also reuses this page (rather than a new WorkspaceShell) as the
// navigation target for openMode: internal/rdp/terminal, driven by a
// `mode` query param — see AppTile.tsx. When `mode` is one of those three,
// it renders a static placeholder instead of trying to load `url`.
export default function EmbeddedAppPanel() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "App";
  const url = searchParams.get("url");
  const mode = searchParams.get("mode");
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const placeholder = mode ? PLACEHOLDER_COPY[mode] : undefined;
  if (placeholder) {
    const PlaceholderIcon = placeholder.icon;
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center text-gray-400">
        <PlaceholderIcon className="h-10 w-10 text-gray-500" />
        <div>
          <p className="text-lg font-medium text-gray-200">{name}</p>
          <p className="mt-1 text-sm font-medium text-gray-300">{placeholder.title}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">{placeholder.body}</p>
        </div>
        <button onClick={() => router.back()} className="text-accent hover:underline">
          Go back
        </button>
      </main>
    );
  }

  if (!url) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-gray-400">
        <p>No launch URL configured for this app yet.</p>
        <button onClick={() => router.back()} className="text-accent hover:underline">
          Go back
        </button>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="glass flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-200">{name}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      {slow && !loaded ? (
        <div className="glass mx-4 mt-2 flex items-center justify-between rounded-lg px-4 py-2 text-xs text-amber-300">
          <span>This is taking a while — some sites block embedding entirely.</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Open in new tab instead
          </a>
        </div>
      ) : null}

      <iframe
        key={params.id}
        src={url}
        onLoad={() => setLoaded(true)}
        className="flex-1 border-0"
        title={name}
        allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
