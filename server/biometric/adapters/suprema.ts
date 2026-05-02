import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// Suprema BioStar 2 fires a JSON webhook for every access event:
//   { "event_type_id": 1000, "datetime": "2026-04-30T10:15:33+05:30",
//     "device_id": 939393, "user_id": "12345", "user": { "name": "Foo" } }
// The BioStar 2 server can also POST to a "Listening Address" you configure
// per device group. We auth via the standard X-Fitro360-Sig HMAC header
// (BioStar 2 supports custom headers in webhook templates from v2.8+).
//
// Door-open is delivered out-of-band via BioStar 2's REST API:
//   POST /api/doors/{doorId}/open  (cookie session) — the dispatcher reads
// device.username/passwordEnc from the queued command's payload hints.
export const supremaAdapter: DeviceAdapter = {
  brand: "suprema",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const ev = body.event ?? body;
    const externalRef = pickString(ev, [
      "user_id",
      "user.user_id",
      "userId",
      "card_id",
      "cardId",
    ]);
    const ts = pickDate(ev, ["datetime", "date_time", "timestamp", "occurred_at"]);
    const eventTypeId = pickString(ev, ["event_type_id", "eventTypeId", "type_id"]);
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(ev, ["id", "event_id"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    return {
      externalRef,
      eventType: "entry",
      capturedAt: ts,
      photoUrl: pickString(ev, ["image_url", "imageURL", "photo_url"]),
      nativeEventId: `${externalRef}-${pickString(ev, ["id", "event_id"]) ?? eventTypeId ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        result: decision.allow ? "OK" : "DENY",
        message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "biostar2",
      endpoint: "/api/doors/{doorId}/open",
      authMode: "session",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "biostar2",
      endpoint: "/api/users",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "biostar2",
      endpoint: "/api/users/{userId}",
    });
    return { ok: true };
  },
};
