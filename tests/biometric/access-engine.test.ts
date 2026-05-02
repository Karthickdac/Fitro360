import { describe, it, expect, beforeEach } from "vitest";
import { evaluateAccess, matchAnyBlockRule } from "../../server/biometric/access-engine";

const store: any = (globalThis as any).__store;
const newId = (globalThis as any).__newId;
const reset = (globalThis as any).__resetStore;

function seedTenant(id = newId("t"), isActive = true) {
  const t = { id, name: "Gym", isActive };
  store.tenants.set(id, t);
  return t;
}
function seedDevice(tenantId: string, opts: Partial<any> = {}) {
  const id = newId("dev");
  const d = { id, tenantId, branchId: null, brand: "zkteco", secret: "s", isActive: true, doorOpenSeconds: 5, ...opts };
  store.devices.set(id, d);
  return d;
}
function seedMember(tenantId: string, opts: Partial<any> = {}) {
  const id = newId("m");
  const m: any = {
    id,
    tenantId,
    branchId: null,
    membershipPlanId: null,
    membershipType: "monthly",
    membershipEnd: new Date(Date.now() + 30 * 86_400_000),
    status: "active",
    nationality: "AE",
    waiverAcceptedAt: new Date(),
    firstName: "Jane",
    lastName: "Doe",
    ...opts,
  };
  store.members.set(id, m);
  return m;
}

describe("evaluateAccess matrix", () => {
  beforeEach(reset);

  it("allows a healthy active member", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id);
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(true);
  });

  it("blocks unknown member", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const r = await evaluateAccess("does-not-exist", dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/Unknown/i);
  });

  it("blocks cross-tenant access", async () => {
    const t1 = seedTenant();
    const t2 = seedTenant();
    const dev = seedDevice(t1.id);
    const m = seedMember(t2.id);
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/cross-tenant/i);
  });

  it("blocks when tenant suspended", async () => {
    const t = seedTenant(undefined, false);
    const dev = seedDevice(t.id);
    const m = seedMember(t.id);
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/suspended/i);
  });

  it("blocks frozen membership", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { status: "frozen" });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/frozen/i);
  });

  it("blocks cancelled membership", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { status: "cancelled" });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
  });

  it("blocks expired membership by date", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { membershipEnd: new Date(Date.now() - 86_400_000) });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/expired/i);
  });

  it("blocks branch mismatch", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id, { branchId: "branch-a" });
    const m = seedMember(t.id, { branchId: "branch-b" });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/branch/i);
  });

  it("blocks when waiver missing", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { waiverAcceptedAt: null });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/waiver/i);
  });

  it("blocks unpaid overdue invoice", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id);
    store.invoices.set("inv1", { id: "inv1", tenantId: t.id, customerId: m.id, status: "overdue", createdAt: new Date() });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/unpaid/i);
  });

  it("ignores fresh pending invoice (within grace window)", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id);
    store.invoices.set("inv1", { id: "inv1", tenantId: t.id, customerId: m.id, status: "pending", createdAt: new Date() });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(true);
  });

  it("blocks pending invoice older than 7-day grace", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id);
    const old = new Date(Date.now() - 30 * 86_400_000);
    store.invoices.set("inv1", { id: "inv1", tenantId: t.id, customerId: m.id, status: "pending", createdAt: old });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
  });

  it("custom block rule on membership_type wins over allow", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { membershipType: "trial" });
    store.rules.set("r1", {
      id: "r1", tenantId: t.id, name: "No trials", ruleType: "membership_type",
      ruleValue: "trial", reason: "Trial members blocked", isActive: true, priority: 50, branchId: null,
    });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/Trial/i);
  });

  it("custom block rule on nationality matches", async () => {
    const t = seedTenant();
    const dev = seedDevice(t.id);
    const m = seedMember(t.id, { nationality: "IN" });
    store.rules.set("r1", {
      id: "r1", tenantId: t.id, name: "Visa", ruleType: "nationality",
      ruleValue: "IN,PK", reason: "Visa hold", isActive: true, priority: 100, branchId: null,
    });
    const r = await evaluateAccess(m.id, dev);
    expect(r.allow).toBe(false);
  });
});

