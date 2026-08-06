"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { RdpConnectionDto } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // When set, the modal edits this connection (PUT) instead of creating a
  // new one (POST). Password is optional on edit — leave blank to keep the
  // one already stored (the API never sends the existing password back to
  // the browser, so there's nothing to prefill it with).
  editingRdp?: RdpConnectionDto | null;
}

export function AddRdpModal({ open, onClose, onSaved, editingRdp }: Props) {
  const isEdit = !!editingRdp;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3389");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingRdp) {
      setName(editingRdp.name === editingRdp.host ? "" : editingRdp.name);
      setHost(editingRdp.host);
      setPort(String(editingRdp.port));
      setUsername(editingRdp.username);
      setPassword("");
      setGroupName(editingRdp.groupName ?? "");
      setNotes(editingRdp.notes ?? "");
    } else {
      setName("");
      setHost("");
      setPort("3389");
      setUsername("");
      setPassword("");
      setGroupName("");
      setNotes("");
    }
    setError(null);
  }, [open, editingRdp]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name || host,
        host,
        port: Number(port) || 3389,
        username,
        groupName: groupName || undefined,
        notes: notes || undefined,
      };
      if (!isEdit || password) body.password = password;

      await apiFetch(isEdit ? `/rdp/${editingRdp!.id}` : "/rdp", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save RDP");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">{isEdit ? "Edit RDP" : "Add RDP"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Office PC" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Host / IP" value={host} onChange={setHost} placeholder="192.168.1.10" required />
            </div>
            <Field label="Port" value={port} onChange={setPort} placeholder="3389" />
          </div>
          <Field label="Username" value={username} onChange={setUsername} placeholder="administrator" required />
          <Field
            label={isEdit ? "Password (leave blank to keep current)" : "Password"}
            value={password}
            onChange={setPassword}
            type="password"
            required={!isEdit}
          />
          <Field label="Group (optional)" value={groupName} onChange={setGroupName} placeholder="e.g. Client Work" />
          <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="" />

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !host || !username || (!isEdit && !password)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add RDP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-400">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent/60"
      />
    </label>
  );
}
