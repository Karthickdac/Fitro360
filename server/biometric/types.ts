import type { Device, BiometricTemplate } from "@shared/schema";

export type NormalizedEvent = {
  externalRef: string;
  eventType: "entry" | "exit" | "denied" | "unknown_face" | "error";
  capturedAt: Date;
  photoUrl?: string;
  nativeEventId: string;
  raw: any;
};

export type EnrolPayload = {
  externalRef: string;
  templateData: string;
  templateType: "face" | "fingerprint" | "card";
};

export type AccessDecision = {
  allow: boolean;
  reason: string;
  memberId?: string;
};

export type AdapterReplyHints = {
  openDoor?: boolean;
  message?: string;
  doorOpenSeconds?: number;
};

export interface DeviceAdapter {
  brand: string;

  verifyRequest(req: { headers: Record<string, any>; rawBody: Buffer | string; query: Record<string, any> }, device: Device): Promise<boolean>;

  parseEvent(req: { body: any; rawBody: Buffer | string; query: Record<string, any> }): NormalizedEvent | null;

  buildReply(decision: AccessDecision, hints: AdapterReplyHints): { contentType: string; body: string | Buffer };

  enqueueOpenDoor(device: Device): Promise<void>;

  pushTemplate?(device: Device, member: { id: string; firstName: string; lastName: string }, template: EnrolPayload): Promise<{ ok: boolean; error?: string }>;
  deleteTemplate?(device: Device, externalRef: string): Promise<{ ok: boolean; error?: string }>;
  listEnrolled?(device: Device): Promise<{ externalRef: string; name?: string }[]>;
  healthCheck?(device: Device): Promise<{ online: boolean; latencyMs?: number; error?: string }>;
}
