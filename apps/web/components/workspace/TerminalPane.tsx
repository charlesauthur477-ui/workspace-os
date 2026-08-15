"use client";

import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Copy, ClipboardPaste, Eraser, Unplug, RefreshCw } from "lucide-react";
import { apiFetch, apiWebSocketUrl } from "@/lib/api";
import { WorkspaceTab } from "@/lib/workspace/WorkspaceContext";

type ConnState = "connecting" | "connected" | "error" | "disconnected";

interface TerminalSessionDto {
  token: string; // short-lived, single-use — redeemed by the WS upgrade below, never a credential
}

type ServerFrame =
  | { type: "output"; data: string }
  | { type: "error"; message: string };

// One live, browser-based SSH terminal session (xterm.js), rendered inside a
// WorkspaceShell tab. Phase 5A: WorkspacePane keeps every open "terminal"
// tab's TerminalPane mounted for as long as the tab stays open (mirrors
// RdpPane/WorkspacePane's persistent-RDP pattern), so switching tabs never
// disconnects a session — only closing the tab or clicking Disconnect does.
//
// The browser only ever receives an opaque, short-lived one-time token from
// POST /terminal/:id/terminal-session — never the stored SSH password or
// private key, never a decrypted credential. All terminal input/output
// travels exclusively over this one authenticated WebSocket; there is no
// HTTP endpoint that accepts a command string.
export function TerminalPane({ tab }: { tab: WorkspaceTab }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);

  const [state, setState] = useState<ConnState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    if (!tab.sshConnectionId) {
      setState("error");
      setErrorMessage("This tab isn't linked to a saved terminal connection.");
      return;
    }

    let cancelled = false;
    let ws: WebSocket | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function connect() {
      setState("connecting");
      setErrorMessage(null);

      let session: TerminalSessionDto;
      try {
        session = await apiFetch<TerminalSessionDto>(
          `/terminal/${tab.sshConnectionId}/terminal-session`,
          { method: "POST" }
        );
      } catch {
        if (!cancelled) {
          setState("error");
          setErrorMessage(
            "Couldn't start the terminal session. You may not have access, or the connection is disabled."
          );
        }
        return;
      }
      if (cancelled) return;

      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (cancelled) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        theme: {
          background: "#00000000",
          foreground: "#e5e7eb",
          cursor: "#e5e7eb",
        },
        allowProposedApi: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        term.open(containerRef.current);
        fitAddon.fit();
      }
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const wsUrl = apiWebSocketUrl("/terminal/ws", { token: session.token });
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const sendResize = () => {
        if (ws?.readyState !== WebSocket.OPEN) return;
        const cols = term.cols;
        const rows = term.rows;
        const last = lastSizeRef.current;
        if (last && last.cols === cols && last.rows === rows) return;
        lastSizeRef.current = { cols, rows };
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      };

      ws.onopen = () => {
        if (cancelled) return;
        setState("connected");
        fitAddon.fit();
        sendResize();
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        let frame: ServerFrame;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        if (frame.type === "output") {
          term.write(frame.data);
        } else if (frame.type === "error") {
          setState("error");
          setErrorMessage(frame.message);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setState((prev) => (prev === "error" ? prev : "disconnected"));
      };

      ws.onerror = () => {
        if (cancelled) return;
        setState("error");
        setErrorMessage("The terminal connection was interrupted.");
      };

      term.onData((data: string) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          fitAddon.fit();
          sendResize();
        });
        resizeObserver.observe(containerRef.current);
      }
    }

    connect();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      try {
        ws?.close();
      } catch {
        // best effort — the socket may already be closed
      }
      try {
        termRef.current?.dispose();
      } catch {
        // best effort
      }
      wsRef.current = null;
      termRef.current = null;
      fitAddonRef.current = null;
      lastSizeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.sshConnectionId, retryCount]);

  const focusTerminal = useCallback(() => containerRef.current?.querySelector("textarea")?.focus(), []);

  const handleCopy = useCallback(() => {
    const selection = termRef.current?.getSelection?.();
    if (selection) void navigator.clipboard.writeText(selection);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) termRef.current?.paste?.(text);
    } catch {
      // clipboard read denied/unavailable — silently no-op, same as any
      // other app that can't read the system clipboard
    }
  }, []);

  const handleClear = useCallback(() => termRef.current?.clear?.(), []);

  const handleDisconnect = useCallback(() => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "disconnect" }));
    } catch {
      // best effort
    }
    wsRef.current?.close();
    setState("disconnected");
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-surface/70 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <TerminalIcon className="h-3.5 w-3.5" />
          {tab.title}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            title="Copy selection"
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handlePaste}
            title="Paste"
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClear}
            title="Clear"
            className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDisconnect}
            title="Disconnect"
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-500/70 hover:text-white"
          >
            <Unplug className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden" onClick={focusTerminal}>
        <div ref={containerRef} className="h-full w-full p-2" />
        {state !== "connected" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/95 px-6 text-center text-gray-400">
            <TerminalIcon className="h-10 w-10 text-gray-500" />
            {state === "connecting" ? (
              <p className="text-sm font-medium text-gray-300">Connecting to {tab.title}…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-300">
                  {state === "disconnected" ? "Session ended" : "Connection failed"}
                </p>
                <p className="mx-auto max-w-sm text-sm text-gray-500">
                  {errorMessage ?? "The terminal session has ended."}
                </p>
                <button
                  onClick={retry}
                  className="glass mt-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-200 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconnect
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
