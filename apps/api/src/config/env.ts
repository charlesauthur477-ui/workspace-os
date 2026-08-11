import "dotenv/config";

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: required("APP_URL", "http://localhost:3000"),
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "",

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",

  masterEncryptionKey: required("MASTER_ENCRYPTION_KEY"),
  ownerEmail: required("OWNER_EMAIL"),

  // Phase 4 — browser-based RDP via Apache Guacamole. GUACAMOLE_INTERNAL_URL
  // is server-to-server only (private Docker network, e.g.
  // http://guacamole:8080/guacamole) and is used to redeem a signed session
  // token. GUACAMOLE_PUBLIC_URL is the browser-reachable HTTPS origin the
  // frontend opens its WebSocket tunnel against — it is not secret, just a
  // URL. JSON_SECRET_KEY is the 128-bit shared secret with the guacamole
  // container's own JSON_SECRET_KEY env var; it must never reach the browser.
  guacamoleInternalUrl: process.env.GUACAMOLE_INTERNAL_URL ?? "http://guacamole:8080/guacamole",
  guacamolePublicUrl: required("GUACAMOLE_PUBLIC_URL"),
  jsonSecretKey: required("JSON_SECRET_KEY"),
};
