import type { DeviceAdapter } from "../types";
import { pickDate, pickString, queueDelete, queueEnroll, queueOpenDoor, verifySignedWebhook } from "./_common";

// Virdi UNIS server fires JSON event callbacks per access:
//   { "TerminalID":"V300","UserID":"12345","DateTime":"2026-04-30 10:15:33",
//     "Mode":"FP", "Result":1 }
// Result 1 = success, 0 = denied. Door-open via UNIS REST:
//   POST /UNIS/Terminal/{tid}/Door/Open
export const virdiAdapter: DeviceAdapter = {
  brand: "virdi",

  async verifyRequest(req, device) {
    return verifySignedWebhook(req, device);
  },

  parseEvent(req) {
    const body = req.body;
    if (!body) return null;
    const externalRef = pickString(body, ["UserID", "userId", "USERID"]);
    const ts = pickDate(body, ["DateTime", "datetime", "Time", "EventTime"]);
    const result = pickString(body, ["Result", "result"]);
    if (!externalRef) {
      return {
        externalRef: "",
        eventType: "unknown_face",
        capturedAt: ts,
        nativeEventId: `unk-${pickString(body, ["EventID", "Seq"]) ?? ts.getTime()}`,
        raw: body,
      };
    }
    return {
      externalRef,
      eventType: result === "0" ? "denied" : "entry",
      capturedAt: ts,
      nativeEventId: `${externalRef}-${pickString(body, ["EventID", "Seq"]) ?? ts.getTime()}`,
      raw: body,
    };
  },

  buildReply(decision, hints) {
    return {
      contentType: "application/json",
      body: JSON.stringify({
        Result: decision.allow ? 1 : 0,
        Message: hints.message ?? decision.reason,
      }),
    };
  },

  async enqueueOpenDoor(device) {
    await queueOpenDoor(device, {
      api: "unis",
      endpoint: "/UNIS/Terminal/{terminalId}/Door/Open",
    });
  },

  async pushTemplate(device, member, template) {
    await queueEnroll(device, member, template, {
      api: "unis",
      endpoint: "/UNIS/User",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    await queueDelete(device, externalRef, {
      api: "unis",
      endpoint: "/UNIS/User/{UserID}",
    });
    return { ok: true };
  },
};