describe("matchAnyBlockRule (pure)", () => {
  beforeEach(reset);

  const fakeDev = { id: "d1", tenantId: "t1", branchId: null } as any;
  const member = { id: "m1", tenantId: "t1", membershipPlanId: "plan-x", membershipType: "monthly", status: "active", nationality: "AE" } as any;

  it("respects priority ordering", () => {
    const rules: any[] = [
      { id: "low", priority: 200, isActive: true, ruleType: "status", ruleValue: "active", reason: "by status" },
      { id: "high", priority: 10, isActive: true, ruleType: "membership_type", ruleValue: "monthly", reason: "by cadence" },
    ];
    const hit = matchAnyBlockRule(member, fakeDev, rules, new Date());
    expect(hit?.id).toBe("high");
  });

  it("ignores inactive rules", () => {
    const rules: any[] = [{ id: "x", priority: 1, isActive: false, ruleType: "status", ruleValue: "active", reason: "x" }];
    expect(matchAnyBlockRule(member, fakeDev, rules, new Date())).toBeNull();
  });

  it("time_window matches inside window", () => {
    const rules: any[] = [{ id: "tw", priority: 1, isActive: true, ruleType: "time_window", ruleValue: "00:00-23:59", reason: "tw" }];
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(matchAnyBlockRule(member, fakeDev, rules, noon)?.id).toBe("tw");
  });

  it("time_window misses outside window", () => {
    const rules: any[] = [{ id: "tw", priority: 1, isActive: true, ruleType: "time_window", ruleValue: "06:00-07:00", reason: "tw" }];
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(matchAnyBlockRule(member, fakeDev, rules, noon)).toBeNull();
  });

  it("time_window handles wrap-past-midnight", () => {
    const rules: any[] = [{ id: "tw", priority: 1, isActive: true, ruleType: "time_window", ruleValue: "23:00-05:00", reason: "tw" }];
    const earlyMorning = new Date();
    earlyMorning.setHours(2, 0, 0, 0);
    expect(matchAnyBlockRule(member, fakeDev, rules, earlyMorning)?.id).toBe("tw");
  });

  it("plan rule matches plan id", () => {
    const rules: any[] = [{ id: "p", priority: 1, isActive: true, ruleType: "plan", ruleValue: "plan-x,plan-y", reason: "p" }];
    expect(matchAnyBlockRule(member, fakeDev, rules, new Date())?.id).toBe("p");
  });

  it("rule scoped to a different branch is skipped", () => {
    const rules: any[] = [{ id: "r", priority: 1, isActive: true, branchId: "branch-other", ruleType: "status", ruleValue: "active", reason: "r" }];
    const dev = { ...fakeDev, branchId: "branch-here" };
    expect(matchAnyBlockRule(member, dev, rules, new Date())).toBeNull();
  });

  it("branch-scoped rule does NOT fire on a device with no branch (regression)", () => {
    // Earlier bug: branch-pinned rule applied tenant-wide via unscoped readers.
    const rules: any[] = [{ id: "r", priority: 1, isActive: true, branchId: "branch-x", ruleType: "status", ruleValue: "active", reason: "r" }];
    const dev = { ...fakeDev, branchId: null };
    expect(matchAnyBlockRule(member, dev, rules, new Date())).toBeNull();
  });
});

describe("custom-rule fail-closed (regression)", () => {
  beforeEach(reset);

  it("returns deny with engine-error reason if rule lookup throws", async () => {
    const t = { id: newId("t"), name: "G", isActive: true };
    store.tenants.set(t.id, t);
    const dev: any = { id: newId("d"), tenantId: t.id, brand: "zkteco", secret: "s", isActive: true, branchId: null };
    store.devices.set(dev.id, dev);
    const m: any = {
      id: newId("m"), tenantId: t.id, status: "active",
      membershipType: "monthly", waiverAcceptedAt: new Date(), firstName: "A", lastName: "B",
      membershipEnd: new Date(Date.now() + 86_400_000),
    };
    store.members.set(m.id, m);

    // Replace the storage mock for ONE call to make the rule lookup throw.
    const { storage } = await import("../../server/storage");
    const original = (storage as any).getActiveAccessBlockRules;
    (storage as any).getActiveAccessBlockRules = async () => { throw new Error("DB down"); };
    try {
      const r = await evaluateAccess(m.id, dev);
      expect(r.allow).toBe(false);
      expect(r.reason).toMatch(/engine error/i);
    } finally {
      (storage as any).getActiveAccessBlockRules = original;
    }
  });
});
