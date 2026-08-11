"use client";

import { useCallback, useState } from "react";
import { Monitor, Pencil, Trash2, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RdpConnectionDto } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";

// One "Saved PC" tile — mirrors the card layout of the Windows App / Remote
// Desktop client: a gradient thumbnail up top, host:port + username below.
//
// Phase 4: the primary click now opens a browser-based RDP session inside
// the Workspace OS (WorkspaceShell -> WorkspacePane -> RdpPane), the same
// way any other app tab opens — the user never leaves the dashboard and no
// external Remote Desktop app is launched. The old "download .rdp" flow
// (host/port/username pre-filled, Windows still prompts for the password —
// we never ship plaintext passwords into a downloadable file) is kept as an
// explicit secondary action for anyone who still wants a native client.
export function RdpCard({
  rdp,
  onEdit,
  onDeleted,
}: {
  rdp: RdpConnectionDto;
  onEdit: (rdp: RdpConnectionDto) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { openTab } = useWorkspace();

  const openRemoteDesktop = useCallback(() => {
    openTab({
      key: `rdp-${rdp.id}`,
      title: rdp.name || rdp.host,
      icon: "Monitor",
      openMode: "rdp",
      rdpConnectionId: rdp.id,
    });
  }, [rdp, openTab]);

  const download = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const lines = [
      `full address:s:${rdp.host}:${rdp.port}`,
      `username:s:${rdp.username}`,
      "prompt for credentials:i:1",
      "authentication level:i:2",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "application/x-rdp" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(rdp.name || rdp.host).replace(/[^a-z0-9-_]+/gi, "_")}.rdp`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [rdp]);

  const remove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Remove "${rdp.name || rdp.host}"? This can't be undone.`)) return;
      setDeleting(true);
      try {
        await apiFetch(`/rdp/${rdp.id}`, { method: "DELETE" });
        onDeleted();
      } finally {
        setDeleting(false);
      }
    },
    [rdp, onDeleted],
  );

  const edit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(rdp);
    },
    [rdp, onEdit],
  );

  return (
    <div className="glass group relative flex flex-col overflow-hidden rounded-xl text-left transition hover:border-accent/50 hover:bg-white/[0.07]">
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={download}
          title="Download .rdp file (Windows will prompt for the password)"
          className="rounded-md bg-black/50 p-1.5 text-white/80 hover:bg-black/70 hover:text-white"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={edit}
          title="Edit"
          className="rounded-md bg-black/50 p-1.5 text-white/80 hover:bg-black/70 hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={remove}
          disabled={deleting}
          title="Remove"
          className="rounded-md bg-black/50 p-1.5 text-white/80 hover:bg-red-500/70 hover:text-white disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        onClick={openRemoteDesktop}
        className="flex flex-col text-left"
        title={`Open ${rdp.name || rdp.host} — browser-based remote desktop`}
      >
        <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-indigo-500/40 via-fuchsia-500/30 to-sky-500/40">
          <Monitor className="h-8 w-8 text-white/80" />
        </div>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-gray-100">
            {rdp.host}
            {rdp.port !== 3389 ? `:${rdp.port}` : ""}
          </p>
          <p className="truncate text-xs text-gray-400">{rdp.username}</p>
          {rdp.name && rdp.name !== rdp.host ? (
            <p className="truncate text-[11px] text-gray-500">{rdp.name}</p>
          ) : null}
        </div>
      </button>
    </div>
  );
}
