import { storage } from "../storage";
import { log } from "../index";
import { getAdapter } from "./registry";

// Daily GDPR / UAE PDPL retention sweep:
//   - Templates whose owning member has been `inactive` or `transferred`
//     for more than INACTIVE_GRACE_DAYS (30) are hard-deleted unconditionally
//     and a delete-template command is pushed to the device that holds them.
//     This is the GDPR "right to be forgotten" path: a member who leaves
//     loses their biometric footprint within a month even if the tenant
//     hasn't opted into eager `purgeOnCancellation`.
//   - Templates whose member is `cancelled` are also purged after the same
//     grace period; if the tenant has set `purgeOnCancellation = true` they
//     are purged immediately.
//   - Templates whose member's membershipEnd is older than the tenant's
//     `templateRetentionMonths` are hard-deleted (long-departed members).
//   - Access events older than `eventRetentionMonths` keep their decision
//     metadata (decision, reason, timestamp, deviceId, memberId) but have
//     their `rawPayload` and `photoUrl` wiped. This preserves audit trail
//     for regulators while shedding the personal-data parts that GDPR
//     demands we age out.
//   - Each sweep writes an `activities` audit row so owners can prove
//     compliance to a regulator.
const INACTIVE_GRACE_DAYS = 30;
const INACTIVE_STATUSES = new Set(["inactive", "transferred", "cancelled"]);

export async function runRetentionSweep(): Promise<{
  templatesDeleted: number;
  eventsWiped: number;
  unmatchedDeleted: number;
}> {
  let templatesDeleted = 0;
  let eventsWiped = 0;
  let unmatchedDeleted = 0;

  const tenants = await storage.getAllTenants();
  for (const tenant of tenants) {
    if (tenant.isActive === false) continue;
    const settings = await storage.getTenantBiometricSettings(tenant.id);
    const templateMonths = settings?.templateRetentionMonths ?? 24;
    const eventMonths = settings?.eventRetentionMonths ?? 12;
    const purgeOnCancel = settings?.purgeOnCancellation ?? false;

    const templateCutoff = monthsAgo(templateMonths);
    const inactiveCutoff = daysAgo(INACTIVE_GRACE_DAYS);

    let perTenantTemplates = 0;
    const templates = await storage.getTemplatesByTenant(tenant.id);
    for (const t of templates) {
      const member = await storage.getMember(t.memberId);
      if (!member) {
        await purgeTemplate(t);
        templatesDeleted++;
        perTenantTemplates++;
        continue;
      }
      const memberStatus = member.status ?? "";
      const inInactiveGroup = INACTIVE_STATUSES.has(memberStatus);
      // Status was changed long enough ago to age out. We rely on the
      // dedicated `statusUpdatedAt` column (bumped by storage.updateMember
      // every time `status` changes) so a back-office edit that doesn't
      // touch membershipEnd still triggers GDPR purge at exactly 30 days.
      const statusChangedAt = member.statusUpdatedAt ? new Date(member.statusUpdatedAt) : null;
      const statusOldEnough = statusChangedAt ? statusChangedAt < inactiveCutoff : false;
      const expiredLongAgo = member.membershipEnd && new Date(member.membershipEnd) < templateCutoff;

      const shouldPurge =
        (inInactiveGroup && (purgeOnCancel || statusOldEnough)) || expiredLongAgo;

      if (shouldPurge) {
        await purgeTemplate(t);
        templatesDeleted++;
        perTenantTemplates++;
      }
    }

    const wiped = await storage.wipeAccessEventPayloadsOlderThan(tenant.id, monthsAgo(eventMonths));
    eventsWiped += wiped;
    const purged = await storage.deleteUnmatchedEnrolmentsOlderThan(tenant.id, monthsAgo(3));
    unmatchedDeleted += purged;

    if (perTenantTemplates > 0 || wiped > 0 || purged > 0) {
      await storage.createActivity({
        tenantId: tenant.id,
        type: "biometric_retention_sweep",
        description: `GDPR sweep: ${perTenantTemplates} template(s) purged, ${wiped} event payload(s) wiped, ${purged} unmatched cleared`,
        metadata: { templateMonths, eventMonths, purgeOnCancel, inactiveGraceDays: INACTIVE_GRACE_DAYS },
      });
    }
  }

  log(
    `retention sweep: templates=${templatesDeleted} events_wiped=${eventsWiped} unmatched=${unmatchedDeleted}`,
    "biometric",
  );
  return { templatesDeleted, eventsWiped, unmatchedDeleted };
}

// Purge a template from our DB AND tell the device to forget it. We never
// let an adapter error block the DB delete — GDPR obliges us to delete on
// our side even if the device is offline; the device will get an explicit
// delete next time it's reachable via the same `door_commands` queue.
async function purgeTemplate(t: any): Promise<void> {
  if (t.deviceId && t.externalRef) {
    try {
      const device = await storage.getDevice(t.deviceId);
      if (device) {
        const adapter = getAdapter(device.brand);
        if (adapter?.deleteTemplate) {
          await adapter.deleteTemplate(device, t.externalRef);
        }
      }
    } catch (e: any) {
      log(`retention: device delete-template failed for tpl=${t.id}: ${e?.message ?? e}`, "biometric");
    }
  }
  await storage.deleteTemplate(t.id);
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Kick off a daily sweep. Caller usually passes `24 * 60 * 60 * 1000`.
let started = false;
export function startRetentionSweeper(intervalMs: number) {
  if (started) return;
  started = true;
  setInterval(() => {
    runRetentionSweep().catch((e) => {
      log(`retention sweep error: ${e?.message ?? e}`, "biometric");
    });
  }, intervalMs);
}
