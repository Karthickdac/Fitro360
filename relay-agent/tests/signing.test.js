"use strict";

// Minimal CI smoke test for the relay's HMAC signing + poll/ack
// contract. Run with: `node tests/signing.test.js` (no test runner
// needed — we keep zero dev-dependencies for the agent).
//
// Guards against regressions where the agent and the cloud routes
// drift on either the canonical signed string or the wire URL.

const http = require("node:http");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const { fetchCommands, ackCommand, signPath } = require("../src/api");

const SECRET = "test-secret-0123456789abcdef";
const SERIAL = "ZK/With Slash+Plus 1";
const CMD_ID = "cmd id with spaces";

function expectedSig(method, decodedPath) {
  return crypto.createHmac("sha256", SECRET).update(`${method}:${decodedPath}`).digest("hex");
}

function startMockServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => handler(req, res, body));
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

(async function run() {
  let pollHits = 0;
  let ackHits = 0;
  const srv = await startMockServer((req, res, body) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname.startsWith("/api/biometric/commands/")) {
      pollHits++;
      // Decode the wire path the same way Express does for req.params.
      const serial = decodeURIComponent(url.pathname.split("/").pop());
      assert.equal(serial, SERIAL, "decoded serial must equal config serial");
      const exp = expectedSig("GET", `/api/biometric/commands/${SERIAL}`);
      assert.equal(req.headers["x-fitro360-sig"], exp, "GET signature must match decoded canonical path");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ commands: [{ id: CMD_ID, command: "open", payload: {} }] }));
      return;
    }
    if (req.method === "POST" && url.pathname.endsWith("/ack")) {
      ackHits++;
      const m = url.pathname.match(/^\/api\/biometric\/commands\/(.+)\/ack$/);
      const cmdId = decodeURIComponent(m[1]);
      assert.equal(cmdId, CMD_ID, "decoded cmd id must equal queued id");
      const exp = expectedSig("POST", `/api/biometric/commands/${CMD_ID}/ack`);
      assert.equal(req.headers["x-fitro360-sig"], exp, "POST signature must match decoded canonical path");
      const parsed = JSON.parse(body || "{}");
      assert.equal(parsed.status, "done");
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  const { port } = srv.address();
  const cloudUrl = `http://127.0.0.1:${port}`;
  const device = { serial: SERIAL, secret: SECRET };

  // 1. fetchCommands: signature is built from the DECODED path, but
  //    the wire URL must still be percent-encoded.
  const result = await fetchCommands(cloudUrl, device);
  assert.equal(result.ok, true, "fetchCommands should succeed against the mock");
  assert.equal(result.commands.length, 1);

  // 2. ackCommand: same canonical signing rule for the cmd id segment.
  await ackCommand(cloudUrl, device, CMD_ID, "done");

  // 3. signPath sanity check (used by both call sites).
  assert.equal(
    signPath("GET", "/x/y", "k"),
    crypto.createHmac("sha256", "k").update("GET:/x/y").digest("hex"),
  );

  assert.equal(pollHits, 1);
  assert.equal(ackHits, 1);

  srv.close();
  console.log("OK — signing/poll/ack contract test passed");
})().catch((e) => {
  console.error("FAIL:", e.stack || e.message);
  process.exit(1);
});
