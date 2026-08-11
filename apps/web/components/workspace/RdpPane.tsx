"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { WorkspaceTab } from "@/lib/workspace/WorkspaceContext";

type ConnState = "connecting" | "connected" | "error" | "disconnected";

interface GuacamoleSessionDto {
  token: string;
  connectionId: string;
  dataSource: string;
  guacBaseUrl: string; // browser-reachable Guacamole origin, e.g. https://guac.example.com/guacamole
}

// One live, browser-based RDP session (Guacamole client), rendered inside a
// WorkspaceShell tab. Phase 4: WorkspacePane keeps every open "rdp" tab's
// RdpPane mounted for as long as the tab stays open (see WorkspacePane.tsx),
// so switching between tabs — even Home — never disconnects a session; only
// closing the tab does, via this component's unmount/cleanup below.
//
// The browser only ever receives an opaque, short-lived Guacamole auth
// token from POST /rdp/:id/guacamole-session (see apps/api's rdp router) —
// never the stored RDP password, never a raw connection host/credential.
export function RdpPane({ tab }: { tab: WorkspaceTab }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const [state, setState] = useState<ConnState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    if (!tab.rdpConnectionId) {
      setState("error");
      setErrorMessage("This tab isn't linked to a saved remote server.");
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any = null;

    async function connect() {
      setState("connecting");
      setErrorMessage(null);

      let session: GuacamoleSessionDto;
      try {
        session = await apiFetch<GuacamoleSessionDto>(
          `/rdp/${tab.rdpConnectionId}/guacamole-session`,
          { method: "POST" }
        );
      } catch {
        if (!cancelled) {
          setState("error");
          setErrorMessage(
            "Couldn't start the remote desktop session. You may not have access, or the service is temporarily unavailable."
          );
        }
        return;
      }
      if (cancelled) return;

      const Guacamole = (await import("guacamole-common-js")).default;
      const wsUrl = `${session.guacBaseUrl.replace(/^http/, "ws")}/websocket-tunnel`;
      const tunnel = new Guacamole.WebSocketTunnel(wsUrl);
      client = new Guacamole.Client(tunnel);
      if (cancelled) {
        client.disconnect();
        return;
      }
      clientRef.current = client;

      client.onstatechange = (clientState: number) => {
        if (cancelled) return;
        // Guacamole client states: 0 idle, 1 connecting, 2 waiting for
        // first frame, 3 connected, 4 disconnecting, 5 disconnected.
        if (clientState === 3) setState("connected");
        else if (clientState === 5) {
          setState((prev) => (prev === "error" ? prev : "disconnected"));
        }
      };

      client.onerror = (status: { code?: number; message?: string }) => {
        if (cancelled) return;
        console.error("Guacamole client error", status);
        setState("error");
        setErrorMessage(
          "The remote desktop session couldn't be established or was interrupted. The host may be offline, or the saved credentials may be incorrect."
        );
      };

      const display = client.getDisplay();
      const displayEl = display.getElement();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(displayEl);
      }

      const mouse = new Guacamole.Mouse(displayEl);
      const forwardMouse = (mouseState: unknown) => clientRef.current?.sendMouseState(mouseState);
      mouse.onmousedown = forwardMouse;
      mouse.onmouseup = forwardMouse;
      mouse.onmousemove = forwardMouse;

      // Scoped to this pane's own container (not `document`) so a
      // backgrounded RDP tab never intercepts keystrokes meant for whatever
      // tab is actually visible — the element only receives focus when the
      // user clicks into it, and display:none panes never receive DOM
      // input events at all.
      const keyboard = new Guacamole.Keyboard(containerRef.current ?? displayEl);
      keyboard.onkeydown = (keysym: number) => clientRef.current?.sendKeyEvent(1, keysym);
      keyboard.onkeyup = (keysym: number) => clientRef.current?.sendKeyEvent(0, keysym);

      const width = containerRef.current?.clientWidth || 1024;
      const height = containerRef.current?.clientHeight || 768;
      const connectParams = new URLSearchParams({
        token: session.token,
        GUAC_DATA_SOURCE: session.dataSource,
        GUAC_ID: session.connectionId,
        GUAC_TYPE: "c",
        GUAC_WIDTH: String(width),
        GUAC_HEIGHT: String(height),
        GUAC_DPI: "96",
      }).toString();

      client.connect(connectParams);
    }

    connect();

    return () => {
      cancelled = true;
      try {
        client?.disconnect();
      } catch {
        // best-effort — the tunnel may already be closed
      }
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.rdpConnectionId, retryCount]);

  // Visually fits the (fixed-resolution) remote display into whatever space
  // this pane currently has, via Guacamole's own CSS-transform scaling —
  // does not renegotiate the actual remote resolution.
  useEffect(() => {
    if (state !== "connected" || !clientRef.current) return;
    const display = clientRef.current.getDisplay();

    function fit() {
      if (!containerRef.current) return;
      const w = display.getWidth();
      const h = display.getHeight();
      if (!w || !h) return;
      const scale = Math.min(containerRef.current.clientWidth / w, containerRef.current.clientHeight / h);
      if (isFinite(scale) && scale > 0) display.scale(scale);
    }

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [state]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div
        ref={containerRef}
        tabIndex={0}
        onClick={() => containerRef.current?.focus()}
        className="h-full w-full outline-none"
      />
      {state !== "connected" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/95 px-6 text-center text-gray-400">
          <Monitor className="h-10 w-10 text-gray-500" />
          {state === "connecting" ? (
            <p className="text-sm font-medium text-gray-300">Connecting to {tab.title}…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-300">
                {state === "disconnected" ? "Session ended" : "Connection failed"}
              </p>
              <p className="mx-auto max-w-sm text-sm text-gray-500">
                {errorMessage ?? "The remote desktop session has ended."}
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
  );
}
