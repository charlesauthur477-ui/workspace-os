import crypto from "crypto";
import { env } from "../../config/env";

// Envelope encryption: MASTER_ENCRYPTION_KEY (base64, 32 bytes) encrypts each
// credential with AES-256-GCM. Never log or return decrypted values except
// at the single point of use (e.g. building an RDP handoff payload).

const ALGO = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = Buffer.from(env.masterEncryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY must be a base64-encoded 32-byte key (generate with `openssl rand -base64 32`)"
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): { blob: Buffer; keyId: string } {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Layout: [iv (12)][authTag (16)][ciphertext]
  const blob = Buffer.concat([iv, authTag, encrypted]);
  return { blob, keyId: "master-v1" };
}

export function decryptSecret(blob: Buffer): string {
  const key = getMasterKey();
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
