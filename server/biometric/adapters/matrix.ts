import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// Matrix COSEC sends JSON push events to a configured "Event Server" URL:
//   { "EventCode": "1", "DeviceID": "M3001", "UserID": "12345",
//     "DateTime": "2026-04-30 10:15:33", "Door": "1" }
// EventCodes: 1=valid access, 4=invalid, 6=unknown card. Door-open is
// done via the COSEC Web API (POST /api/v2/door/open with door id).
export const matrixAdapter: DeviceAdapter = {
  brand: "matrix",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const externalRef = pickString(body, ["UserID", "userId", "User_ID", "EmployeeCode"]);
    const ts = pickDate(body, ["DateTime", "EventTime", "Time", "datetime"]);
    const evCode = pickString(body, ["EventCode", "eventCode", "Event"]);
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(body, ["EventID", "Serial"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    // EventCode 4 = denied at the device (already-blocked or wrong door).
    // We still record it but don't fire an open command — evaluateAccess in
    // the route handler decides afresh based on Fitro360-side state.
    const eventType = evCode === "4" ? "denied" : "entry";
    return {
      externalRef,
      eventType,
      capturedAt: ts,
      nativeEventId: `${externalRef}-${pickString(body, ["EventID", "Serial"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        Status: decision.allow ? "Accepted" : "Rejected",
        Message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "cosec",
      endpoint: "/api/v2/door/open",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "cosec",
      endpoint: "/api/v2/user",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "cosec",
      endpoint: "/api/v2/user/{UserID}",
    });
    return { ok: true };
  },
};
