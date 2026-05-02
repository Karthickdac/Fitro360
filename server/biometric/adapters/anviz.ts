import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// Anviz CrossChex Cloud emits webhook events for each punch:
//   { "DeviceSN":"A301", "EmployeeID":"12345", "CheckTime":"2026-04-30T10:15:33Z",
//     "CheckType":0, "VerifyMode":1, "JobCode":"" }
// CheckType 0=in, 1=out, 2=denied. Door-open is delivered via the Anviz
// Cloud REST API: POST /api/device/openDoor with {sn, door}.
export const anvizAdapter: DeviceAdapter = {
  brand: "anviz",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    // CrossChex Cloud sometimes wraps the event in a `data` array; handle both.
    const ev = Array.isArray(body?.data) ? body.data[0] : (body.data ?? body);
    if (!ev) return null;
    const externalRef = pickString(ev, ["EmployeeID", "employeeId", "UserID", "Workno"]);
    const ts = pickDate(ev, ["CheckTime", "checkTime", "datetime", "PunchTime"]);
    const checkType = pickString(ev, ["CheckType", "checkType"]);
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(ev, ["RecordID", "id"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    return {
      externalRef,
      eventType: checkType === "2" ? "denied" : checkType === "1" ? "exit" : "entry",
      capturedAt: ts,
      photoUrl: pickString(ev, ["Photo", "ImageURL"]),
      nativeEventId: `${externalRef}-${pickString(ev, ["RecordID", "id"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        code: decision.allow ? 0 : 1,
        message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "crosschex_cloud",
      endpoint: "/api/device/openDoor",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "crosschex_cloud",
      endpoint: "/api/employee/upload",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "crosschex_cloud",
      endpoint: "/api/employee/delete",
    });
    return { ok: true };
  },
};
