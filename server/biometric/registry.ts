import type { DeviceAdapter } from "./types";
import { zktecoAdapter, esslAdapter, realtimeAdapter } from "./adapters/zkteco";
import { hikvisionAdapter } from "./adapters/hikvision";
import { supremaAdapter } from "./adapters/suprema";
import { matrixAdapter } from "./adapters/matrix";
import { anvizAdapter } from "./adapters/anviz";
import { dahuaAdapter } from "./adapters/dahua";
import { idemiaAdapter } from "./adapters/idemia";
import { virdiAdapter } from "./adapters/virdi";
import { hidAdapter } from "./adapters/hid";

// Adapter registry. To add a new brand, write a new adapter file that
// implements DeviceAdapter and add it here. The brand string must match
// the Device.brand column value.
const REGISTRY: Record<string, DeviceAdapter> = {
  zkteco: zktecoAdapter,
  essl: esslAdapter,
  realtime: realtimeAdapter,
  hikvision: hikvisionAdapter,
  suprema: supremaAdapter,
  matrix: matrixAdapter,
  anviz: anvizAdapter,
  dahua: dahuaAdapter,
  idemia: idemiaAdapter,
  virdi: virdiAdapter,
  hid: hidAdapter,
};

export function getAdapter(brand: string): DeviceAdapter | null {
  return REGISTRY[brand?.toLowerCase()] ?? null;
}

export const SUPPORTED_BRANDS = Object.keys(REGISTRY);

// All Phase B/C brands now ship with code adapters — nothing left on the
// roadmap. Kept exported (empty) so callers / API consumers don't break
// if they still read it.
export const PLANNED_BRANDS: string[] = [];

// Adapters whose code exists but has not been validated against real
// hardware. UI shows a yellow "untested" badge so owners know to verify
// before going live with a Phase B/C device. The seven Phase B/C brands
// land in this bucket until first real-world deployment confirms each.
export const UNTESTED_BRANDS: string[] = [
  "suprema",
  "matrix",
  "anviz",
  "dahua",
  "idemia",
  "virdi",
  "hid",
];
