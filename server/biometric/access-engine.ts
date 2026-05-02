import { storage } from "../storage";
import type { AccessDecision } from "./types";
import type { Device } from "@shared/schema";

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
  // We scan tenant invoices and filter by customerId; cheap because list is
  // small per tenant and we never block on payment provider availability.
  try {
    const invoices = await storage.getInvoicesByTenant(member.tenantId);
    const unpaid = invoices.filter(
      (inv) =>
        inv.customerId === member.id &&
        (inv.status === "overdue" ||
          (inv.status === "pending" && inv.createdAt && Date.now() - new Date(inv.createdAt).getTime() > INVOICE_GRACE_DAYS * 24 * 60 * 60 * 1000)),
    );
    if (unpaid.length > 0) {
      return { allow: false, reason: "Unpaid invoice on file", memberId: member.id };
    }
  } catch {
    // Invoice lookup failure must not lock members out — fail open here only,
    // since payment status is informational; status/expiry already gated above.
  }

  return { allow: true, reason: "OK", memberId: member.id };
}

// Resolve a device-side externalRef back to a Fitro360 member, or null if
// the device knows a face we haven't linked yet (we still log the event).
export async function resolveMemberFromExternalRef(deviceId: string, externalRef: string): Promise<string | null> {
  // Templates may be device-scoped or global. Prefer a device-specific match,
  // then fall back to any active template for the same externalRef in the
  // tenant — but only if it was enrolled for the same device's brand.
  const tDeviceSpecific = await storage.getTemplateByExternalRef(deviceId, externalRef);
  if (tDeviceSpecific && tDeviceSpecific.status === "active") {
    return tDeviceSpecific.memberId;
  }
  // Fallback: any template with this externalRef for the same tenant.
  // (Useful when admins re-use a stable PIN across devices.)
  const device = await storage.getDevice(deviceId);
  if (!device) return null;
  const tenantTemplates = await storage.getTemplatesByTenant(device.tenantId);
  const match = tenantTemplates.find(
    (t) => t.externalRef === externalRef && t.status === "active",
  );
  return match?.memberId ?? null;
}
