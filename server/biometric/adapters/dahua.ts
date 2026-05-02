import crypto from "node:crypto";
import { storage } from "../../storage";
import type { DeviceAdapter, NormalizedEvent } from "../types";

// ─── UNTESTED — needs hardware verification ──────────────────────────────
// Dahua DSS Express / Dahua HTTP API. Dahua access controllers push events
// in a multipart-or-JSON format roughly compatible with Hikvision's ISAPI
// shape. We support the JSON variant; multipart is a Phase C follow-up.
//
// Sample payload (DSS-routed):
//   { "info": { "EventCode": "AccessControl",
//        "DeviceID": "DH-K-12345",
//        "Card": { "CardNo": "8801023" },
//        "User": { "UserID": "1042", "UserName": "Jane" },
//        "Time": "2025-04-30 07:42:11",
//        "Status": 1 }}

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const dahuaAdapter: DeviceAdapter = {
  brand: "dahua",

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
    const info = body.info ?? body.Event ?? body;
    if (!info) return null;
    const userId =
      info.User?.UserID ?? info.UserID ?? info.userId ?? info.Card?.CardNo;
    const tsStr = info.Time ?? info.EventTime ?? "";
    const ts = tsStr ? new Date(String(tsStr).replace(" ", "T")) : new Date();
    const nativeId = `${userId ?? "unk"}-${info.EventCode ?? ""}-${ts.getTime()}`;
    const ok = info.Status === 1 || info.Status === "1" || info.Result === "OK";

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

  buildReply(_decision) {
    return { contentType: "application/json", body: JSON.stringify({ code: 200 }) };
  },

  async enqueueOpenDoor(device) {
    const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "open",
      payload: {
        seconds: device.doorOpenSeconds ?? 5,
        dahua: "/cgi-bin/accessControl.cgi?action=openDoor&channel=1",
      },
      idempotencyKey: idem,
      status: "pending",
    });
  },
};
