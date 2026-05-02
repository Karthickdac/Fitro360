import { storage } from "../storage";
import type { AccessDecision } from "./types";
import type { Device, AccessBlockRule, Member } from "@shared/schema";

// Window after invoice creation before "pending" counts as overdue for the
// purpose of blocking entry. Anything past this window or already marked
// "overdue" denies access until paid.
const INVOICE_GRACE_DAYS = 7;

// Single source of truth: should this member be allowed through this device right now?
// Reads only the local DB so a Stripe outage cannot lock members out of their own gym.
//
// Owner-defined blocking rules implemented (in priority order):
//   1. Cross-tenant defence (device + member must share tenant)
//   2. Tenant-level suspension (whole gym account turned off)
//   3. Status gates: frozen / cancelled / inactive / expired / transferred
//   4. Membership end (hard cutoff — staff must renew before re-entry)
//   5. Branch restriction: device.branchId must match member.branchId when both set
//   6. Plan-level branch restriction: if the member's plan locks them to specific
//      branches (features.branchIds[]) the device branch must be in that list
//   7. Waiver: members must have an accepted liability waiver (waiverAcceptedAt)
//   8. Unpaid balance: any pending/overdue invoice older than the grace period blocks entry
export async function evaluateAccess(memberId: string, device: Device): Promise<AccessDecision> {
  const member = await storage.getMember(memberId);
  if (!member) {
    return { allow: false, reason: "Unknown member" };
  }

  // 1. Cross-tenant defence — belt and braces; routes already enforce.
  if (member.tenantId !== device.tenantId) {
    return { allow: false, reason: "Cross-tenant access blocked", memberId: member.id };
  }

  // 2. Tenant-level lockouts: suspended tenants cannot let members in.
  const tenant = await storage.getTenant(member.tenantId);
  if (tenant && tenant.isActive === false) {
    return { allow: false, reason: "Gym account suspended", memberId: member.id };
  }

  // 3. Status gates
  if (member.status === "frozen") {
    return { allow: false, reason: "Membership is frozen", memberId: member.id };
  }
  if (
    member.status === "cancelled" ||
    member.status === "inactive" ||
    member.status === "transferred"
  ) {
    return { allow: false, reason: "Membership inactive", memberId: member.id };
  }

  // 4. Expiry — once the membership end date has passed, deny entry. The
  // member must renew at the front desk (or via the member portal) before
  // they can come back in. Front-desk staff can still see the deny reason
  // on the access events screen so they can action a renewal on the spot.
  if (member.status === "expired") {
    return { allow: false, reason: "Membership expired", memberId: member.id };
  }
  if (member.membershipEnd) {
    const end = new Date(member.membershipEnd).getTime();
    if (end < Date.now()) {
      return { allow: false, reason: "Membership expired", memberId: member.id };
    }
  }

  // 5. Branch restriction — device locked to a specific branch
  if (device.branchId && member.branchId && device.branchId !== member.branchId) {
    return { allow: false, reason: "Member not enrolled at this branch", memberId: member.id };
  }

  // 6. Plan-level branch restriction (if the plan stores allowed branch ids in
  // its features array, e.g. features = ["branch:branch-uuid-1", ...]).
  if (device.branchId && member.membershipPlanId) {
    const plan = await storage.getMembershipPlan(member.membershipPlanId);
    if (plan && Array.isArray(plan.features)) {
      const branchTags = plan.features.filter((f: string) => typeof f === "string" && f.startsWith("branch:"));
      if (branchTags.length > 0) {
        const allowed = branchTags.map((t: string) => t.slice("branch:".length));
        if (!allowed.includes(device.branchId)) {
          return { allow: false, reason: "Plan does not include this branch", memberId: member.id };
        }
      }
    }
  }

  // 7. Waiver — owners require a signed liability waiver before first entry.
  if (!member.waiverAcceptedAt) {
    return { allow: false, reason: "Liability waiver not signed", memberId: member.id };
  }

  // 8. Unpaid balance — any pending/overdue invoice for this member.
  // Member-scoped query (indexed on customerId) replaces the older tenant-
  // wide scan + in-memory filter. Hot path: a busy gym fires evaluateAccess
  // once per swipe, so the difference is tens of ms vs hundreds at scale.
  try {
    const cutoff = new Date(Date.now() - INVOICE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const unpaid = await storage.getUnpaidInvoicesForMember(member.tenantId, member.id, cutoff);
    if (unpaid.length > 0) {
      return { allow: false, reason: "Unpaid invoice on file", memberId: member.id };
    }
  } catch {
    // Invoice lookup failure must not lock members out — fail open here only,
    // since payment status is informational; status/expiry already gated above.
  }

  // 9. Owner-defined custom block rules. Evaluated last so the built-in
  // gates above always win. Any matching rule denies entry with the
  // owner-supplied reason. Ordered by priority (lower = checked first).
  // FAIL CLOSED: if the rules table is unreachable we deny entry rather
  // than silently bypass the owner's policy. The deny reason includes
  // an "engine error" tag so front-desk staff can escalate (and so the
  // condition shows up in the access-events feed instead of being
  // invisible). This is a deliberate trade-off — a brief deny window
  // during a DB blip is recoverable; a silent allow is a policy breach.
  try {
    const rules = await storage.getActiveAccessBlockRules(member.tenantId);
    const ruleHit = matchAnyBlockRule(member, device, rules, new Date());
    if (ruleHit) {
      return { allow: false, reason: ruleHit.reason, memberId: member.id };
    }
  } catch (err: any) {
    return {
      allow: false,
      reason: `Access policy engine error: ${err?.message ?? "unknown"}`,
      memberId: member.id,
    };
  }

  return { allow: true, reason: "OK", memberId: member.id };
}

// Pure rule-match helper. Exported so the test suite can drive it directly
// without spinning up the storage layer. `now` is injected so tests can
// pin time without monkey-patching Date.
export function matchAnyBlockRule(
  member: Member,
  device: Device,
  rules: AccessBlockRule[],
  now: Date,
): AccessBlockRule | null {
  // Sort by priority asc — lower numbers run first.
  const ordered = [...rules].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  for (const r of ordered) {
    if (!r.isActive) continue;
    // Branch-scoped rules: a rule pinned to branch X must NOT fire on a
    // device that has no branch (otherwise an owner who scopes a rule to
    // one branch would accidentally apply it tenant-wide via unscoped
    // readers). Conversely an unscoped rule (r.branchId == null) applies
    // everywhere, which is the documented behaviour.
    if (r.branchId && r.branchId !== device.branchId) continue;
    if (matchOne(member, r, now)) return r;
  }
  return null;
}

function matchOne(member: Member, rule: AccessBlockRule, now: Date): boolean {
  const values = (rule.ruleValue || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (values.length === 0 && rule.ruleType !== "time_window") return false;
  switch (rule.ruleType) {
    case "plan": {
      return !!member.membershipPlanId && values.includes(member.membershipPlanId);
    }
    case "membership_type": {
      // Block by membership cadence (monthly | quarterly | annual | trial …)
      return !!member.membershipType && values.includes(member.membershipType);
    }
    case "status": {
      return !!member.status && values.includes(member.status);
    }
    case "nationality": {
      // Useful for VAT/age-rule jurisdictions where some plans aren't sold to non-residents.
      return !!member.nationality && values.includes(member.nationality);
    }
    case "day_of_week": {
      const dow = now.getDay(); // 0..6, server local time
      return values.includes(String(dow));
    }
    case "time_window": {
      const m = (rule.ruleValue || "").match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (!m) return false;
      const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      const endMin = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      // Window may wrap midnight (e.g. 23:00-05:00). Treat as union of two ranges.
      if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
      return nowMin >= startMin || nowMin < endMin;
    }
    default:
      return false;
  }
}

// Resolve a device-side externalRef back to a Fitro360 member, or null if
// the device knows a face we haven't linked yet (we still log the event).
export async function resolveMemberFromExternalRef(deviceId: string, externalRef: string): Promise<string | null> {
  // Templates may be device-scoped or shared across same-brand readers. Prefer
  // a device-specific match. Fall back ONLY when the candidate template was
  // enrolled on a device of the same brand (and same tenant) — otherwise an
  // externalRef collision (e.g. PIN "1234") between, say, a Hikvision face
  // template and a ZKTeco fingerprint template would mis-associate members.
  // If multiple brand-safe candidates exist we refuse to guess and return null.
  const tDeviceSpecific = await storage.getTemplateByExternalRef(deviceId, externalRef);
  if (tDeviceSpecific && tDeviceSpecific.status === "active") {
    return tDeviceSpecific.memberId;
  }
  const device = await storage.getDevice(deviceId);
  if (!device) return null;

  const tenantTemplates = await storage.getTemplatesByTenant(device.tenantId);
  const candidates: { memberId: string }[] = [];
  for (const t of tenantTemplates) {
    if (t.externalRef !== externalRef || t.status !== "active") continue;
    if (!t.deviceId) continue;
    const tDev = await storage.getDevice(t.deviceId);
    if (tDev?.brand === device.brand) {
      candidates.push({ memberId: t.memberId });
    }
  }
  if (candidates.length !== 1) return null; // ambiguous → refuse to map
  return candidates[0].memberId;
}
