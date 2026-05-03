// Vitest setup: provides a shared in-memory storage mock so tests don't
// touch a real database. Each test file gets its own mocked module thanks
// to vitest's per-file isolation, so seeding done in one test cannot
// affect another.
import { vi } from "vitest";

type Tenant = { id: string; name: string; isActive: boolean };
type Member = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  membershipPlanId?: string | null;
  membershipType: string;
  membershipEnd?: Date | null;
  status: string;
  statusUpdatedAt?: Date | null;
  nationality?: string | null;
  waiverAcceptedAt?: Date | null;
  firstName: string;
  lastName: string;
};
type Device = { id: string; tenantId: string; branchId?: string | null; brand: string; secret: string; isActive: boolean };
type Invoice = { id: string; tenantId: string; customerId: string; status: string; createdAt: Date };
type Template = { id: string; tenantId: string; deviceId: string; memberId: string; externalRef: string; status: string };
type AccessEvent = { id: string; tenantId: string; deviceId?: string | null; memberId?: string | null; capturedAt: Date; decision: string; eventType: string; reason?: string | null; externalRef?: string | null };
type BlockRule = { id: string; tenantId: string; branchId?: string | null; name: string; ruleType: string; ruleValue: string; reason: string; isActive: boolean; priority: number };
type DoorCmd = { id: string; tenantId: string; deviceId: string; command: string; payload: any; idempotencyKey: string; status: string };
type Settings = { tenantId: string; templateRetentionMonths?: number; eventRetentionMonths?: number; purgeOnCancellation?: boolean; relayWsEnabled?: boolean };
type Activity = { id: string; tenantId: string; type: string; description: string; metadata?: any };
type Processed = { id: string; deviceId: string };
type Plan = { id: string; features?: string[] };
type Unmatched = { id: string; tenantId: string; deviceId: string; externalRef: string; displayName?: string | null; lastSeenAt: Date; resolvedMemberId?: string | null };

let counter = 0;
const newId = (p = "id") => `${p}-${++counter}-${Math.random().toString(36).slice(2, 7)}`;

const state = {
  tenants: new Map<string, Tenant>(),
  members: new Map<string, Member>(),
  devices: new Map<string, Device>(),
  invoices: new Map<string, Invoice>(),
  templates: new Map<string, Template>(),
  events: new Map<string, AccessEvent>(),
  rules: new Map<string, BlockRule>(),
  doorCmds: new Map<string, DoorCmd>(),
  settings: new Map<string, Settings>(),
  activities: new Map<string, Activity>(),
  processed: new Map<string, Processed>(),
  plans: new Map<string, Plan>(),
  unmatched: new Map<string, Unmatched>(),
};

export function resetMockStore() {
  for (const m of Object.values(state)) (m as Map<string, any>).clear();
  counter = 0;
}

// Tiny test-only seed helpers — exported via globalThis so individual
// tests can grab them without juggling imports.
(globalThis as any).__store = state;
(globalThis as any).__newId = newId;
(globalThis as any).__resetStore = resetMockStore;

