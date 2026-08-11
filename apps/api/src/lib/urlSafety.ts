import dns from "dns/promises";

// Server-side SSRF guard for any user-configurable URL that will be stored
// and later loaded (embedded iframe, new_tab launch, etc). Applied wherever
// AppInstance.config.url (or any future config field carrying a URL) is
// written — POST and PATCH alike — not just from the future admin UI.
//
// Blocks: non-http(s) protocols (file://, javascript:, etc.), localhost,
// private/reserved IPv4 and IPv6 ranges, link-local addresses (which also
// covers the 169.254.169.254 cloud metadata endpoint), and — via a DNS
// lookup on the hostname — public hostnames that resolve to a private
// address (DNS rebinding).
//
// This intentionally does NOT try to detect every possible SSRF vector
// (e.g. open redirects on an allowed host, IPv6 zone-id tricks). It's a
// baseline filter for "obviously dangerous target," per the Phase 1 scope.

export class UnsafeUrlError extends Error {}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata.google.internal", // GCP metadata
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback (127.0.0.0/8)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 (AWS/GCP/Azure metadata)
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 carrier-grade NAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export async function assertSafeConfigUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new UnsafeUrlError(`Protocol "${parsed.protocol}" is not allowed — only http/https URLs are permitted`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) throw new UnsafeUrlError("URL has no host");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError(`Host "${hostname}" is not allowed`);
  }

  // Literal IP written directly in the URL.
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw new UnsafeUrlError(`Host "${hostname}" resolves to a private/internal address and is not allowed`);
  }

  // A public-looking hostname that resolves to a private address (DNS
  // rebinding) should be blocked too — resolve and re-check.
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const rec of records) {
      const blocked = rec.family === 4 ? isPrivateIPv4(rec.address) : isPrivateIPv6(rec.address);
      if (blocked) {
        throw new UnsafeUrlError(`Host "${hostname}" resolves to a private/internal address and is not allowed`);
      }
    }
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw e;
    // DNS lookup failure (e.g. NXDOMAIN, or offline dev environment) — not a
    // security concern by itself, so let it through; a bad hostname just
    // fails to load later as a broken tile, same as today.
  }
}

// Validates config.url if present in an arbitrary config object, leaving
// everything else in the object untouched. Used by both AppInstance create
// and update paths so there's exactly one enforcement point.
export async function assertSafeConfig(config: Record<string, unknown>): Promise<void> {
  const url = config?.url;
  if (typeof url === "string" && url.length > 0) {
    await assertSafeConfigUrl(url);
  }
}
