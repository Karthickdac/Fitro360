import { describe, it, expect, beforeEach } from "vitest";
import { evaluateAccess } from "../../server/biometric/access-engine";
import { storage } from "../../server/storage";

// "Pipeline" tests: simulate the route-layer behaviour after the adapter
// has parsed an event. We verify the engine + storage interactions that
// the webhook handler relies on (decision → createAccessEvent →
// idempotency on door command). We don't call the real HTTP route here
// because that pulls in express + the seed loop; the adapter test file
// already covers the request-parsing side.
const store: any = (globalThis as any).__store;
const newId = (globalThis as any).__newId;
const reset = (globalThis as any).__resetStore;

beforeEach(reset);

describe("end-to-end access decision → side effects", () => {
  it("denies entry and persists the access event with the deny reason", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const dev: any = { id: newId("dev"), tenantId: t.id, brand: "zkteco", secret: "s", isActive: true, branchId: null, doorOpenSeconds: 5 };
    store.devices.set(dev.id, dev);
    const m: any = {
      id: newId("m"), tenantId: t.id, status: "frozen",
      membershipType: "monthly", waiverAcceptedAt: new Date(), firstName: "X", lastName: "Y",
    };
    store.members.set(m.id, m);

    const decision = await evaluateAccess(m.id, dev);
    expect(decision.allow).toBe(false);

    // Mirror what the webhook handler does after evaluate:
    const persisted = await storage.createAccessEvent({
      tenantId: dev.tenantId, branchId: dev.branchId, deviceId: dev.id, memberId: m.id,
      eventType: "denied", decision: "deny", reason: decision.reason,
      capturedAt: new Date(), externalRef: "12345",
    } as any);
    expect(persisted.decision).toBe("deny");
    expect(persisted.reason).toMatch(/frozen/i);
  });

  it("door-open is idempotent within a 3-second window", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const dev: any = { id: newId("dev"), tenantId: t.id, brand: "zkteco", secret: "s", isActive: true, doorOpenSeconds: 5 };
    store.devices.set(dev.id, dev);

    const idem = `dev:${dev.id}:door:${Math.floor(Date.now() / 3000)}`;
    const a = await (storage as any).createDoorCommand({
      tenantId: dev.tenantId, deviceId: dev.id, command: "open", payload: {}, idempotencyKey: idem, status: "pending",
    });
    const b = await (storage as any).createDoorCommand({
      tenantId: dev.tenantId, deviceId: dev.id, command: "open", payload: {}, idempotencyKey: idem, status: "pending",
    });
    expect(a.id).toBe(b.id);
    expect(store.doorCmds.size).toBe(1);
  });

  it("biometric event dedupe via claim wins exactly once", async () => {
    const id = "native-evt-123";
    const first = await (storage as any).claimBiometricEvent(id, "dev-1");
    const second = await (storage as any).claimBiometricEvent(id, "dev-1");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("retention: deleteAccessEventsOlderThan removes only old rows", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const old: any = { id: newId("e"), tenantId: t.id, capturedAt: new Date(Date.now() - 365 * 86_400_000), decision: "allow", eventType: "entry" };
    const fresh: any = { id: newId("e"), tenantId: t.id, capturedAt: new Date(), decision: "allow", eventType: "entry" };
    store.events.set(old.id, old);
    store.events.set(fresh.id, fresh);

    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const n = await (storage as any).deleteAccessEventsOlderThan(t.id, cutoff);
    expect(n).toBe(1);
    expect(store.events.has(fresh.id)).toBe(true);
    expect(store.events.has(old.id)).toBe(false);
  });

  it("upsertUnmatchedEnrolment is idempotent on (tenant,device,externalRef)", async () => {
    const a = await (storage as any).upsertUnmatchedEnrolment({
      tenantId: "t1", deviceId: "d1", externalRef: "999", displayName: "Bob",
    });
    const b = await (storage as any).upsertUnmatchedEnrolment({
      tenantId: "t1", deviceId: "d1", externalRef: "999", displayName: "Bob (renamed)",
    });
    expect(a.id).toBe(b.id);
    expect(b.displayName).toBe("Bob (renamed)");
    expect(store.unmatched.size).toBe(1);
  });
});
