"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SshConnectionDto } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // When set, the modal edits this connection (PUT) instead of creating a
  // new one (POST). The secret (password or private key) is optional on
  // edit — leave blank to keep the one already stored (the API never sends
  // a decrypted secret back to the browser, so there's nothing to prefill).
  editingSsh?: SshConnectionDto | null;
}

export function AddSshModal({ open, onClose, onSaved, editingSsh }: Props) {
  const isEdit = !!editingSsh;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "private_key">("password");
  const [networkRoute, setNetworkRoute] = useState<"public" | "tailscale">("public");
  const [secret, setSecret] = useState("");
  const [groupName, setGroupName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingSsh) {
      setName(editingSsh.name === editingSsh.host ? "" : editingSsh.name);
      setHost(editingSsh.host);
      setPort(String(editingSsh.port));
      setUsername(editingSsh.username);
      setAuthMethod(editingSsh.authMethod);
      setNetworkRoute(editingSsh.networkRoute ?? "public");
      setSecret("");
      setGroupName(editingSsh.groupName ?? "");
      setEnabled(editingSsh.enabled);
    } else {
      setName("");
      setHost("");
      setPort("22");
      setUsername("");
      setAuthMethod("password");
      setNetworkRoute("public");
      setSecret("");
      setGroupName("");
      setEnabled(true);
    }
    setError(null);
  }, [open, editingSsh]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name || host,
        host,
        port: Number(port) || 22,
        username,
        authMethod,
        networkRoute,
        groupName: groupName || undefined,
        enabled,
      };
      if (!isEdit || secret) body.secret = secret;

      await apiFetch(isEdit ? `/terminal/${editingSsh!.id}` : "/terminal", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">{isEdit ? "Edit Terminal" : "Add Terminal"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Prod VPS" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Host / IP" value={host} onChange={setHost} placeholder="203.0.113.10" required />
            </div>
            <Field label="Port" value={port} onChange={setPort} placeholder="22" />
          </div>
          <Field label="Username" value={username} onChange={setUsername} placeholder="root" required />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Auth Method</span>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as "password" | "private_key")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent/60"
            >
              <option value="password">Password</option>
              <option value="private_key">Private Key</option>
            </select>
          </label>

          {authMethod === "password" ? (
            <Field
              label={isEdit ? "Password (leave blank to keep current)" : "Password"}
              value={secret}
              onChange={setSecret}
              type="password"
              required={!isEdit}
            />
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-400">
                {isEdit ? "Private Key (leave blank to keep current)" : "Private Key"}
              </span>
              <textarea
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required={!isEdit}
                rows={5}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                spellCheck={false}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-gray-100 outline-none focus:border-accent/60"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Network Route</span>
            <select
              value={networkRoute}
              onChange={(e) => setNetworkRoute(e.target.value as "public" | "tailscale")}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent/60"
            >
              <option value="public">Public (direct)</option>
              <option value="tailscale">Private (Tailscale)</option>
            </select>
          </label>

          <Field label="Group (optional)" value={groupName} onChange={setGroupName} placeholder="e.g. Client Work" />

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Enabled
          </label>

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
              disabled={submitting || !host || !username || (!isEdit && !secret)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Terminal"}
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
