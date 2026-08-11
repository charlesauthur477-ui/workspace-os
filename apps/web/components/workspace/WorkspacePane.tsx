"use client";

// Renders the active workspace tab's content, dispatched purely on
// openMode. new_tab / desktop_launch / custom never create tabs (AppTile
// still handles those exactly as before), so this only ever has to handle
// embedded / internal / rdp / terminal.

import { useEffect, useState, ComponentType } from "react";
import { ExternalLink, Monitor, Terminal as TerminalIcon, Puzzle as PuzzleIcon } from "lucide-react";
import * as Icons from "lucide-react";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";
import { internalApps } from "@/lib/internalApps";

export function WorkspacePane() {
  const { tabs, activeKey } = useWorkspace();
  const tab = tabs.find((t) => t.key === activeKey);

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        This tab is no longer open.
      </div>
    );
  }

  switch (tab.openMode) {
    case "embedded":
      return <EmbeddedPane url={tab.launchUrl} title={tab.title} />;
    case "internal":
      return <InternalPane componentKey={tab.componentKey} />;
    case "rdp":
      return (
        <PlaceholderPane
          icon={Monitor}
          title="Browser-based RDP coming in Phase 4"
          body="This app will open a remote desktop session in-browser once the RDP workspace is built. In the meantime, use Remote Servers to download a .rdp file for this connection."
        />
      );
    case "terminal":
      return (
        <PlaceholderPane
          icon={TerminalIcon}
          title="Terminal coming in Phase 5"
          body="This app will open an in-browser terminal session once the terminal workspace is built. No SSH session is available yet."
        />
      );
    default:
      return null;
  }
}

function EmbeddedPane({ url, title }: { url?: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [url]);

  // Loading state: no url configured yet for this instance.
  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
        <p>No launch URL configured for this app yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {slow && !loaded ? (
        // Iframe-blocked / slow-load state — mirrors the pre-Phase-3 panel:
        // never bypasses CSP/X-Frame-Options, just offers the safe fallback.
        <div className="glass mx-4 mt-2 flex items-center justify-between rounded-lg px-4 py-2 text-xs text-amber-300">
          <span>This is taking a while — some sites block embedding entirely.</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Open in new tab instead
          </a>
        </div>
      ) : null}
      <div className="flex items-center justify-end px-4 py-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <iframe
        key={url}
        src={url}
        onLoad={() => setLoaded(true)}
        className="flex-1 border-0"
        title={title}
        allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}

function InternalPane({ componentKey }: { componentKey?: string }) {
  // "Internal component missing" state: no componentKey came through at all.
  if (!componentKey) {
    return (
      <PlaceholderPane
        icon={PuzzleIcon}
        title="Application unavailable"
        body="This app isn't configured correctly. Contact an admin."
      />
    );
  }

  const entry = internalApps[componentKey];

  // "Invalid componentKey" state: the key doesn't match anything in the
  // registry. Deliberately never attempts a dynamic import/eval based on
  // the string — an unrecognized key can only ever render this safe state.
  if (!entry) {
    return (
      <PlaceholderPane
        icon={PuzzleIcon}
        title="Application unavailable"
        body="This internal app isn't available in this build."
      />
    );
  }

  const Component: ComponentType = entry.component;
  return (
    <div className="h-full overflow-auto p-6">
      <Component />
    </div>
  );
}

function PlaceholderPane({
  icon: Icon,
  title,
  body,
}: {
  icon: Icons.LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-gray-400">
      <Icon className="h-10 w-10 text-gray-500" />
      <div>
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{body}</p>
      </div>
    </div>
  );
}
