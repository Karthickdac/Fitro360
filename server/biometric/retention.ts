import { storage } from "../storage";
import { log } from "../index";

// Daily GDPR retention sweep:
//   - Templates whose owning member's membershipEnd is older than the
//     tenant's `templateRetentionMonths` are hard-deleted (and the device
//     is told to forget the user too).
//   - Templates whose member is `cancelled` / `transferred` are deleted
//     immediately if the tenant has `purgeOnCancellation = true`.
//   - Access events older than `eventRetentionMonths` are hard-deleted.
//   - Each sweep writes an `activities` audit row so owners can prove
//     compliance to a regulator.
export async function runRetentionSweep(): Promise<{
  templatesDeleted: number;
  eventsDeleted: number;
  unmatchedDeleted: number;
}> {
  let templatesDeleted = 0;
  let eventsDeleted = 0;
  let unmatchedDeleted = 0;

  const tenants = await storage.getAllTenants();
  for (const tenant of tenants) {
    if (tenant.isActive === false) continue;
    const settings = await storage.getTenantBiometricSettings(tenant.id);
    const templateMonths = settings?.templateRetentionMonths ?? 24;
    const eventMonths = settings?.eventRetentionMonths ?? 12;
    const purgeOnCancel = settings?.purgeOnCancellation ?? false;

    const templateCutoff = monthsAgo(templateMonths);
    const eventCutoff = monthsAgo(eventMonths);

    const templates = await storage.getTemplatesByTenant(tenant.id);
    for (const t of templates) {
      const member = await storage.getMember(t.memberId);
      if (!member) {
        await storage.deleteTemplate(t.id);
        templatesDeleted++;
        continue;
      }
      const cancelled = ["cancelled", "transferred", "inactive"].includes(member.status ?? "");
      const expiredLongAgo = member.membershipEnd && new Date(member.membershipEnd) < templateCutoff;
      if ((purgeOnCancel && cancelled) || expiredLongAgo) {
        await storage.deleteTemplate(t.id);
        templatesDeleted++;
      }
    }

    eventsDeleted += await storage.deleteAccessEventsOlderThan(tenant.id, eventCutoff);
    unmatchedDeleted += await storage.deleteUnmatchedEnrolmentsOlderThan(tenant.id, monthsAgo(3));

    if (templatesDeleted > 0 || eventsDeleted > 0 || unmatchedDeleted > 0) {
      await storage.createActivity({
        tenantId: tenant.id,
        type: "biometric_retention_sweep",
        description: `GDPR sweep: ${templatesDeleted} template(s), ${eventsDeleted} event(s), ${unmatchedDeleted} unmatched cleared`,
        metadata: { templateMonths, eventMonths, purgeOnCancel },
      });
    }
  }

  log(
    `retention sweep: templates=${templatesDeleted} events=${eventsDeleted} unmatched=${unmatchedDeleted}`,
    "biometric",
  );
  return { templatesDeleted, eventsDeleted, unmatchedDeleted };
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
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
