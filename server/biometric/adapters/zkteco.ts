import crypto from "node:crypto";
import { storage } from "../../storage";
import type { Device } from "@shared/schema";
import type { DeviceAdapter, NormalizedEvent, AccessDecision, AdapterReplyHints, EnrolPayload } from "../types";

// ZKTeco / ESSL family use the ADMS "PUSH" protocol. The device polls
// /iclock/cdata, /iclock/getrequest, /iclock/devicecmd over plain HTTP.
// We authenticate the device by:
//   1. matching SerialNumber (SN query param) to a registered device row, AND
//   2. comparing an HMAC the relay/device sends in the X-Fitro360-Sig header
//      against the device's stored secret. Devices in pure cloud-push mode
//      with no HMAC support fall back to SN+IP allowlisting handled by the
//      route layer for simplicity.
//
// Event payload (POST body, plain text, line-delimited):
//   USER PIN=12345\tName=Foo\tCardNo=...
//   ATTLOG: 12345\t2026-04-30 09:15:33\t0\t1
function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseAttlogLine(line: string): NormalizedEvent | null {
  // Format we accept (ZKTeco ADMS attlog): "<pin>\t<datetime>\t<status>\t<verifyMode>"
  const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const [pin, dt] = parts;
  if (!pin || !dt) return null;
  const ts = new Date(dt.replace(" ", "T"));
  if (isNaN(ts.getTime())) return null;
  return {
    externalRef: pin,
    eventType: "entry",
    capturedAt: ts,
    nativeEventId: `${pin}-${ts.getTime()}`,
    raw: { line, pin, ts: dt },
  };
}

export const zktecoAdapter: DeviceAdapter = {
  brand: "zkteco",

  async verifyRequest(req, device) {
    const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
    if (!sig) return false; // signature is mandatory — no anonymous webhooks
    const bodyStr = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody?.toString("utf8") ?? "");
    const expected = crypto
      .createHmac("sha256", device.secret)
      .update(bodyStr)
      .digest("hex");
    return timingSafeEq(sig, expected);
  },

  parseEvent(req) {
    // ADMS attlog payload arrives as plain text on POST /iclock/cdata?table=ATTLOG
    const bodyStr = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody?.toString("utf8") ?? "");
    const lines = bodyStr.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const ev = parseAttlogLine(line);
      if (ev) return ev;
    }
    return null;
  },

  buildReply(decision, hints) {
    // ADMS expects "OK" + optional inline command. The device polls
    // /iclock/getrequest separately for door commands; for the inline
    // path we acknowledge the upload and queue an open-door for next poll
    // when the decision is allow.
    const lines = ["OK"];
    if (hints.message) lines.push(`MSG ${hints.message}`);
    return {
      contentType: "text/plain; charset=utf-8",
      body: lines.join("\n") + "\n",
    };
  },

  async enqueueOpenDoor(device) {
    const idem = `dev:${device.id}:door:${Math.floor(Date.now() / 3000)}`;
    const existing = await storage.getDoorCommandByIdempotencyKey(idem);
    if (existing) return;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "open",
      payload: { seconds: device.doorOpenSeconds ?? 5 },
      idempotencyKey: idem,
      status: "pending",
    });
  },

  async pushTemplate(device, member, template) {
    // For LAN-only ZKTeco devices we queue an enrol command; the relay
    // (or a future direct push job) actually delivers it to the device.
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
      },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },

  async deleteTemplate(device, externalRef) {
    const idem = `dev:${device.id}:delete:${externalRef}:${Date.now()}`;
    await storage.createDoorCommand({
      tenantId: device.tenantId,
      deviceId: device.id,
      command: "delete",
      payload: { externalRef },
      idempotencyKey: idem,
      status: "pending",
    });
    return { ok: true };
  },
};

// ESSL devices use the same ADMS protocol — alias only.
export const esslAdapter: DeviceAdapter = { ...zktecoAdapter, brand: "essl" };

// Realtime is also ADMS-compatible in cloud-push mode for most modern units.
export const realtimeAdapter: DeviceAdapter = { ...zktecoAdapter, brand: "realtime" };
