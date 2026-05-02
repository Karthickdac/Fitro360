import type { DeviceAdapter } from "./types";
import { zktecoAdapter, esslAdapter, realtimeAdapter } from "./adapters/zkteco";
import { hikvisionAdapter } from "./adapters/hikvision";
import { supremaAdapter } from "./adapters/suprema";
import { matrixAdapter } from "./adapters/matrix";
import { anvizAdapter } from "./adapters/anviz";
import { dahuaAdapter } from "./adapters/dahua";

// Adapter registry. To add a new brand, write a new adapter file that
// implements DeviceAdapter and add it here. The brand string must match
// the Device.brand column value.
const REGISTRY: Record<string, DeviceAdapter> = {
  zkteco: zktecoAdapter,
  essl: esslAdapter,
  realtime: realtimeAdapter,
  hikvision: hikvisionAdapter,
  // Phase B/C scaffolds — see header comment in each file. These are
  // wired through the same code path as the verified brands but the
  // adapter itself is marked UNTESTED until first hardware deployment.
  suprema: supremaAdapter,
  matrix: matrixAdapter,
  anviz: anvizAdapter,
  dahua: dahuaAdapter,
};

export function getAdapter(brand: string): DeviceAdapter | null {
  return REGISTRY[brand?.toLowerCase()] ?? null;
}

export const SUPPORTED_BRANDS = Object.keys(REGISTRY);

// Brands listed in the plan but not yet implemented as code adapters.
// Surfaced in the admin UI as "coming soon".
export const PLANNED_BRANDS = ["idemia", "virdi", "hid"];

// Adapters whose code exists but has not been validated against real
// hardware. UI shows a yellow "untested" badge so owners know to verify
// before going live with a Phase B/C device.
export const UNTESTED_BRANDS = ["suprema", "matrix", "anviz", "dahua"];
