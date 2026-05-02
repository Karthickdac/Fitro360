import crypto from "node:crypto";

// AES-256-GCM envelope encryption for biometric-sensitive payloads
// (template bytes + raw event payloads). The Data Encryption Key is taken
// from BIOMETRIC_ENCRYPTION_KEY (32 bytes hex preferred; any non-empty value
// is hashed to 32 bytes). If unset we derive a deterministic key from
// SESSION_SECRET so an out-of-the-box install still encrypts at rest, and we
// log a one-shot warning so operators set a dedicated key in production.
let warned = false;
function getKey(): Buffer {
  const explicit = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (explicit && explicit.length > 0) {
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) return Buffer.from(explicit, "hex");
    return crypto.createHash("sha256").update(explicit).digest();
  }
  const fallback = process.env.SESSION_SECRET || "fitro360-dev-secret";
  if (!warned && process.env.NODE_ENV === "production") {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[biometric] BIOMETRIC_ENCRYPTION_KEY not set; deriving key from SESSION_SECRET. " +
        "Set BIOMETRIC_ENCRYPTION_KEY (32 bytes hex) in production for proper key separation.",
    );
  }
  return crypto.createHash("sha256").update("biometric:" + fallback).digest();
}

const PREFIX = "enc:v1:";

export function encryptString(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  if (typeof plain !== "string" || plain.length === 0) return plain ?? null;
  if (plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptString(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (typeof stored !== "string") return stored as any;
  if (!stored.startsWith(PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}

export function encryptJson(value: unknown): string | null {
  if (value == null) return null;
  return encryptString(JSON.stringify(value));
}

export function decryptJson<T = any>(stored: string | null | undefined): T | null {
  const s = decryptString(stored as any);
  if (s == null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
