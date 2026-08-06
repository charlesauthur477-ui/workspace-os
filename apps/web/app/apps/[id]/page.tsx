"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";

// The embedded-app panel. Whether an app embeds cleanly is a per-app
// decision made by whoever configured it (openMode: "embedded" is only set
// for sites confirmed to allow framing) — this page doesn't try to guess.
// It still gives a visible "open in new tab" escape hatch and a load-timeout
// nudge, since even an allowed site can be slow or briefly misconfigured.
export default function EmbeddedAppPanel() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "App";
  const url = searchParams.get("url");
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!url) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-3 text-gray-400">
        <p>No launch URL configured for this app yet.</p>
        <button onClick={() => router.back()} className="text-accent hover:underline">
          Go back
        </button>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="glass flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-200">{name}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </header>

      {slow && !loaded ? (
        <div className="glass mx-4 mt-2 flex items-center justify-between rounded-lg px-4 py-2 text-xs text-amber-300">
          <span>This is taking a while — some sites block embedding entirely.</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            Open in new tab instead
          </a>
        </div>
      ) : null}

      <iframe
        key={params.id}
        src={url}
        onLoad={() => setLoaded(true)}
        className="flex-1 border-0"
        title={name}
        allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
