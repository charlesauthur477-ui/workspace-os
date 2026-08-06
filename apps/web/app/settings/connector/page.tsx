"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Device {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
}

// Settings > Connector: generate a short pairing code to type into the
// Workspace OS Connector app during its first-run setup, and manage
// (revoke) devices you've already paired.
export default function ConnectorSettingsPage() {
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(() => {
    apiFetch<Device[]>("/connector/devices").then(setDevices).catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const generateCode = async () => {
    setError(null);
    try {
      const res = await apiFetch<{ code: string; expiresAt: string }>("/connector/pair/init", { method: "POST" });
      setPairing(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    }
  };

  const revoke = async (id: string) => {
    await apiFetch(`/connector/devices/${id}/revoke`, { method: "POST" });
    loadDevices();
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Connector</h1>
      <p className="mb-8 text-sm text-gray-400">
        Pair a Workspace OS Connector install on your PC to enable one-click RDP and desktop app launches.
      </p>

      <section className="glass mb-8 rounded-xl p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Pair a new device</h2>
        {pairing ? (
          <div className="text-center">
            <p className="mb-2 text-3xl font-mono font-bold tracking-widest text-white">{pairing.code}</p>
            <p className="text-xs text-gray-400">
              Enter this in the Connector app within 10 minutes. Expires{" "}
              {new Date(pairing.expiresAt).toLocaleTimeString()}.
            </p>
          </div>
        ) : (
          <button
            onClick={generateCode}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Generate pairing code
          </button>
        )}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </section>

      <section className="glass rounded-xl p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Paired devices</h2>
        {!devices || devices.length === 0 ? (
          <p className="text-sm text-gray-500">No devices paired yet.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2">
                <div>
                  <p className="text-sm text-gray-200">{d.name}</p>
                  <p className="text-xs text-gray-500">
                    Last seen: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "never"}
                  </p>
                </div>
                <button onClick={() => revoke(d.id)} className="text-xs text-red-400 hover:underline">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
