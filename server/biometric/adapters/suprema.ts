import crypto from "node:crypto";
import { storage } from "../../storage";
import type { DeviceAdapter, NormalizedEvent } from "../types";

// ─── UNTESTED — needs hardware verification ──────────────────────────────
// Suprema BioStar 2 cloud and device-side BioMini family. The cloud-API
// shape below mirrors the Suprema BioStar 2 New Local API documentation
// (REST + webhook callbacks). Field names match the docs as of Phase B
// scoping; verify against your actual BioStar firmware before going
// live with real readers.
//
// Auth model:
//   - Webhook ingress: HMAC SHA-256 of raw body in X-Fitro360-Sig header
//     (the Suprema callback config field is "Custom Header" → shared secret)
//   - Outbound API: device.username + device.passwordEnc bearer token
//
// Sample payload (from BioStar 2 docs, abbreviated):
//   { "EventCollection": { "rows": [{
//        "id": "1234567",
//        "datetime": "2025-04-30T07:42:11+00:00",
//        "user_id": { "user_id": "EMP001", "name": "Jane" },
//        "device_id": { "id": 538, "name": "GymDoor1" },
//        "event_type_id": { "code": "AUTH_SUCCESS_FACE" }
//   }] } }

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const SUCCESS_CODES = new Set([
  "AUTH_SUCCESS_FACE",
  "AUTH_SUCCESS_FINGER",
  "AUTH_SUCCESS_CARD",
  "AUTH_SUCCESS_PIN",
]);

export const supremaAdapter: DeviceAdapter = {
  brand: "suprema",

  async verifyRequest(req, device) {
    if (!device.secret) return false;
    const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
    if (!sig) return false;
    const bodyStr = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody?.toString("utf8") ?? "");
    const expected = crypto.createHmac("sha256", device.secret).update(bodyStr).digest("hex");
    return timingSafeEq(sig, expected);
  },

  parseEvent(req): NormalizedEvent | null {
    const body = req.body;
    if (!body) return null;
    // BioStar 2 wraps events in EventCollection.rows; some firmware sends
    // a single Event at the top level. Accept both.
    const rows = body?.EventCollection?.rows ?? (body?.Event ? [body.Event] : null);
    if (!rows || rows.length === 0) return null;
    const ev = rows[0];

    const code: string = ev.event_type_id?.code ?? ev.event_type ?? "UNKNOWN";
    const userId: string | undefined =
      ev.user_id?.user_id ?? ev.user_id ?? ev.userID ?? ev.employee_id;
    const ts = ev.datetime ? new Date(ev.datetime) : new Date();
    const nativeId = String(ev.id ?? `${userId ?? "unk"}-${ts.getTime()}`);

    if (!userId) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${nativeId}`,
        raw: body,
      };
    }
    return {
      externalRef: String(userId),
      eventType: SUCCESS_CODES.has(code) ? "entry" : "denied",
      capturedAt: isNaN(ts.getTime()) ? new Date() : ts,
      nativeEventId: nativeId,
      raw: body,
    };
  },

  buildReply(decision) {
    return {
      contentType: "application/json",
      body: JSON.stringify({ result: decision.allow ? "OK" : "DENY", reason: decision.reason }),
    };
  },

  async enqueueOpenDoor(device) {
    const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "open",
      payload: {
        seconds: device.doorOpenSeconds ?? 5,
        biostar: "/api/devices/{id}/door_relay/0", // POST { "open": true }
      },
      idempotencyKey: idem,
      status: "pending",
    });
  },

  async pushTemplate(device, member, template) {
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
        biostar: "/api/users",
      },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    const idem = `dev:${device.id}:delete:${externalRef}:${Date.now()}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "delete",
      payload: { externalRef, biostar: `/api/users/${externalRef}` },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },
};
