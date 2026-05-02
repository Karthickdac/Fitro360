import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// Dahua DSS Pro / "HTTP Listening" mode posts JSON access events:
//   { "Code":"AccessControl", "Action":"Pulse", "Index":0,
//     "Data": { "UserID":"12345", "CardNo":"AABBCC11",
//               "Method":3, "ErrorCode":0, "UTC":1714467333,
//               "DoorID":1, "Status":1 } }
// Status 1 = open success, 2 = denied. Door-open via NetSDK or HTTP CGI:
//   POST /cgi-bin/accessControl.cgi?action=openDoor&channel=1&UserID=...
export const dahuaAdapter: DeviceAdapter = {
  brand: "dahua",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const data = body.Data ?? body.data ?? body;
    const externalRef = pickString(data, ["UserID", "userId", "CardNo", "cardNo"]);
    const ts = pickDate(data, ["UTC", "utc", "Time", "time", "DateTime"]);
    const status = pickString(data, ["Status", "status"]);
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(body, ["Index", "RecordNo"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    return {
      externalRef,
      eventType: status === "2" ? "denied" : "entry",
      capturedAt: ts,
      photoUrl: pickString(data, ["SnapURL", "ImageURL"]),
      nativeEventId: `${externalRef}-${pickString(body, ["Index", "RecordNo"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        Result: decision.allow ? 0 : 1,
        Message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "dahua_cgi",
      endpoint: "/cgi-bin/accessControl.cgi?action=openDoor&channel=1",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "dahua_cgi",
      endpoint: "/cgi-bin/AccessUser.cgi?action=insertMulti",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "dahua_cgi",
      endpoint: "/cgi-bin/AccessUser.cgi?action=remove",
    });
    return { ok: true };
  },
};
