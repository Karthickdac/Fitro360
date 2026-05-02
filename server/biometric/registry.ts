import type { DeviceAdapter } from "./types";
import { zktecoAdapter, esslAdapter, realtimeAdapter } from "./adapters/zkteco";
import { hikvisionAdapter } from "./adapters/hikvision";

// Adapter registry. To add a new brand, write a new adapter file that
// implements DeviceAdapter and add it here. The brand string must match
// the Device.brand column value.
const REGISTRY: Record<string, DeviceAdapter> = {
  zkteco: zktecoAdapter,
  essl: esslAdapter,
  realtime: realtimeAdapter,
  hikvision: hikvisionAdapter,
};

export function getAdapter(brand: string): DeviceAdapter | null {
  return REGISTRY[brand?.toLowerCase()] ?? null;
}

export const SUPPORTED_BRANDS = Object.keys(REGISTRY);

// Brands listed in the plan but not yet implemented — surfaced in the
// admin UI as "coming soon" so owners can see the roadmap.
export const PLANNED_BRANDS = [
  "suprema",
  "matrix",
  "anviz",
  "dahua",
  "idemia",
  "virdi",
  "hid",
];
