"use client";

// First "internal" Workspace app (Phase 3). Proves the full chain:
// AppDefinition -> AppInstance -> openMode "internal" -> WorkspaceShell ->
// componentKey "notes" -> lib/internalApps.ts -> this component. Backed by
// the existing (previously schema-only) Note model, scoped to the signed-in
// user via the existing requireAuth middleware — no new permission model.

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = "loading" | "ready" | "saving" | "error";

export function NotesApp() {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    apiFetch<{ content: string }>("/notes")
      .then((note) => {
        setContent(note.content);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const save = async () => {
    setStatus("saving");
    try {
      await apiFetch("/notes", { method: "PUT", body: JSON.stringify({ content }) });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  if (status === "loading") {
    return <p className="text-sm text-gray-500">Loading notes…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Notes</h2>
        <p className="text-sm text-gray-500">A private scratchpad, just for you.</p>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        className="glass w-full resize-none rounded-lg p-4 text-sm text-gray-200 outline-none focus:border-accent/50"
        placeholder="Jot something down…"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "error" ? (
          <span className="text-xs text-red-400">Couldn&apos;t save — try again.</span>
        ) : null}
      </div>
    </div>
  );
}
