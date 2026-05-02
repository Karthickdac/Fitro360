import { storage } from "../storage";
import type { AccessDecision } from "./types";
import type { Device } from "@shared/schema";

// Single source of truth: should this member be allowed through this device right now?
// Reads only local DB so a Stripe outage cannot lock members out of their own gym.
export async function evaluateAccess(memberId: string, device: Device): Promise<AccessDecision> {
  const member = await storage.getMember(memberId);
  if (!member) {
    return { allow: false, reason: "Unknown member" };
  }

  // Cross-tenant defence: device tenant must match member tenant. Belt and braces;
  // routes already enforce, but the engine is the last line of defence.
  if (member.tenantId !== device.tenantId) {
    return { allow: false, reason: "Cross-tenant access blocked", memberId: member.id };
  }

  // Branch restriction: if both device and member have a branch, they must match.
  // Devices without a branchId are treated as gym-wide.
  if (device.branchId && member.branchId && device.branchId !== member.branchId) {
    return { allow: false, reason: "Member not enrolled at this branch", memberId: member.id };
  }

  // Status gates
  if (member.status === "frozen") {
    return { allow: false, reason: "Membership is frozen", memberId: member.id };
  }
  if (member.status === "expired" || member.status === "cancelled" || member.status === "inactive") {
    return { allow: false, reason: "Membership inactive", memberId: member.id };
  }

  // Expiry check
  if (member.membershipEnd) {
    const end = new Date(member.membershipEnd);
    if (end.getTime() < Date.now()) {
      return { allow: false, reason: "Membership expired", memberId: member.id };
    }
  }

  // Tenant-level lockouts: suspended tenants cannot let members in either.
  const tenant = await storage.getTenant(member.tenantId);
  if (tenant && tenant.isActive === false) {
    return { allow: false, reason: "Gym account suspended", memberId: member.id };
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
