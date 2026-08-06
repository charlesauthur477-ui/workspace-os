"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RdpConnectionDto } from "@/lib/types";
import { RdpCard } from "./RdpCard";
import { AddRdpModal } from "./AddRdpModal";

// "Remote Servers" — your Saved PCs grid. Unlike the generic App System,
// RDP entries are always private per-user (never shared workspace-wide),
// so this section fetches its own data from /rdp instead of piggybacking
// on /apps/dashboard.
export function RemoteServersSection() {
  const [rdps, setRdps] = useState<RdpConnectionDto[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    apiFetch<RdpConnectionDto[]>("/rdp")
      .then(setRdps)
      .catch(() => setRdps([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Remote Servers
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(rdps ?? []).map((rdp) => (
          <RdpCard key={rdp.id} rdp={rdp} />
        ))}

        <button
          onClick={() => setModalOpen(true)}
          className="glass flex flex-col items-center justify-center gap-2 rounded-xl border-dashed p-4 text-center text-gray-400 transition hover:border-accent/50 hover:text-white"
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs font-medium">Add RDP</span>
        </button>
      </div>

      <AddRdpModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </section>
  );
}
