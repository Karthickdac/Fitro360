import crypto from "node:crypto";
import { storage } from "../../storage";
import type { Device } from "@shared/schema";

// Shared helpers for the JSON-webhook style adapters (Suprema, Matrix,
// Anviz, Dahua, IDEMIA, Virdi, HID). Each brand's wire payload differs but
// the auth + queueing pattern is identical to Hikvision: HMAC-verify the
// raw bytes against device.secret, then queue brand-tagged commands so the
// outbound dispatcher knows which native REST call to make.

export function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Standard signed-webhook verification used by every brand whose firmware
// (or cloud relay) can attach a custom HTTP header. Operators paste the
// device.secret into the brand's webhook config; the relay/device computes
// HMAC-SHA256 of the request body and sends it as X-Fitro360-Sig.
export async function verifySignedWebhook(
  req: { headers: Record<string, any>; rawBody: Buffer | string },
  device: Device,
): Promise<boolean> {
  if (!device.secret) return false;
  const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
  if (!sig) return false;
  const bodyStr = typeof req.rawBody === "string"
    ? req.rawBody
    : (req.rawBody?.toString("utf8") ?? "");
  const expected = crypto
    .createHmac("sha256", device.secret)
    .update(bodyStr)
    .digest("hex");
  return timingSafeEq(sig, expected);
}

// 3-second idempotency bucket — collapses concurrent triggers (e.g. duplicate
// webhook deliveries) for the same device into one open command. Matches the
// pattern used by zkteco/hikvision adapters.
export async function queueOpenDoor(device: Device, payloadExtras: Record<string, unknown> = {}) {
  const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
  await storage.createDoorCommand({
    tenantId: device.tenantId,
    deviceId: device.id,
    command: "open",
    payload: { seconds: device.doorOpenSeconds ?? 5, ...payloadExtras },
    idempotencyKey: idem,
    status: "pending",
  });
}

export async function queueEnroll(
  device: Device,
  member: { id: string; firstName: string; lastName: string },
  template: { externalRef: string; templateData: string; templateType: "face" | "fingerprint" | "card" },
  payloadExtras: Record<string, unknown> = {},
) {
  const idem = `dev:${device.id}:enroll:${template.externalRef}:${Date.now()}`;
  await storage.createDoorCommand({
    tenantId: device.tenantId,
    deviceId: device.id,
    command: "enroll",
    payload: {
      externalRef: template.externalRef,
      templateData: template.templateData,
      templateType: template.templateType,
      memberName: `${member.firstName} ${member.lastName}`,
      ...payloadExtras,
    },
    idempotencyKey: idem,
    status: "pending",
  });
}

export async function queueDelete(
  device: Device,
  externalRef: string,
  payloadExtras: Record<string, unknown> = {},
) {
  const idem = `dev:${device.id}:delete:${externalRef}:${Date.now()}`;
  await storage.createDoorCommand({
    tenantId: device.tenantId,
    deviceId: device.id,
    command: "delete",
    payload: { externalRef, ...payloadExtras },
    idempotencyKey: idem,
    status: "pending",
  });
}

// Try a list of dotted-path candidates against the body; first non-empty
// stringified value wins. Used by the brand-specific parseEvent functions
// since most JSON webhooks bury the user id one or two levels deep and
// firmware versions occasionally rename the key.
export function pickString(body: any, paths: string[]): string | undefined {
  for (const p of paths) {
    let cur: any = body;
    for (const seg of p.split(".")) {
      if (cur == null) break;
      cur = cur[seg];
    }
    if (cur == null) continue;
    const s = typeof cur === "string" ? cur : String(cur);
    if (s.length > 0) return s;
  }
  return undefined;
}

export function pickDate(body: any, paths: string[]): Date {
  for (const p of paths) {
    const s = pickString(body, [p]);
    if (!s) continue;
    // Accept ISO 8601, "YYYY-MM-DD HH:MM:SS", and unix epoch (seconds or ms).
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      const ts = n > 1e12 ? n : n * 1000;
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
