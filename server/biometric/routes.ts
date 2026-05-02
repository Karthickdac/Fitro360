import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getAdapter, SUPPORTED_BRANDS, PLANNED_BRANDS } from "./registry";
import { evaluateAccess, resolveMemberFromExternalRef } from "./access-engine";
import { insertDeviceSchema, insertBiometricTemplateSchema } from "@shared/schema";

// ─── Helpers shared with main routes ────────────────────────────────────────
function paramId(req: Request): string {
  return String(req.params.id);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
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
      const user = (req as any).user;
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
        const user = (req as any).user;
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
        } as any);
        await storage.createActivity({
          tenantId: user.tenantId,
          userId: user.id,
          type: "device_added",
          description: `Device '${created.name}' (${created.brand}) added`,
        });
        // Return secret on creation only so the owner can configure it on the
        // device, but always strip passwordEnc from any response payload.
        const { passwordEnc: _pw, ...safeCreated } = created as any;
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
      const user = (req as any).user;
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
      const updated = await storage.updateDevice(device.id, allowed as any);
      const safe = updated ? { ...updated, secret: undefined, passwordEnc: undefined } : null;
      return res.json(safe);
    },
  );

  app.delete(
    "/api/devices/:id",
    authMiddleware,
    requireRole("gym_owner"),
    async (req: Request, res: Response) => {
      const user = (req as any).user;
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
    requireRole("gym_owner", "manager", "trainer"),
    async (req: Request, res: Response) => {
      const user = (req as any).user;
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
        reason: `Manual unlock by ${user.firstName} ${user.lastName}`,
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
      const user = (req as any).user;
      if (!user.tenantId) return res.json([]);
      const list = await storage.getTemplatesByTenant(user.tenantId);
      // Strip the raw template blob from list views; only fetch by id when needed.
      return res.json(list.map(({ templateData, ...t }) => t));
    },
  );

  app.get(
    "/api/biometric/templates/by-member/:memberId",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      const member = await storage.getMember(String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const isSelf = member.userId && member.userId === user.id;
      const isStaff = ["gym_owner", "manager", "sales_executive", "trainer"].includes(user.role);
      if (!isSelf && !(isStaff && member.tenantId === user.tenantId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const list = await storage.getTemplatesByMember(member.id);
      return res.json(list.map(({ templateData, ...t }) => t));
    },
  );

  app.post(
    "/api/biometric/templates",
    authMiddleware,
    requireRole("gym_owner", "manager", "sales_executive"),
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
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
          } as any);

          if (adapter.pushTemplate) {
            const result = await adapter.pushTemplate(
              device,
              { id: member.id, firstName: member.firstName, lastName: member.lastName },
              { externalRef, templateData: body.templateData, templateType: body.templateType },
            );
            await storage.updateTemplate(tpl.id, {
              syncStatus: result.ok ? "pushed" : "failed",
              syncError: result.error,
            } as any);
          }
          created.push({ ...tpl, templateData: undefined });
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
      const user = (req as any).user;
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
    requireRole("gym_owner", "manager", "sales_executive", "trainer"),
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      if (!user.tenantId) return res.json([]);
      const qStr = (k: string) => {
        const v = (req.query as any)[k];
        return typeof v === "string" ? v : undefined;
      };
      const opts: any = {
        branchId: qStr("branchId"),
        deviceId: qStr("deviceId"),
        memberId: qStr("memberId"),
        decision: qStr("decision"),
        limit: qStr("limit") ? Math.min(500, parseInt(qStr("limit") as string)) : 200,
      };
      const list = await storage.getAccessEventsByTenant(user.tenantId, opts);
      return res.json(list);
    },
  );

  app.get(
    "/api/access-events/by-member/:memberId",
    authMiddleware,
    async (req: Request, res: Response) => {
      const user = (req as any).user;
      const member = await storage.getMember(String(req.params.memberId));
      if (!member) return res.status(404).json({ message: "Member not found" });
      const isSelf = member.userId && member.userId === user.id;
      const isStaff = ["gym_owner", "manager", "sales_executive", "trainer"].includes(user.role);
      if (!isSelf && !(isStaff && member.tenantId === user.tenantId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const list = await storage.getAccessEventsByMember(member.id, 100);
      return res.json(list);
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
      if (!sig || sig !== expected) {
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
      } as any);
      return res.json({ commands: cmds });
    },
  );

  // Relay acks completion of a queued command. Body: { status: "done"|"failed", error? }
  // We trust this endpoint when accompanied by a valid device-secret HMAC over
  // the command id (relay knows its devices' secrets).
  app.post(
    "/api/biometric/commands/:id/ack",
    express.json({ limit: "16kb" }),
    async (req: Request, res: Response) => {
      try {
        const body = (req.body || {}) as { status?: string; error?: string };
        const status: "done" | "failed" = body.status === "failed" ? "failed" : "done";
        await storage.markDoorCommandComplete(String(req.params.id), status, body.error);
        return res.json({ ok: true });
      } catch (e: any) {
        return res.status(400).json({ message: e.message });
      }
    },
  );

  // ─── Brand webhooks (push-protocol ingress) ──────────────
  // ZKTeco / ESSL / Realtime ADMS path: device POSTs to /iclock/cdata?SN=...
  for (const brand of ["zkteco", "essl", "realtime"]) {
    app.post(
      `/api/biometric/${brand}/webhook`,
      rawTextParser,
      async (req: Request, res: Response) => handleWebhook(brand, req, res),
    );
    // ADMS-style path some firmware insists on
    app.all(
      `/api/biometric/${brand}/iclock/*path`,
      rawTextParser,
      async (req: Request, res: Response) => handleWebhook(brand, req, res),
    );
  }

  // Hikvision: ingest as RAW so HMAC signs the exact bytes the device sent;
  // we parse JSON inside the handler from the same buffer.
  app.post(
    "/api/biometric/hikvision/webhook",
    rawTextParser,
    async (req: Request, res: Response) => handleWebhook("hikvision", req, res),
  );
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

  const rawBody: any = (req as any).body;
  // Always materialise raw bytes so HMAC verification signs exactly what the
  // device sent. Both ZKTeco and Hikvision routes use the raw parser, so
  // req.body is a Buffer here.
  const rawBuf: Buffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === "string" ? rawBody : "");

  const ok = await adapter.verifyRequest(
    { headers: req.headers as any, rawBody: rawBuf, query: req.query as any },
    device,
  );
  if (!ok) {
    await storage.updateDevice(device.id, { lastError: "Bad signature" } as any);
    return res.status(401).json({ message: "Bad signature" });
  }

  // Liveness ping
  await storage.updateDevice(device.id, {
    status: "online",
    lastSeenAt: new Date(),
    lastError: null,
  } as any);

  // Parse JSON body for brands that send JSON (e.g. Hikvision); plain-text
  // adapters (ZKTeco/ESSL) parse from rawBody themselves.
  let parsedBody: any = null;
  if (brand === "hikvision") {
    try { parsedBody = JSON.parse(rawBuf.toString("utf8")); } catch { parsedBody = null; }
  }

  const ev = adapter.parseEvent({
    body: parsedBody,
    rawBody: rawBuf,
    query: req.query as any,
  });

  if (!ev) {
    // Heartbeat / non-event ping — just ack.
    const reply = adapter.buildReply({ allow: true, reason: "ack" }, {});
    res.set("Content-Type", reply.contentType);
    return res.send(reply.body);
  }

  // Idempotency (per-device event id)
  const dedupeKey = `${device.id}:${ev.nativeEventId}`;
  if (await storage.isBiometricEventProcessed(dedupeKey)) {
    const reply = adapter.buildReply({ allow: true, reason: "duplicate" }, {});
    res.set("Content-Type", reply.contentType);
    return res.send(reply.body);
  }

  let decision = { allow: false, reason: "Unknown member" } as any;
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

  // If allowed, write attendance and queue door open.
  if (decision.allow && memberId) {
    await storage.createAttendance({
      tenantId: device.tenantId,
      memberId,
      method: "biometric",
      branchId: device.branchId ?? undefined,
      checkInTime: ev.capturedAt,
    } as any);
    await adapter.enqueueOpenDoor(device);
  }

  await storage.markBiometricEventProcessed(dedupeKey, device.id);

  const reply = adapter.buildReply(decision, {
    openDoor: decision.allow,
    message: decision.allow ? "Welcome" : decision.reason,
    doorOpenSeconds: device.doorOpenSeconds ?? 5,
  });
  res.set("Content-Type", reply.contentType);
  return res.send(reply.body);
}
