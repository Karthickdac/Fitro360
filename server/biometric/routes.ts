import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getAdapter, SUPPORTED_BRANDS, PLANNED_BRANDS } from "./registry";
import { evaluateAccess, resolveMemberFromExternalRef } from "./access-engine";
import { insertDeviceSchema, insertBiometricTemplateSchema } from "@shared/schema";
import type { AccessDecision } from "./types";

// ─── Helpers shared with main routes ────────────────────────────────────────
type AuthUser = { id: string; role: string; tenantId?: string; firstName?: string; lastName?: string };
type AuthedRequest = Request & { user?: AuthUser; rawBody?: Buffer | string };
function paramId(req: Request): string {
  return String(req.params.id);
}
function getUser(req: Request): AuthUser | undefined {
  return (req as AuthedRequest).user;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getUser(req)) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getUser(req);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

// Webhook routes mount this raw-body parser so signature verification
// can hash the exact bytes the device sent us, not a JSON re-serialisation.
const rawTextParser = express.raw({ type: "*/*", limit: "5mb" });

export function registerBiometricRoutes(app: Express, authMiddleware: any) {
  // ─── Brand metadata for UI ────────────────────────────────
  app.get("/api/biometric/brands", authMiddleware, (_req, res) => {
    return res.json({
      supported: SUPPORTED_BRANDS,
      planned: PLANNED_BRANDS,
    });
  });

  // ─── Devices CRUD ────────────────────────────────────────
  app.get(
    "/api/devices",
    authMiddleware,
    requireRole("gym_owner", "manager", "sales_executive"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      if (!user.tenantId) return res.json([]);
      const list = await storage.getDevicesByTenant(user.tenantId);
      // Never leak the device secret over the wire.
      return res.json(list.map(({ secret, passwordEnc, ...d }) => d));
    },
  );

  app.post(
    "/api/devices",
    authMiddleware,
    requireRole("gym_owner", "manager"),
    async (req: Request, res: Response) => {
      try {
        const user = getUser(req)!;
        if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
        const body = insertDeviceSchema
          .omit({ secret: true, tenantId: true, status: true })
          .parse(req.body);
        if (!getAdapter(body.brand)) {
          return res.status(400).json({
            message: `Brand '${body.brand}' not yet supported. Supported: ${SUPPORTED_BRANDS.join(", ")}`,
          });
        }
        const secret = crypto.randomBytes(32).toString("hex");
        const created = await storage.createDevice({
          ...body,
          tenantId: user.tenantId,
          secret,
          status: "offline",
        });
        await storage.createActivity({
          tenantId: user.tenantId,
          userId: user.id,
          type: "device_added",
          description: `Device '${created.name}' (${created.brand}) added`,
        });
        // Return secret on creation only so the owner can configure it on the
        // device, but always strip passwordEnc from any response payload.
        const { passwordEnc: _pw, secret: _s, ...safeCreated } = created;
        return res.json({ ...safeCreated, secret });
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );

  app.patch(
    "/api/devices/:id",
    authMiddleware,
    requireRole("gym_owner", "manager"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const device = await storage.getDevice(paramId(req));
      if (!device || device.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Device not found" });
      }
      const allowed = z
        .object({
          name: z.string().optional(),
          model: z.string().optional(),
          branchId: z.string().optional(),
          ipAddress: z.string().optional(),
          port: z.number().optional(),
          username: z.string().optional(),
          mode: z.enum(["cloud_push", "local_relay"]).optional(),
          doorOpenSeconds: z.number().min(1).max(60).optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);
      const updated = await storage.updateDevice(device.id, allowed);
      const safe = updated ? { ...updated, secret: undefined, passwordEnc: undefined } : null;
      return res.json(safe);
    },
  );

  app.delete(
    "/api/devices/:id",
    authMiddleware,
    requireRole("gym_owner", "manager"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const device = await storage.getDevice(paramId(req));
      if (!device || device.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Device not found" });
      }
      await storage.deleteDevice(device.id);
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: user.id,
        type: "device_removed",
        description: `Device '${device.name}' (${device.brand}) removed`,
      });
      return res.json({ ok: true });
    },
  );

  // Manual door-open from admin UI (test button or remote unlock).
  // Idempotency: same user + device within 3 seconds collapses to one open.
  app.post(
    "/api/devices/:id/open-door",
    authMiddleware,
    requireRole("gym_owner", "manager"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const device = await storage.getDevice(paramId(req));
      if (!device || device.tenantId !== user.tenantId) {
        return res.status(404).json({ message: "Device not found" });
      }
      const adapter = getAdapter(device.brand);
      if (!adapter) return res.status(400).json({ message: "No adapter for brand" });
      await adapter.enqueueOpenDoor(device);
      await storage.createAccessEvent({
        tenantId: device.tenantId,
        branchId: device.branchId,
        deviceId: device.id,
        memberId: null,
        eventType: "entry",
        decision: "allow",
        reason: `Manual unlock by ${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        capturedAt: new Date(),
      });
      return res.json({ ok: true });
    },
  );

  // ─── Biometric templates ─────────────────────────────────
  app.get(
    "/api/biometric/templates",
    authMiddleware,
    requireRole("gym_owner", "manager", "sales_executive"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      if (!user.tenantId) return res.json([]);
      const list = await storage.getTemplatesByTenant(user.tenantId);
      // Strip the raw template blob AND the face image preview from list
      // views; both are biometric data and only the by-id read should expose
      // them to authorised callers.
      return res.json(list.map(({ templateData, imagePreviewUrl, ...t }) => t));
    },
  );

  app.get(
    "/api/biometric/templates/by-member/:memberId",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const member = await storage.getMember(String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const isSelf = member.userId && member.userId === user.id;
      const isStaff = ["gym_owner", "manager", "sales_executive", "trainer"].includes(user.role);
      if (!isSelf && !(isStaff && member.tenantId === user.tenantId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const list = await storage.getTemplatesByMember(member.id);
      return res.json(list.map(({ templateData, imagePreviewUrl, ...t }) => t));
    },
  );

  app.post(
    "/api/biometric/templates",
    authMiddleware,
    requireRole("gym_owner", "manager", "sales_executive"),
    async (req: Request, res: Response) => {
      try {
        const user = getUser(req)!;
        if (!user.tenantId) return res.status(400).json({ message: "No tenant" });
        const body = z
          .object({
            memberId: z.string().min(1),
            deviceIds: z.array(z.string()).min(1, "Pick at least one device"),
            templateType: z.enum(["face", "fingerprint", "card"]).default("face"),
            templateData: z.string().min(1, "Template data required"),
            externalRef: z.string().optional(),
            imagePreviewUrl: z.string().optional(),
            consentGiven: z.boolean().default(false),
          })
          .parse(req.body);

        const member = await storage.getMember(body.memberId);
        if (!member || member.tenantId !== user.tenantId) {
          return res.status(404).json({ message: "Member not found" });
        }

        // Default externalRef to the member's id so we always have a stable
        // device-side identifier even when the operator doesn't supply one.
        const externalRef = body.externalRef || member.id.replace(/-/g, "").slice(0, 16);

        const created: any[] = [];
        for (const deviceId of body.deviceIds) {
          const device = await storage.getDevice(deviceId);
          if (!device || device.tenantId !== user.tenantId) continue;
          const adapter = getAdapter(device.brand);
          if (!adapter) continue;

          const tpl = await storage.createTemplate({
            tenantId: user.tenantId,
            memberId: member.id,
            deviceId: device.id,
            templateType: body.templateType,
            templateData: body.templateData,
            externalRef,
            imagePreviewUrl: body.imagePreviewUrl,
            status: "active",
            syncStatus: "pending",
            consentGiven: body.consentGiven,
            consentAt: body.consentGiven ? new Date() : null,
          });

          if (adapter.pushTemplate) {
            const result = await adapter.pushTemplate(
              device,
              { id: member.id, firstName: member.firstName, lastName: member.lastName },
              { externalRef, templateData: body.templateData, templateType: body.templateType },
            );
            await storage.updateTemplate(tpl.id, {
              syncStatus: result.ok ? "pushed" : "failed",
              syncError: result.error,
            });
          }
          // Strip biometric payloads before echoing back to the API caller.
          const { templateData: _td, imagePreviewUrl: _ip, ...safeTpl } = tpl;
          created.push(safeTpl);
        }

        await storage.createActivity({
          tenantId: user.tenantId,
          userId: user.id,
          type: "biometric_enrolled",
          description: `${member.firstName} ${member.lastName} enrolled on ${created.length} device(s)`,
        });

        return res.json({ created });
      } catch (error: any) {
        return res.status(400).json({ message: error.message });
      }
    },
  );

  app.delete(
    "/api/biometric/templates/:id",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const tpl = await storage.getTemplate(paramId(req));
      if (!tpl) return res.status(404).json({ message: "Template not found" });
      const member = await storage.getMember(tpl.memberId);
      const isSelf = member?.userId && member.userId === user.id;
      const isStaff = ["gym_owner", "manager"].includes(user.role) && tpl.tenantId === user.tenantId;
      if (!isSelf && !isStaff) return res.status(403).json({ message: "Forbidden" });
      // Push delete to device too, then remove from DB.
      if (tpl.deviceId && tpl.externalRef) {
        const device = await storage.getDevice(tpl.deviceId);
        if (device) {
          const adapter = getAdapter(device.brand);
          if (adapter?.deleteTemplate) {
            await adapter.deleteTemplate(device, tpl.externalRef);
          }
        }
      }
      await storage.deleteTemplate(tpl.id);
      return res.json({ ok: true });
    },
  );

  // ─── Access events ───────────────────────────────────────
  // Tenant-wide log is staff-only. Members see their own entries via
  // /api/access-events/by-member/:memberId (which checks self or staff).
  app.get(
    "/api/access-events",
    authMiddleware,
    requireRole("gym_owner", "manager"),
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      if (!user.tenantId) return res.json([]);
      const qStr = (k: string): string | undefined => {
        const v = req.query[k];
        return typeof v === "string" ? v : undefined;
      };
      const limitStr = qStr("limit");
      const opts = {
        branchId: qStr("branchId"),
        deviceId: qStr("deviceId"),
        memberId: qStr("memberId"),
        decision: qStr("decision"),
        limit: limitStr ? Math.min(500, parseInt(limitStr, 10)) : 200,
      };
      const list = await storage.getAccessEventsByTenant(user.tenantId, opts);
      // Strip per-event raw payload + photo preview from list views.
      return res.json(list.map(({ rawPayload, photoUrl, ...e }) => e));
    },
  );

  app.get(
    "/api/access-events/by-member/:memberId",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = getUser(req)!;
      const member = await storage.getMember(String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const isSelf = member.userId && member.userId === user.id;
      const isStaff = ["gym_owner", "manager"].includes(user.role);
      if (!isSelf && !(isStaff && member.tenantId === user.tenantId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const list = await storage.getAccessEventsByMember(member.id, 100);
      // Strip raw payload + photo preview before returning to clients.
      return res.json(list.map(({ rawPayload, photoUrl, ...e }) => e));
    },
  );

  // ─── Pending door commands (relay polling endpoint) ──────
  // The on-prem relay (or a future device-direct dispatcher) calls this
  // periodically with the device's serial+secret to drain the queue.
  app.get(
    "/api/biometric/commands/:serial",
    async (req: Request, res: Response) => {
      const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
      const device = await storage.getDeviceBySerial(String(req.params.serial));
      if (!device || !device.isActive) return res.status(404).json({ message: "Device not found" });
      // Verify HMAC of an empty body so the relay only needs to sign the URL path
      const expected = crypto
        .createHmac("sha256", device.secret)
        .update(`GET:/api/biometric/commands/${req.params.serial}`)
        .digest("hex");
      // Constant-time compare to prevent signature-recovery via response timing.
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      const sigOk =
        sig.length > 0 &&
        sigBuf.length === expBuf.length &&
        crypto.timingSafeEqual(sigBuf, expBuf);
      if (!sigOk) {
        return res.status(401).json({ message: "Bad signature" });
      }
      const cmds = await storage.getPendingDoorCommands(device.id);
      for (const c of cmds) {
        await storage.markDoorCommandPickedUp(c.id);
      }
      await storage.updateDevice(device.id, {
        status: "online",
        lastSeenAt: new Date(),
        lastError: null,
      });
      return res.json({ commands: cmds });
    },
  );

  // Relay acks completion of a queued command. Body: { status: "done"|"failed", error? }
  // Authenticated via HMAC of `POST:/api/biometric/commands/:id/ack` signed
  // with the owning device's secret. This prevents anyone who guesses a
  // command id from marking commands done/failed. (Global express.json() has
  // already parsed the body by the time we get here.)
  app.post(
    "/api/biometric/commands/:id/ack",
    async (req: Request, res: Response) => {
      try {
        const cmdId = String(req.params.id);
        const sig = (req.headers["x-fitro360-sig"] as string | undefined) || "";
        if (!sig) return res.status(401).json({ message: "Signature required" });

        // Look up the command to find its device, then verify HMAC against
        // that device's secret. Without this we'd have no way to know which
        // secret to check.
        const cmd = await storage.getDoorCommand(cmdId);
        if (!cmd) return res.status(404).json({ message: "Command not found" });
        const device = await storage.getDevice(cmd.deviceId);
        if (!device) return res.status(404).json({ message: "Device not found" });

        const expected = crypto
          .createHmac("sha256", device.secret)
          .update(`POST:/api/biometric/commands/${cmdId}/ack`)
          .digest("hex");
        let sigOk = false;
        try {
          sigOk =
            sig.length === expected.length &&
            crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
          sigOk = false;
        }
        if (!sigOk) return res.status(401).json({ message: "Bad signature" });

        const body = (req.body || {}) as { status?: string; error?: string };
        const status: "done" | "failed" = body.status === "failed" ? "failed" : "done";
        await storage.markDoorCommandComplete(cmdId, status, body.error);
        return res.json({ ok: true });
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }
    },
  );

  // ─── Brand webhooks (push-protocol ingress) ──────────────
  //
  // Hikvision sends JSON. The global express.json() in server/index.ts has a
  // verify hook that stashes the raw bytes on req.rawBody, so we don't need a
  // route-level raw parser here — and adding one is actively harmful, because
  // express.json() has already drained the request stream.
  //
  // ZKTeco / ESSL / Realtime ADMS firmware sends text/plain attlog payloads
  // that no global parser touches; rawTextParser fires for those and populates
  // req.body as a Buffer.
  //
  // ADMS protocol uses three distinct endpoints, each registered explicitly
  // BEFORE the catch-all so they don't all funnel into the event handler:
  //   POST /iclock/cdata        — event upload (HMAC-verified webhook)
  //   GET  /iclock/getrequest   — device polls for queued commands
  //   POST /iclock/devicecmd    — device acks command completion
  for (const brand of ["zkteco", "essl", "realtime"]) {
    app.post(
      `/api/biometric/${brand}/webhook`,
      rawTextParser,
      async (req: Request, res: Response) => handleWebhook(brand, req, res),
    );
    app.post(
      `/api/biometric/${brand}/iclock/cdata`,
      rawTextParser,
      async (req: Request, res: Response) => handleWebhook(brand, req, res),
    );
    app.get(
      `/api/biometric/${brand}/iclock/getrequest`,
      async (req: Request, res: Response) => handleAdmsGetRequest(brand, req, res),
    );
    app.post(
      `/api/biometric/${brand}/iclock/devicecmd`,
      rawTextParser,
      async (req: Request, res: Response) => handleAdmsDeviceCmd(brand, req, res),
    );
    // Catch-all for liveness pings (/iclock/registry, /iclock/ping, etc.)
    app.all(
      `/api/biometric/${brand}/iclock/*path`,
      rawTextParser,
      async (req: Request, res: Response) => handleWebhook(brand, req, res),
    );
  }

  app.post(
    "/api/biometric/hikvision/webhook",
    async (req: Request, res: Response) => handleWebhook("hikvision", req, res),
  );
}

// ─── ADMS protocol command dispatch ─────────────────────────
// ZKTeco/ESSL/Realtime devices in cloud-push mode poll
// /iclock/getrequest with their SerialNumber. We respond with any pending
// queued commands in ADMS line-protocol format ("C:<id>:<CMD>\n") and mark
// them as picked-up so they aren't redelivered. The device then runs the
// command and POSTs back to /iclock/devicecmd with status.
//
// Auth: every ADMS command/ack call MUST present `pwd=<device.secret>`
// (set on the device's ADMS server config) OR the same secret in the
// `X-Fitro360-Sig` header. Constant-time compared. Serial alone is NEVER
// sufficient — leaked URLs must not be able to drain or ack commands.
function admsAuthOk(device: any, req: Request): boolean {
  const pwd = (req.query.pwd as string | undefined) || (req.headers["x-fitro360-sig"] as string | undefined);
  if (!pwd || !device?.secret) return false;
  try {
    const a = Buffer.from(pwd);
    const b = Buffer.from(device.secret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function admsCommandLine(c: any): string {
  // ADMS command syntax used by ZKTeco-family firmware. Keep payload short;
  // long enrol payloads can be issued as multi-line DATA UPDATE commands.
  if (c.command === "open") {
    const seconds = Number(c.payload?.seconds ?? 5);
    return `C:${c.id}:AC_UNLOCK\tDoor=1\tHoldTime=${seconds}`;
  }
  if (c.command === "enroll") {
    const p = c.payload || {};
    return `C:${c.id}:DATA UPDATE FINGERTMP\tPIN=${p.externalRef}\tFID=0\tValid=1\tTMP=${p.templateData}`;
  }
  if (c.command === "delete") {
    const p = c.payload || {};
    return `C:${c.id}:DATA DELETE USER\tPIN=${p.externalRef}`;
  }
  return `C:${c.id}:LOG`;
}

async function handleAdmsGetRequest(brand: string, req: Request, res: Response) {
  const serial = (req.query.SN as string) || "";
  if (!serial) return res.status(400).type("text/plain").send("ERROR");
  const device = await storage.getDeviceBySerial(serial);
  if (!device || !device.isActive || device.brand !== brand) {
    return res.status(404).type("text/plain").send("ERROR");
  }
  if (!admsAuthOk(device, req)) {
    return res.status(401).type("text/plain").send("ERROR");
  }
  const cmds = await storage.getPendingDoorCommands(device.id);
  await storage.updateDevice(device.id, {
    status: "online",
    lastSeenAt: new Date(),
    lastError: null,
  });
  if (cmds.length === 0) {
    return res.type("text/plain").send("OK\n");
  }
  const lines: string[] = [];
  for (const c of cmds) {
    lines.push(admsCommandLine(c));
    await storage.markDoorCommandPickedUp(c.id);
  }
  return res.type("text/plain").send(lines.join("\n") + "\n");
}

async function handleAdmsDeviceCmd(brand: string, req: Request, res: Response) {
  const serial = (req.query.SN as string) || "";
  if (!serial) return res.status(400).type("text/plain").send("ERROR");
  const device = await storage.getDeviceBySerial(serial);
  if (!device || !device.isActive || device.brand !== brand) {
    return res.status(404).type("text/plain").send("ERROR");
  }
  if (!admsAuthOk(device, req)) {
    return res.status(401).type("text/plain").send("ERROR");
  }
  const reqBody = (req as AuthedRequest).body;
  const bodyStr = Buffer.isBuffer(reqBody) ? reqBody.toString("utf8") : String(reqBody ?? "");
  const lines = bodyStr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const ln of lines) {
    const params: Record<string, string> = {};
    for (const kv of ln.split(/[&\t]/)) {
      const idx = kv.indexOf("=");
      if (idx > 0) params[kv.slice(0, idx)] = decodeURIComponent(kv.slice(idx + 1));
    }
    const id = params.ID || params.Id || params.id;
    if (!id) continue;
    const owned = await storage.getDoorCommand(id);
    if (!owned || owned.deviceId !== device.id) continue;
    const rc = params.Return ?? params.RC ?? "0";
    const status: "done" | "failed" = rc === "0" ? "done" : "failed";
    await storage.markDoorCommandComplete(id, status, status === "failed" ? `rc=${rc}` : undefined);
  }
  await storage.updateDevice(device.id, {
    status: "online",
    lastSeenAt: new Date(),
    lastError: null,
  });
  return res.type("text/plain").send("OK\n");
}

async function handleWebhook(brand: string, req: Request, res: Response) {
  const adapter = getAdapter(brand);
  if (!adapter) return res.status(400).json({ message: "Unsupported brand" });

  const serial = (req.query.SN as string) || (req.query.serial as string) || (req.headers["x-device-serial"] as string);
  if (!serial) {
    return res.status(400).json({ message: "Device serial missing" });
  }
  const device = await storage.getDeviceBySerial(serial);
  if (!device || !device.isActive) {
    return res.status(404).json({ message: "Device not registered" });
  }
  if (device.brand !== brand) {
    return res.status(400).json({ message: "Brand mismatch" });
  }

  // Resolve raw bytes. ZKTeco/ESSL/Realtime use the route-level raw parser
  // (req.body is a Buffer). Hikvision is JSON-parsed by the global parser
  // and the same global parser stashes the raw bytes on req.rawBody.
  const reqBody = (req as AuthedRequest).body;
  const rawBodyHook = (req as AuthedRequest).rawBody;
  let rawBuf: Buffer;
  if (Buffer.isBuffer(reqBody)) {
    rawBuf = reqBody;
  } else if (Buffer.isBuffer(rawBodyHook)) {
    rawBuf = rawBodyHook;
  } else if (typeof rawBodyHook === "string") {
    rawBuf = Buffer.from(rawBodyHook);
  } else {
    rawBuf = Buffer.alloc(0);
  }

  const ok = await adapter.verifyRequest(
    { headers: req.headers, rawBody: rawBuf, query: req.query as Record<string, string | string[] | undefined> },
    device,
  );
  if (!ok) {
    await storage.updateDevice(device.id, { lastError: "Bad signature" });
    return res.status(401).json({ message: "Bad signature" });
  }

  // Liveness ping
  await storage.updateDevice(device.id, {
    status: "online",
    lastSeenAt: new Date(),
    lastError: null,
  });

  // For JSON-bearing brands the global parser already produced an object;
  // pass it straight through. For raw-text brands the adapter parses bytes.
  const parsedBody = !Buffer.isBuffer(reqBody) ? reqBody : null;

  const ev = adapter.parseEvent({
    body: parsedBody,
    rawBody: rawBuf,
    query: req.query as Record<string, unknown>,
  });

  if (!ev) {
    // Heartbeat / non-event ping — just ack.
    const reply = adapter.buildReply({ allow: true, reason: "ack" }, {});
    res.set("Content-Type", reply.contentType);
    return res.send(reply.body);
  }

  // Idempotency (per-device event id). Atomic claim — concurrent duplicate
  // deliveries race to insert the same primary key; only one wins, the rest
  // see claimed=false and short-circuit so we never double-write attendance
  // or fire two door commands for one swipe.
  const dedupeKey = `${device.id}:${ev.nativeEventId}`;
  const claimed = await storage.claimBiometricEvent(dedupeKey, device.id);
  if (!claimed) {
    const reply = adapter.buildReply({ allow: true, reason: "duplicate" }, {});
    res.set("Content-Type", reply.contentType);
    return res.send(reply.body);
  }

  let decision: AccessDecision = { allow: false, reason: "Unknown member" };
  let memberId: string | null = null;
  if (ev.externalRef) {
    memberId = await resolveMemberFromExternalRef(device.id, ev.externalRef);
    if (memberId) {
      decision = await evaluateAccess(memberId, device);
    }
  }

  // Record the event regardless of outcome.
  await storage.createAccessEvent({
    tenantId: device.tenantId,
    branchId: device.branchId,
    deviceId: device.id,
    memberId,
    externalRef: ev.externalRef || null,
    eventType: decision.allow ? "entry" : ev.eventType === "unknown_face" ? "unknown_face" : "denied",
    decision: decision.allow ? "allow" : "deny",
    reason: decision.reason,
    capturedAt: ev.capturedAt,
    photoUrl: ev.photoUrl,
    rawPayload: ev.raw,
  });

  // If allowed, write attendance (with the device that recorded the entry)
  // and queue a door open. We only enqueue one door command per device per
  // 3-second window (idempotency handled at storage layer).
  if (decision.allow && memberId) {
    await storage.createAttendance({
      tenantId: device.tenantId,
      memberId,
      method: "biometric",
      branchId: device.branchId ?? undefined,
      deviceId: device.id,
      checkInTime: ev.capturedAt,
    });
    await adapter.enqueueOpenDoor(device);
  }

  // dedupe row already inserted above by claimBiometricEvent — no second write needed.

  const reply = adapter.buildReply(decision, {
    openDoor: decision.allow,
    message: decision.allow ? "Welcome" : decision.reason,
    doorOpenSeconds: device.doorOpenSeconds ?? 5,
  });
  res.set("Content-Type", reply.contentType);
  return res.send(reply.body);
}
