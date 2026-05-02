import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// IDEMIA MorphoManager / Universal BioBridge fires JSON callbacks for
// access events from MorphoWave / VisionPass / SIGMA readers:
//   { "eventType":"ACCESS_GRANTED", "userId":"12345",
//     "timestamp":"2026-04-30T10:15:33Z", "deviceId":"MW-001",
//     "personRef":"emp-12345" }
// Door-open is delivered via the BioBridge SOAP/REST bridge:
//   POST /BioBridge/v3/door/{doorId}/unlock
export const idemiaAdapter: DeviceAdapter = {
  brand: "idemia",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const ev = body.event ?? body;
    const externalRef = pickString(ev, ["userId", "user_id", "personRef", "person_id"]);
    const ts = pickDate(ev, ["timestamp", "datetime", "occurredAt"]);
    const evType = (pickString(ev, ["eventType", "event_type"]) ?? "").toUpperCase();
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(ev, ["eventId", "id"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    const eventType =
      evType.includes("DENIED") || evType.includes("REJECT") ? "denied" : "entry";
    return {
      externalRef,
      eventType,
      capturedAt: ts,
      photoUrl: pickString(ev, ["imageUrl", "snapshotUrl"]),
      nativeEventId: `${externalRef}-${pickString(ev, ["eventId", "id"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        status: decision.allow ? "ACCEPTED" : "REJECTED",
        message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "biobridge",
      endpoint: "/BioBridge/v3/door/{doorId}/unlock",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "biobridge",
      endpoint: "/BioBridge/v3/persons",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "biobridge",
      endpoint: "/BioBridge/v3/persons/{personRef}",
    });
    return { ok: true };
  },
};
