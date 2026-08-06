"use client";

import { useCallback, useState } from "react";
import { Monitor, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RdpConnectionDto } from "@/lib/types";

// One "Saved PC" tile — mirrors the card layout of the Windows App / Remote
// Desktop client: a gradient thumbnail up top, host:port + username below.
// Clicking it mints a one-time connect token and hands off to the local
// Workspace OS Connector via its custom protocol handler.
export function RdpCard({ rdp }: { rdp: RdpConnectionDto }) {
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await apiFetch<{ protocolUrl: string }>(`/rdp/${rdp.id}/connect-token`, {
        method: "POST",
      });
      window.location.href = res.protocolUrl;
    } finally {
      setConnecting(false);
    }
  }, [rdp.id]);

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="glass group flex flex-col overflow-hidden rounded-xl text-left transition hover:border-accent/50 hover:bg-white/[0.07] disabled:opacity-60"
    >
      <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-indigo-500/40 via-fuchsia-500/30 to-sky-500/40">
        {connecting ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <Monitor className="h-8 w-8 text-white/80" />
        )}
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
  );
}