const fakeStorage = {
  // Tenants
  async getTenant(id: string) { return state.tenants.get(id); },
  async getAllTenants() { return Array.from(state.tenants.values()); },

  // Members
  async getMember(id: string) { return state.members.get(id); },

  // Plans
  async getMembershipPlan(id: string) { return state.plans.get(id); },

  // Devices
  async getDevice(id: string) { return state.devices.get(id); },
  async getDevicesByTenant(t: string) { return Array.from(state.devices.values()).filter((d) => d.tenantId === t); },
  async updateDevice(id: string, data: any) {
    const d = state.devices.get(id);
    if (d) Object.assign(d, data);
    return d;
  },

  // Invoices
  async getUnpaidInvoicesForMember(tenantId: string, memberId: string, cutoff: Date) {
    return Array.from(state.invoices.values()).filter((i) =>
      i.tenantId === tenantId &&
      i.customerId === memberId &&
      (i.status === "overdue" || (i.status === "pending" && i.createdAt < cutoff)),
    );
  },

  // Templates
  async getTemplateByExternalRef(deviceId: string, externalRef: string) {
    return Array.from(state.templates.values()).find((t) => t.deviceId === deviceId && t.externalRef === externalRef);
  },
  async getTemplatesByTenant(t: string) { return Array.from(state.templates.values()).filter((x) => x.tenantId === t); },
  async findTemplateByExternalRefAndTenant(t: string, ref: string) {
    return Array.from(state.templates.values()).find((x) => x.tenantId === t && x.externalRef === ref && x.status === "active");
  },
  async createTemplate(data: any) {
    const id = newId("tpl");
    const tpl = { id, status: "active", ...data };
    state.templates.set(id, tpl);
    return tpl;
  },
  async deleteTemplate(id: string) { state.templates.delete(id); },

  // Access events
  async createAccessEvent(data: any) {
    const id = newId("evt");
    const e = { id, capturedAt: data.capturedAt ?? new Date(), ...data };
    state.events.set(id, e);
    return e;
  },
  async deleteAccessEventsOlderThan(t: string, cutoff: Date) {
    let n = 0;
    for (const [id, e] of state.events) {
      if (e.tenantId === t && e.capturedAt < cutoff) { state.events.delete(id); n++; }
    }
    return n;
  },
  async wipeAccessEventPayloadsOlderThan(t: string, cutoff: Date) {
    let n = 0;
    for (const e of state.events.values()) {
      if (e.tenantId === t && e.capturedAt < cutoff) {
        const hasData = (e as any).rawPayload != null || (e as any).photoUrl != null;
        if (!hasData) continue;
        (e as any).rawPayload = null;
        (e as any).photoUrl = null;
        n++;
      }
    }
    return n;
  },

  // Rules
  async getActiveAccessBlockRules(t: string) {
    return Array.from(state.rules.values())
      .filter((r) => r.tenantId === t && r.isActive)
      .sort((a, b) => a.priority - b.priority);
  },

  // Door commands (idempotency-aware)
  async createDoorCommand(data: any) {
    const existing = Array.from(state.doorCmds.values()).find((c) => c.idempotencyKey === data.idempotencyKey);
    if (existing) return existing;
    const id = newId("door");
    const cmd = { id, status: "pending", ...data };
    state.doorCmds.set(id, cmd);
    return cmd;
  },

  // Settings
  async getTenantBiometricSettings(t: string) { return state.settings.get(t); },

  // Activities
  async createActivity(data: any) {
    const id = newId("act");
    const a = { id, ...data };
    state.activities.set(id, a);
    return a;
  },

  // Unmatched enrolments
  async upsertUnmatchedEnrolment(data: any) {
    const existing = Array.from(state.unmatched.values()).find((u) =>
      u.tenantId === data.tenantId && u.deviceId === data.deviceId && u.externalRef === data.externalRef,
    );
    if (existing) {
      existing.lastSeenAt = new Date();
      existing.displayName = data.displayName ?? existing.displayName;
      return existing;
    }
    const id = newId("unm");
    const u = { id, lastSeenAt: new Date(), ...data };
    state.unmatched.set(id, u);
    return u;
  },
  async deleteUnmatchedEnrolmentsOlderThan(t: string, cutoff: Date) {
    let n = 0;
    for (const [id, u] of state.unmatched) {
      if (u.tenantId === t && u.lastSeenAt < cutoff) { state.unmatched.delete(id); n++; }
    }
    return n;
  },

  // Dedupe
  async isBiometricEventProcessed(id: string) { return state.processed.has(id); },
  async claimBiometricEvent(id: string, deviceId: string) {
    if (state.processed.has(id)) return false;
    state.processed.set(id, { id, deviceId });
    return true;
  },

  // Attendance — no-op for these tests
  async createAttendance(_: any) { return { id: newId("att") }; },
};

vi.mock("../server/storage", () => ({ storage: fakeStorage }));
vi.mock("../../server/storage", () => ({ storage: fakeStorage }));

// Stub the index.ts log() helper so tests don't pull in the entire
// express bootstrap (which would try to start a real server).
vi.mock("../server/index", () => ({ log: () => {} }));
vi.mock("../../server/index", () => ({ log: () => {} }));
