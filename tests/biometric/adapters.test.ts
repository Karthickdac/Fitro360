import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { zktecoAdapter } from "../../server/biometric/adapters/zkteco";
import { hikvisionAdapter } from "../../server/biometric/adapters/hikvision";

function fakeReq(opts: { body?: any; rawBody?: string | Buffer; headers?: Record<string, string>; query?: Record<string, string> } = {}) {
  return {
    body: opts.body,
    rawBody: opts.rawBody,
    headers: opts.headers ?? {},
    query: opts.query ?? {},
  } as any;
}

const fakeDevice = (secret = "topsecret"): any => ({
  id: "dev-1",
  tenantId: "ten-1",
  brand: "zkteco",
  secret,
  branchId: null,
  isActive: true,
});

describe("zkteco adapter", () => {
  it("parses an ATTLOG line", () => {
    const ev = zktecoAdapter.parseEvent(fakeReq({ rawBody: "12345\t2026-04-30 09:15:33\t0\t1\n" }));
    expect(ev?.externalRef).toBe("12345");
    expect(ev?.eventType).toBe("entry");
    expect(ev?.capturedAt).toBeInstanceOf(Date);
  });

  it("rejects empty body", () => {
    expect(zktecoAdapter.parseEvent(fakeReq({ rawBody: "" }))).toBeNull();
  });

  it("verifies HMAC signature in constant time", async () => {
    const dev = fakeDevice("secret-1");
    const body = "12345\t2026-04-30 09:15:33\t0\t1";
    const sig = crypto.createHmac("sha256", "secret-1").update(body).digest("hex");
    const ok = await zktecoAdapter.verifyRequest(
      fakeReq({ rawBody: body, headers: { "x-fitro360-sig": sig } }),
      dev,
    );
    expect(ok).toBe(true);
  });

  it("verifies pwd query fallback (ADMS native)", async () => {
    const dev = fakeDevice("pwd-secret");
    const ok = await zktecoAdapter.verifyRequest(
      fakeReq({ rawBody: "x", query: { pwd: "pwd-secret" } }),
      dev,
    );
    expect(ok).toBe(true);
  });

  it("rejects bad signature", async () => {
    const dev = fakeDevice("secret-1");
    const ok = await zktecoAdapter.verifyRequest(
      fakeReq({ rawBody: "x", headers: { "x-fitro360-sig": "deadbeef" } }),
      dev,
    );
    expect(ok).toBe(false);
  });
});

describe("hikvision adapter", () => {
  it("parses JSON body", () => {
    const body = {
      AccessControllerEvent: {
        employeeNoString: "555",
        dateTime: "2026-04-30T10:00:00Z",
        serialNo: 7,
      },
    };
    const ev = hikvisionAdapter.parseEvent(fakeReq({ body }));
    expect(ev?.externalRef).toBe("555");
    expect(ev?.eventType).toBe("entry");
    expect(ev?.nativeEventId).toMatch(/^555-/);
  });

  it("flags unknown_face when no employee number", () => {
    const ev = hikvisionAdapter.parseEvent(fakeReq({
      body: { AccessControllerEvent: { dateTime: "2026-04-30T10:00:00Z", serialNo: 9 } },
    }));
    expect(ev?.eventType).toBe("unknown_face");
  });

  it("parses multipart body with JSON event_log part", () => {
    const boundary = "----Hik9999";
    const json = JSON.stringify({
      AccessControllerEvent: {
        employeeNoString: "888",
        dateTime: "2026-04-30T10:30:00Z",
        serialNo: 11,
      },
    });
    const body = Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="event_log"',
      "Content-Type: application/json",
      "",
      json,
      `--${boundary}`,
      'Content-Disposition: form-data; name="picture"; filename="face.jpg"',
      "Content-Type: image/jpeg",
      "",
      "fakebinary",
      `--${boundary}--`,
      "",
    ].join("\r\n"));
    const ev = hikvisionAdapter.parseEvent(fakeReq({
      rawBody: body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    }));
    expect(ev?.externalRef).toBe("888");
    expect(ev?.eventType).toBe("entry");
  });

  it("rejects when neither body nor parseable multipart present", () => {
    const ev = hikvisionAdapter.parseEvent(fakeReq({ headers: { "content-type": "multipart/form-data" } }));
    expect(ev).toBeNull();
  });

  it("verifies HMAC signature", async () => {
    const dev = { ...fakeDevice("hik-secret"), brand: "hikvision" };
    const body = '{"a":1}';
    const sig = crypto.createHmac("sha256", "hik-secret").update(body).digest("hex");
    const ok = await hikvisionAdapter.verifyRequest(
      fakeReq({ rawBody: body, headers: { "x-fitro360-sig": sig } }),
      dev,
    );
    expect(ok).toBe(true);
  });
});
