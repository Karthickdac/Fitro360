import { storage } from "../storage";
import { getAdapter } from "./registry";
import { log } from "../index";

// Background poll loop: every N seconds, ask each adapter to listEnrolled()
// for each of the tenant's devices, then reconcile against our DB.
//
// Three reconciliation outcomes per device-side enrolment:
//   1. We have a matching template with the same externalRef → no-op.
//   2. We don't, but the externalRef maps to one of our members via the
//      brand-safe resolver → create a placeholder template so future
//      events resolve cleanly.
//   3. We don't, AND we can't safely map → record an
//      `unmatched_enrolments` row so the front desk inbox can prompt
//      staff to "claim this enrolment for member X".
//
// Adapters whose hardware doesn't support listEnrolled() are skipped.

let started = false;
export function startEnrolmentSync(intervalMs: number) {
  if (started) return;
  started = true;
  // Fire once on boot then on the interval. Stagger by a small offset so
  // two replicas don't hammer all devices simultaneously.
  setTimeout(() => {
    runEnrolmentSync().catch((e) =>
      log(`enrolment sync error: ${e?.message ?? e}`, "biometric"),
    );
  }, 15_000);
  setInterval(() => {
    runEnrolmentSync().catch((e) =>
      log(`enrolment sync error: ${e?.message ?? e}`, "biometric"),
    );
  }, intervalMs);
}

export async function runEnrolmentSync(): Promise<{
  scanned: number;
  newPlaceholders: number;
  newUnmatched: number;
}> {
  let scanned = 0;
  let newPlaceholders = 0;
  let newUnmatched = 0;

  const tenants = await storage.getAllTenants();
  for (const tenant of tenants) {
    if (tenant.isActive === false) continue;
    const devices = await storage.getDevicesByTenant(tenant.id);
    for (const device of devices) {
      if (!device.isActive) continue;
      const adapter = getAdapter(device.brand);
      if (!adapter?.listEnrolled) continue;

      let remote: { externalRef: string; name?: string }[] = [];
      try {
        remote = await adapter.listEnrolled(device);
      } catch (e: any) {
        // Don't fail the whole sweep on a single offline device. Surface
        // the error onto the device row so owners can see it on /devices.
        await storage.updateDevice(device.id, { lastError: `sync: ${e?.message ?? e}` });
        continue;
      }
      scanned += remote.length;

      for (const r of remote) {
        if (!r.externalRef) continue;
        const existing = await storage.getTemplateByExternalRef(device.id, r.externalRef);
        if (existing) continue;

        // Try to map externalRef → member via the template index. This
        // handles the case of a template enrolled on another device of the
        // same brand+tenant.
        const sibling = await storage.findTemplateByExternalRefAndTenant(tenant.id, r.externalRef);
        if (sibling) {
          await storage.createTemplate({
            tenantId: tenant.id,
            memberId: sibling.memberId,
            deviceId: device.id,
            templateType: sibling.templateType,
            externalRef: r.externalRef,
            status: "active",
            syncStatus: "pushed",
            consentGiven: sibling.consentGiven ?? false,
          });
          newPlaceholders++;
          continue;
        }

        await storage.upsertUnmatchedEnrolment({
          tenantId: tenant.id,
          deviceId: device.id,
          externalRef: r.externalRef,
          displayName: r.name ?? null,
        });
        newUnmatched++;
      }
    }
  }

  if (scanned > 0) {
    log(
      `enrolment sync: scanned=${scanned} placeholders=${newPlaceholders} unmatched=${newUnmatched}`,
      "biometric",
    );
  }
  return { scanned, newPlaceholders, newUnmatched };
}
