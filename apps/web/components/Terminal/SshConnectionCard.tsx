"use client";

import { useCallback, useState } from "react";
import { Terminal as TerminalIcon, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SshConnectionDto } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/WorkspaceContext";

// One "Saved Server" tile for the Terminal section — mirrors RdpCard.tsx's
// layout. The primary click opens a browser-based SSH terminal inside the
// Workspace OS (WorkspaceShell -> WorkspacePane -> TerminalPane), the same
// way any other app tab opens. There is no "download" secondary action here
// (unlike RDP's .rdp file) — an SSH connection has no equivalent artifact
// that's safe to hand to the browser.
export function SshConnectionCard({
  ssh,
  onEdit,
  onDeleted,
}: {
  ssh: SshConnectionDto;
  onEdit: (ssh: SshConnectionDto) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { openTab } = useWorkspace();

  const openTerminal = useCallback(() => {
    if (!ssh.enabled) return;
    openTab({
      key: `ssh-${ssh.id}`,
      title: ssh.name || ssh.host,
      icon: "Terminal",
      openMode: "terminal",
      sshConnectionId: ssh.id,
    });
  }, [ssh, openTab]);

  const remove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Remove "${ssh.name || ssh.host}"? This can't be undone.`)) return;
      setDeleting(true);
      try {
        await apiFetch(`/terminal/${ssh.id}`, { method: "DELETE" });
        onDeleted();
      } finally {
        setDeleting(false);
      }
    },
    [ssh, onDeleted],
  );

  const edit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(ssh);
    },
    [ssh, onEdit],
  );

  return (
    <div className="glass group relative flex flex-col overflow-hidden rounded-xl text-left transition hover:border-accent/50 hover:bg-white/[0.07]">
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
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
        onClick={openTerminal}
        disabled={!ssh.enabled}
        className="flex flex-col text-left disabled:cursor-not-allowed"
        title={ssh.enabled ? `Open ${ssh.name || ssh.host} — browser-based terminal` : "This connection is disabled"}
      >
        <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-slate-700/60 via-slate-800/50 to-black/60">
          <TerminalIcon className="h-8 w-8 text-white/80" />
          {!ssh.enabled ? (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
              Disabled
            </span>
          ) : null}
        </div>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-gray-100">
            {ssh.host}
            {ssh.port !== 22 ? `:${ssh.port}` : ""}
          </p>
          <p className="truncate text-xs text-gray-400">{ssh.username}</p>
          {ssh.name && ssh.name !== ssh.host ? (
            <p className="truncate text-[11px] text-gray-500">{ssh.name}</p>
          ) : null}
        </div>
      </button>
    </div>
  );
}
