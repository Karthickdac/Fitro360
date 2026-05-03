import { describe, it, expect, beforeEach } from "vitest";
import { runRetentionSweep } from "../../server/biometric/retention";

const store: any = (globalThis as any).__store;
const newId = (globalThis as any).__newId;
const reset = (globalThis as any).__resetStore;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(reset);

describe("GDPR retention sweeper", () => {
  it("deletes templates for members inactive/transferred for >30 days (using statusUpdatedAt)", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const dev: any = { id: newId("dev"), tenantId: t.id, brand: "zkteco", secret: "s", isActive: true };
    store.devices.set(dev.id, dev);

    // statusUpdatedAt is the source of truth for the 30-day grace window.
    // We deliberately leave membershipEnd in the future for two of these
    // members to prove the sweeper is NOT relying on membershipEnd.
    const oldInactive: any = {
      id: newId("m"), tenantId: t.id, status: "inactive",
      membershipEnd: daysAgo(-30), statusUpdatedAt: daysAgo(45),
      firstName: "A", lastName: "Z", membershipType: "monthly",
    };
    const recentInactive: any = {
      id: newId("m"), tenantId: t.id, status: "inactive",
      membershipEnd: daysAgo(-30), statusUpdatedAt: daysAgo(10),
      firstName: "B", lastName: "Z", membershipType: "monthly",
    };
    const transferredOld: any = {
      id: newId("m"), tenantId: t.id, status: "transferred",
      membershipEnd: daysAgo(-30), statusUpdatedAt: daysAgo(90),
      firstName: "C", lastName: "Z", membershipType: "monthly",
    };
    const active: any = {
      id: newId("m"), tenantId: t.id, status: "active",
      membershipEnd: daysAgo(-30), statusUpdatedAt: daysAgo(1),
      firstName: "D", lastName: "Z", membershipType: "monthly",
    };
    for (const m of [oldInactive, recentInactive, transferredOld, active]) store.members.set(m.id, m);

    for (const m of [oldInactive, recentInactive, transferredOld, active]) {
      const tpl: any = {
        id: newId("tpl"), tenantId: t.id, deviceId: dev.id, memberId: m.id,
        externalRef: `ref-${m.id}`, status: "active",
      };
      store.templates.set(tpl.id, tpl);
    }

    const r = await runRetentionSweep();
    expect(r.templatesDeleted).toBe(2);

    const remaining = Array.from(store.templates.values()) as any[];
    const memberIds = remaining.map((t) => t.memberId).sort();
    expect(memberIds).toEqual([recentInactive.id, active.id].sort());
  });

  it("purgeOnCancellation skips the 30-day grace period", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    store.settings.set(t.id, {
      tenantId: t.id, templateRetentionMonths: 24, eventRetentionMonths: 12,
      purgeOnCancellation: true,
    });
    const dev: any = { id: newId("dev"), tenantId: t.id, brand: "zkteco", secret: "s", isActive: true };
    store.devices.set(dev.id, dev);
    const m: any = {
      id: newId("m"), tenantId: t.id, status: "cancelled",
      membershipEnd: daysAgo(2), statusUpdatedAt: daysAgo(2),
      firstName: "X", lastName: "Y", membershipType: "monthly",
    };
    store.members.set(m.id, m);
    store.templates.set("tpl1", { id: "tpl1", tenantId: t.id, deviceId: dev.id, memberId: m.id, externalRef: "r1", status: "active" });

    const r = await runRetentionSweep();
    expect(r.templatesDeleted).toBe(1);
    expect(store.templates.has("tpl1")).toBe(false);
  });

  it("wipes rawPayload + photoUrl from old events but keeps decision metadata", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    store.settings.set(t.id, {
      tenantId: t.id, templateRetentionMonths: 24, eventRetentionMonths: 12,
      purgeOnCancellation: false,
    });

    const oldEvt: any = {
      id: newId("e"), tenantId: t.id, capturedAt: daysAgo(400),
      decision: "allow", eventType: "entry", reason: "ok",
      rawPayload: { foo: "bar" }, photoUrl: "https://example/p.jpg",
    };
    const freshEvt: any = {
      id: newId("e"), tenantId: t.id, capturedAt: daysAgo(10),
      decision: "deny", eventType: "denied", reason: "frozen",
      rawPayload: { x: 1 }, photoUrl: "https://example/q.jpg",
    };
    store.events.set(oldEvt.id, oldEvt);
    store.events.set(freshEvt.id, freshEvt);

    const r = await runRetentionSweep();
    expect(r.eventsWiped).toBe(1);

    expect(store.events.has(oldEvt.id)).toBe(true);
    expect(store.events.has(freshEvt.id)).toBe(true);
    expect(oldEvt.rawPayload).toBeNull();
    expect(oldEvt.photoUrl).toBeNull();
    expect(oldEvt.decision).toBe("allow");
    expect(oldEvt.reason).toBe("ok");
    expect(freshEvt.rawPayload).toEqual({ x: 1 });
    expect(freshEvt.photoUrl).toBe("https://example/q.jpg");
  });

  it("re-running the sweep does not re-count already-wiped event rows", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const oldEvt: any = {
      id: newId("e"), tenantId: t.id, capturedAt: daysAgo(400),
      decision: "allow", eventType: "entry",
      rawPayload: { foo: "bar" }, photoUrl: "x.jpg",
    };
    store.events.set(oldEvt.id, oldEvt);

    const first = await runRetentionSweep();
    expect(first.eventsWiped).toBe(1);
    const second = await runRetentionSweep();
    expect(second.eventsWiped).toBe(0);
  });

  it("writes a compliance audit row when work is done", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const m: any = {
      id: newId("m"), tenantId: t.id, status: "transferred",
      membershipEnd: daysAgo(-30), statusUpdatedAt: daysAgo(90),
      firstName: "X", lastName: "Y", membershipType: "monthly",
    };
    store.members.set(m.id, m);
    store.templates.set("tpl1", { id: "tpl1", tenantId: t.id, memberId: m.id, externalRef: "r1", status: "active" });

    await runRetentionSweep();
    const acts = Array.from(store.activities.values()) as any[];
    expect(acts.some((a) => a.type === "biometric_retention_sweep")).toBe(true);
  });
});
