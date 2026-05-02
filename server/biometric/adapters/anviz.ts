import crypto from "node:crypto";
import { storage } from "../../storage";
import type { DeviceAdapter, NormalizedEvent } from "../types";

// ─── UNTESTED — needs hardware verification ──────────────────────────────
// Anviz CrossChex Cloud / CrossChex Standard. Anviz devices typically push
// to a "Push Server" URL with JSON. CrossChex Cloud uses a webhook with a
// shared API key that we verify as HMAC for parity with our other brands.
//
// Sample payload:
//   { "device_sn": "A1B2C3", "event_id": 9001,
//     "user_id": "1042", "event_time": "2025-04-30 07:42:11",
//     "verify_type": "FACE", "result": "OK" }

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const anvizAdapter: DeviceAdapter = {
  brand: "anviz",

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
    const userId = body.user_id ?? body.userID ?? body.userId;
    const ts = body.event_time ? new Date(String(body.event_time).replace(" ", "T")) : new Date();
    const nativeId = String(body.event_id ?? `${userId ?? "unk"}-${ts.getTime()}`);
    const ok = String(body.result ?? "").toUpperCase() === "OK";

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
      eventType: ok ? "entry" : "denied",
      capturedAt: isNaN(ts.getTime()) ? new Date() : ts,
      nativeEventId: nativeId,
      raw: body,
    };
  },

  buildReply(decision) {
    return {
      contentType: "application/json",
      body: JSON.stringify({ code: decision.allow ? 0 : 1, msg: decision.reason }),
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
        anviz: "/api/v1/devices/door/open",
      },
      idempotencyKey: idem,
      status: "pending",
    });
  },
};
