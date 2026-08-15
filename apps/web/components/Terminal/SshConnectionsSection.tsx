"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SshConnectionDto } from "@/lib/types";
import { SshConnectionCard } from "./SshConnectionCard";
import { AddSshModal } from "./AddSshModal";

// "Terminal" — the saved-SSH-connections grid, mirroring
// RemoteServersSection.tsx. Like RDP entries, SSH connections are always
// private per-user, so this section fetches its own data from /terminal
// instead of piggybacking on /apps/dashboard.
export function SshConnectionsSection() {
  const [connections, setConnections] = useState<SshConnectionDto[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSsh, setEditingSsh] = useState<SshConnectionDto | null>(null);

  const load = useCallback(() => {
    apiFetch<SshConnectionDto[]>("/terminal")
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingSsh(null);
    setModalOpen(true);
  };

  const openEdit = (ssh: SshConnectionDto) => {
    setEditingSsh(ssh);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSsh(null);
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Terminal</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {(connections ?? []).map((ssh) => (
          <SshConnectionCard key={ssh.id} ssh={ssh} onEdit={openEdit} onDeleted={load} />
        ))}

        <button
          onClick={openAdd}
          className="glass flex flex-col items-center justify-center gap-2 rounded-xl border-dashed p-4 text-center text-gray-400 transition hover:border-accent/50 hover:text-white"
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs font-medium">Add Terminal</span>
        </button>
      </div>

      <AddSshModal open={modalOpen} onClose={closeModal} onSaved={load} editingSsh={editingSsh} />
    </section>
  );
}
