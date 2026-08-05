"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Metrics {
  cpuPercent: number;
  ramUsedPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
}

export function SystemUsage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = () => apiFetch<Metrics>("/metrics/system").then(setMetrics).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass flex gap-6 rounded-xl px-6 py-4">
      <div>
        <p className="text-xs text-gray-400">CPU Usage</p>
        <p className="text-lg font-semibold">{metrics ? `${metrics.cpuPercent}%` : "—"}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">RAM Usage</p>
        <p className="text-lg font-semibold">
          {metrics ? `${metrics.ramUsedPercent}% (${metrics.ramUsedGb}/${metrics.ramTotalGb} GB)` : "—"}
        </p>
      </div>
    </div>
  );
}
