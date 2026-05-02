import crypto from "node:crypto";
import { storage } from "../../storage";
import type { DeviceAdapter, NormalizedEvent } from "../types";

// ─── UNTESTED — needs hardware verification ──────────────────────────────
// Matrix COSEC (popular in India). REST API documented in the COSEC
// Centra/Apta Web SDK. The standard event-push uses an XML POST; we accept
// both XML (raw text) and JSON because newer firmware can be configured
// to emit JSON callbacks instead.
//
// Sample JSON payload:
//   { "EventCode": "5.0.1", "EventDateTime": "30/04/2025 07:42:11",
//     "UserID": "1023", "DeviceName": "GymDoor1" }
// XML variant (older firmware):
//   <Events><Event><EventCode>5.0.1</EventCode>
//      <EventDateTime>30/04/2025 07:42:11</EventDateTime>
//      <UserID>1023</UserID></Event></Events>

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// COSEC event codes — 5.0.1 = "Auth Success", 5.0.5 = "Auth Failed". The
// docs list ~80 codes; we map only the ones meaningful for door entry.
const SUCCESS_CODES = new Set(["5.0.1", "5.0.2", "5.0.3"]);

function parseDdMmYyyy(s: string): Date {
  // "30/04/2025 07:42:11" → JS Date. Falls back to "now" if unparseable.
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date(s);
  const [, dd, mm, yyyy, h, mi, sec] = m;
  return new Date(`${yyyy}-${mm}-${dd}T${h}:${mi}:${sec}`);
}

export const matrixAdapter: DeviceAdapter = {
  brand: "matrix",

  async verifyRequest(req, device) {
    if (!device.secret) return false;
    const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
    if (!sig) return false;
    const bodyStr = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody?.toString("utf8") ?? "");
    const expected = crypto.createHmac("sha256", device.secret).update(bodyStr).digest("hex");
    return timingSafeEq(sig, expected);
  },

  parseEvent(req): NormalizedEvent | null {
    let body: any = req.body;
    if (!body && req.rawBody) {
      const s = typeof req.rawBody === "string" ? req.rawBody : req.rawBody.toString("utf8");
      // Cheap XML extraction — we only need 3 fields and don't want a heavy
      // dep. Failures bubble up as null which the framework treats as a
      // heartbeat.
      const grab = (tag: string) => {
        const m = s.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
        return m ? m[1].trim() : undefined;
      };
      const code = grab("EventCode");
      const ts = grab("EventDateTime");
      const userId = grab("UserID");
      if (code || userId) body = { EventCode: code, EventDateTime: ts, UserID: userId };
    }
    if (!body) return null;

    const code = String(body.EventCode ?? body.eventCode ?? "");
    const userId = body.UserID ?? body.userId ?? body.user_id;
    const tsStr = body.EventDateTime ?? body.eventDateTime ?? "";
    const ts = tsStr ? parseDdMmYyyy(String(tsStr)) : new Date();
    const nativeId = `${userId ?? "unk"}-${code}-${ts.getTime()}`;

    if (!userId) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: nativeId,
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

  buildReply(_decision) {
    // Matrix expects a 200 OK ack; payload is ignored by the device.
    return { contentType: "text/plain", body: "OK" };
  },

  async enqueueOpenDoor(device) {
    const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "open",
      payload: {
        seconds: device.doorOpenSeconds ?? 5,
        cosec: "/cosec/api/door/open",
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
        cosec: "/cosec/api/user/add",
      },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },
};
