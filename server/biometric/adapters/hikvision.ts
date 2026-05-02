import crypto from "node:crypto";
import { storage } from "../../storage";
import type { Device } from "@shared/schema";
import type { DeviceAdapter, NormalizedEvent } from "../types";

// Hikvision uses ISAPI Event/notification HTTP Listening Mode. The device
// POSTs JSON (or multipart with a JSON part + face image) to a URL we
// configure on the device. Auth uses a shared secret HMAC so a leaked URL
// alone cannot trigger door opens.
//
// Sample payload (truncated):
// { "ipAddress":"10.0.0.5", "AccessControllerEvent": {
//     "deviceName":"GymDoor1", "majorEventType":5, "subEventType":75,
//     "employeeNoString":"12345", "name":"Jane",
//     "currentVerifyMode":"face", "serialNo":1234 } }

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Minimal multipart splitter — Hikvision's JSON+image envelope only needs
// us to find the boundary markers, no streaming/IO. We deliberately do
// NOT pull in busboy: the JSON part is tiny, the image parts get
// discarded, and avoiding a dep keeps the on-prem relay agent lean too.
function splitMultipart(buf: Buffer, boundary: string): Buffer[] {
  const sep = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let idx = 0;
  while (idx < buf.length) {
    const start = buf.indexOf(sep, idx);
    if (start < 0) break;
    const partStart = start + sep.length;
    // Skip optional CRLF after the boundary
    let chunkStart = partStart;
    if (buf[chunkStart] === 0x0d && buf[chunkStart + 1] === 0x0a) chunkStart += 2;
    const next = buf.indexOf(sep, chunkStart);
    if (next < 0) break;
    // Trim trailing CRLF that precedes the next boundary
    let chunkEnd = next;
    if (chunkEnd >= 2 && buf[chunkEnd - 2] === 0x0d && buf[chunkEnd - 1] === 0x0a) chunkEnd -= 2;
    if (chunkEnd > chunkStart) parts.push(buf.subarray(chunkStart, chunkEnd));
    idx = next;
  }
  return parts;
}

export const hikvisionAdapter: DeviceAdapter = {
  brand: "hikvision",

  async verifyRequest(req, device) {
    const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
    if (!sig) return false; // mandatory signature for webhook ingress
    const bodyStr = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody?.toString("utf8") ?? "");
    const expected = crypto
      .createHmac("sha256", device.secret)
      .update(bodyStr)
      .digest("hex");
    return timingSafeEq(sig, expected);
  },

  parseEvent(req) {
    let body: any = req.body;

    // ── Multipart variant ────────────────────────────────────────────
    // Many Hikvision firmwares POST as multipart/form-data with a
    // JSON "event_log" part and one or more image parts (face crop,
    // background scene). The global JSON parser leaves req.body empty
    // for these requests, so we parse the boundary ourselves rather
    // than pulling in busboy. We only need the JSON part — image
    // parts are dropped (they're biometric data we don't keep).
    const ct = (req as any).headers?.["content-type"] as string | undefined;
    if ((!body || typeof body !== "object" || Array.isArray(body)) && ct && ct.includes("multipart/form-data")) {
      const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = m ? (m[1] ?? m[2]) : null;
      if (boundary && req.rawBody) {
        const buf = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
        const parts = splitMultipart(buf, boundary);
        for (const p of parts) {
          const headerEnd = p.indexOf("\r\n\r\n");
          if (headerEnd < 0) continue;
          const headers = p.subarray(0, headerEnd).toString("utf8").toLowerCase();
          const data = p.subarray(headerEnd + 4);
          if (headers.includes("application/json") || headers.includes('name="event_log"')) {
            try {
              body = JSON.parse(data.toString("utf8").replace(/\r\n$/, ""));
              break;
            } catch {
              // try the next part
            }
          }
        }
      }
    }

    if (!body) return null;
    const ev = body.AccessControllerEvent || body.accessControllerEvent || body;
    if (!ev) return null;

    const employeeNo: string | undefined =
      ev.employeeNoString || ev.employeeNo?.toString() || ev.userID || ev.cardNo;
    if (!employeeNo) {
      // Unknown face / card — record as unknown_face for forensic logging
      const ts = ev.dateTime ? new Date(ev.dateTime) : new Date();
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${ev.serialNo ?? ts.getTime()}`,
        raw: body,
      };
    }
    const ts = ev.dateTime ? new Date(ev.dateTime) : new Date();
    return {
      externalRef: employeeNo,
      eventType: "entry",
      capturedAt: isNaN(ts.getTime()) ? new Date() : ts,
      photoUrl: ev.pictureURL,
      nativeEventId: `${employeeNo}-${ev.serialNo ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    // Hikvision ISAPI just wants 200 OK with a small JSON ack. Open-door
    // commands flow back over the device's outbound REST API; we queue
    // one via enqueueOpenDoor below.
    return {
      contentType: "application/json",
      body: JSON.stringify({
        statusCode: decision.allow ? 1 : 4,
        statusString: decision.allow ? "OK" : "Denied",
        message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    // Race-safe via storage.createDoorCommand — UNIQUE(idempotencyKey)
    // collapses concurrent triggers in the same 3s bucket to one insert.
    const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "open",
      payload: { seconds: device.doorOpenSeconds ?? 5, isapi: "/ISAPI/AccessControl/RemoteControl/door/1" },
      idempotencyKey: idem,
      status: "pending",
    });
    // In production: a background dispatcher would now POST to the device's
    // ISAPI endpoint using HTTP Digest auth (device.username/passwordEnc).
    // We keep the command queued so the relay or dispatcher can pick it up.
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
        isapi: "/ISAPI/AccessControl/UserInfo/SetUp",
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
      payload: { externalRef, isapi: "/ISAPI/AccessControl/UserInfo/Delete" },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },
};
