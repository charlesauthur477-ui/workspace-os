import dns from "dns/promises";

// SSRF / private-network guard for SSH connection hosts, applied when an
// SshConnection is created or its host is changed. Deliberately a standalone
// module rather than a change to apps/api/src/lib/urlSafety.ts — that file
// validates full http(s) URLs for AppInstance embed configs (a different
// Phase 1 code path); duplicating the small private-IP checks here keeps
// this phase self-contained and avoids any risk of altering that unrelated
// validator's behavior.
//
// Unlike urlSafety.ts (which blocks all private ranges unconditionally),
// legitimate SSH targets are frequently on private/internal networks — this
// guard exists to stop obviously dangerous or accidental targets (loopback,
// link-local/cloud-metadata, DNS rebinding to those), not to forbid RFC1918
// space outright. Loopback and link-local (incl. the 169.254.169.254 cloud
// metadata address) are always blocked since an SSH "connection" to either
// would let the API container's own network identity be abused; broader
// private ranges (10/8, 172.16/12, 192.168/16) are allowed since a user's
// own VPS or homelab may legitimately sit behind a private address the API
// container can route to.

export class UnsafeSshHostError extends Error {}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata.google.internal",
]);

function isLoopbackOrLinkLocalIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isLoopbackOrLinkLocalIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isLoopbackOrLinkLocalIPv4(mapped[1]);
  return false;
}

export async function assertSafeSshHost(rawHost: string): Promise<void> {
  const hostname = (rawHost || "").trim().toLowerCase();
  if (!hostname) throw new UnsafeSshHostError("Host is required");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeSshHostError(`Host "${hostname}" is not allowed`);
  }

  if (isLoopbackOrLinkLocalIPv4(hostname) || isLoopbackOrLinkLocalIPv6(hostname)) {
    throw new UnsafeSshHostError(`Host "${hostname}" is a loopback/link-local address and is not allowed`);
  }

  // A public-looking hostname that resolves to loopback/link-local (DNS
  // rebinding) should be blocked too.
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const rec of records) {
      const blocked = rec.family === 4 ? isLoopbackOrLinkLocalIPv4(rec.address) : isLoopbackOrLinkLocalIPv6(rec.address);
      if (blocked) {
        throw new UnsafeSshHostError(`Host "${hostname}" resolves to a loopback/link-local address and is not allowed`);
      }
    }
  } catch (e) {
    if (e instanceof UnsafeSshHostError) throw e;
    // DNS lookup failure — not a security concern by itself, let it through;
    // a bad hostname just fails to connect later with a safe generic error.
  }
}
