-- Phase 5B: Tailscale private networking for SSH connections.
-- Additive only. networkRoute selects how wsServer.ts dials this host:
-- "public" (default, unchanged direct-connect behavior) or "tailscale"
-- (dial via the Tailscale sidecar's SOCKS5 proxy instead). This column
-- carries no Tailscale identity, IP, or credential -- routing metadata
-- only. Setting it to "tailscale" does not itself grant access; the
-- existing ownerUserId check and ssh.manage/ssh.connect permission checks
-- still gate use of this connection, unchanged.
ALTER TABLE "ssh_connections" ADD COLUMN "networkRoute" TEXT NOT NULL DEFAULT 'public';
