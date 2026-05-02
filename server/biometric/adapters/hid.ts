import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// HID Origo Mobile Access cloud (and on-prem VertX EVO via the HID HTTP
// listener) emits JSON events for each card / mobile credential read:
//   { "eventType":"ACCESS_GRANTED","cardholderID":"12345",
//     "credentialId":"abc-123","timestamp":"2026-04-30T10:15:33Z",
//     "readerId":"R-001" }
// Door-open is delivered via the HID Origo REST API or VertX EVO
// /VertXMessage endpoint — the dispatcher uses the queued payload hints.
export const hidAdapter: DeviceAdapter = {
  brand: "hid",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const ev = body.event ?? body;
    const externalRef = pickString(ev, [
      "cardholderID",
      "cardholderId",
      "cardNumber",
      "credentialId",
      "userId",
    ]);
    const ts = pickDate(ev, ["timestamp", "datetime", "occurredAt", "eventTime"]);
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
      nativeEventId: `${externalRef}-${pickString(ev, ["eventId", "id"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        status: decision.allow ? "GRANTED" : "DENIED",
        message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "hid_origo",
      endpoint: "/credential-management/v1/doors/{doorId}/unlock",
      vertxFallback: "/VertXMessage",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "hid_origo",
      endpoint: "/credential-management/v1/credentials",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "hid_origo",
      endpoint: "/credential-management/v1/credentials/{credentialId}",
    });
    return { ok: true };
  },
};
