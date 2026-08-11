import crypto from "crypto";
import { env } from "../../config/env";

// Phase 4 — implements Apache Guacamole's "Encrypted JSON authentication"
// extension (guacamole-auth-json), per the official spec:
// https://guacamole.apache.org/doc/gug/json-auth.html
//
// We deliberately do NOT give Guacamole its own database (no MySQL/Postgres/
// LDAP auth extension). The JSON extension is the *only* authentication
// mechanism configured on the guacamole container (enabled there via
// JSON_SECRET_KEY). That means Guacamole never stores connections or
// credentials of its own — every RDP session is described fresh, entirely
// server-side, at the moment a user starts one, and the description
// (including the decrypted password) is redeemed for an opaque session
// token in the same request. Nothing durable is ever provisioned on the
// Guacamole side, so there is no separate credential store to keep in sync
// or leak from.
//
// Algorithm (exact spec, do not change without re-reading the doc above):
//   1. JSON-encode the payload.
//   2. Sign it with HMAC-SHA256 using the shared 128-bit key; prepend the
//      32-byte signature to the plaintext JSON bytes.
//   3. Encrypt that with AES-128-CBC using an all-zero IV (required by the
//      extension — this is safe here because the key is single-purpose,
//      short-lived per payload via `expires`, and never reused to encrypt
//      more than one logical message per key in a way that matters for CBC
//      IV-reuse attacks; Guacamole's own reference implementation does the
//      same).
//   4. Base64-encode the ciphertext.

const AES_ALGO = "aes-128-cbc";
const ZERO_IV = Buffer.alloc(16, 0);

function getJsonKey(): Buffer {
  const hex = env.jsonSecretKey.trim();
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error(
      "JSON_SECRET_KEY must be a 32-character hexadecimal string (128-bit key) — generate with `openssl rand -hex 16`"
    );
  }
  return Buffer.from(hex, "hex");
}

export interface GuacamoleRdpParams {
  hostname: string;
  port: number;
  username: string;
  password: string;
}

// Builds the base64, signed + encrypted payload Guacamole expects on
// POST /api/tokens (form field `data`). `connectionName` becomes both the
// object key in the JSON and the GUAC_ID the frontend must present when
// opening the tunnel — callers should use something unique and non-guessable
// per RdpConnection (see router.ts: `rdp-${connection.id}`).
export function buildJsonAuthPayload(params: {
  username: string;
  connectionName: string;
  connection: GuacamoleRdpParams;
  ttlMs?: number;
}): string {
  const payload = {
    username: params.username,
    // Short TTL is intentional: this blob is redeemed immediately,
    // server-side, against Guacamole's /api/tokens in the same request. It
    // is never re-presented later, so it only needs to survive the single
    // round-trip to guacamole — not the lifetime of the RDP session itself
    // (the resulting authToken has its own, separate Guacamole session
    // lifetime).
    expires: Date.now() + (params.ttlMs ?? 60_000),
    connections: {
      [params.connectionName]: {
        protocol: "rdp",
        parameters: {
          hostname: params.connection.hostname,
          port: String(params.connection.port),
          username: params.connection.username,
          password: params.connection.password,
          security: "any",
          "ignore-cert": "true",
          "resize-method": "display-update",
        },
      },
    },
  };

  const key = getJsonKey();
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = crypto.createHmac("sha256", key).update(json).digest();
  const plaintext = Buffer.concat([signature, json]);
  const cipher = crypto.createCipheriv(AES_ALGO, key, ZERO_IV);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return encrypted.toString("base64");
}

// Redeems the signed payload for a short-lived, opaque Guacamole auth token
// by calling Guacamole's own REST API over the private Docker network
// (server-to-server — the browser is never involved in this exchange and
// never sees `data` or the resulting call's request/response).
export async function redeemGuacamoleToken(data: string): Promise<{ authToken: string }> {
  const res = await fetch(`${env.guacamoleInternalUrl}/api/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Guacamole token exchange failed with status ${res.status}`);
  }

  const body = (await res.json().catch(() => ({}))) as { authToken?: string };
  if (!body.authToken) {
    throw new Error("Guacamole token exchange returned no authToken");
  }
  return { authToken: body.authToken };
}
