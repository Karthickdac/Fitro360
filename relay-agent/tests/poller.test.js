"use strict";

// Integration smoke test for the full poll → dispatch → ack loop.
// Uses a stub dispatcher and an in-process mock cloud HTTP server.
// Run with: `node tests/poller.test.js`

const http = require("node:http");
const assert = require("node:assert/strict");

const { Poller } = require("../src/poller");
const dispatchers = require("../src/dispatchers");

const SECRET = "poller-test-secret";
const SERIAL = "POLL-1";

function silentLogger() {
  const drop = () => {};
  return { debug: drop, info: drop, warn: drop, error: drop };
}

function startMockCloud() {
  const state = {
    polls: 0,
    acks: [],
    nextCommands: [],
    failNextAcks: 0,
    ackAttempts: 0,
  };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname.startsWith("/api/biometric/commands/")) {
        state.polls++;
        const cmds = state.nextCommands;
        state.nextCommands = [];
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ commands: cmds }));
        return;
      }
      if (req.method === "POST" && url.pathname.endsWith("/ack")) {
        state.ackAttempts++;
        if (state.failNextAcks > 0) {
          state.failNextAcks--;
          res.statusCode = 503;
          res.end("transient");
          return;
        }
        const m = url.pathname.match(/^\/api\/biometric\/commands\/(.+)\/ack$/);
        const cmdId = decodeURIComponent(m[1]);
        const parsed = JSON.parse(body || "{}");
        state.acks.push({ cmdId, status: parsed.status, error: parsed.error });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, state }));
  });
}

(async function run() {
  const { server, state } = await startMockCloud();
  const { port } = server.address();
  const cloudUrl = `http://127.0.0.1:${port}`;

  // Replace the live `zkteco` dispatcher with a deterministic stub for
  // the duration of the test, then restore the original at the end so
  // the module cache is left pristine for any later test files.
  const liveDispatcher = dispatchers.getDispatcher("zkteco");
  const originalExecute = liveDispatcher.execute;
  const dispatcherCalls = [];
  liveDispatcher.execute = async (device, cmd) => {
    dispatcherCalls.push({ deviceSerial: device.serial, cmdId: cmd.id, command: cmd.command });
    if (cmd.payload && cmd.payload.fail) return { ok: false, error: "device unreachable" };
    return { ok: true };
  };

  try {
    const cfg = {
      cloudUrl,
      pollIntervalMs: 1000,
      logLevel: "error",
      devices: [{ serial: SERIAL, secret: SECRET, brand: "zkteco", host: "127.0.0.1" }],
    };
    const poller = new Poller(cfg, silentLogger());

    // Test 1: happy path — one queued command flows through to a "done" ack.
    state.nextCommands = [{ id: "cmd-1", command: "open", payload: {} }];
    await poller.drainOnce();
    assert.equal(state.polls, 1, "cloud should have been polled once");
    assert.equal(dispatcherCalls.length, 1, "dispatcher should have been called once");
    assert.deepEqual(dispatcherCalls[0], { deviceSerial: SERIAL, cmdId: "cmd-1", command: "open" });
    assert.equal(state.acks.length, 1);
    assert.deepEqual(state.acks[0], { cmdId: "cmd-1", status: "done", error: undefined });

    // Test 2: dispatcher failure ⇒ "failed" ack with error string.
    state.nextCommands = [{ id: "cmd-2", command: "open", payload: { fail: true } }];
    await poller.drainOnce();
    assert.equal(state.acks.length, 2);
    assert.deepEqual(state.acks[1], {
      cmdId: "cmd-2",
      status: "failed",
      error: "device unreachable",
    });

    // Test 3: transient ack failure should be retried with backoff and
    // eventually succeed within the retry budget.
    const ackAttemptsBefore = state.ackAttempts;
    state.failNextAcks = 2;
    state.nextCommands = [{ id: "cmd-3", command: "open", payload: {} }];
    await poller.drainOnce();
    const ackAttemptsAfter = state.ackAttempts;
    assert.equal(
      ackAttemptsAfter - ackAttemptsBefore,
      3,
      "should have made exactly 3 ack attempts (2 failures + 1 success)",
    );
    assert.equal(state.acks.length, 3);
    assert.deepEqual(state.acks[2], { cmdId: "cmd-3", status: "done", error: undefined });

    // Test 4: empty command list ⇒ no dispatcher call, no ack.
    const dispatcherCallsBefore = dispatcherCalls.length;
    const acksBefore = state.acks.length;
    state.nextCommands = [];
    await poller.drainOnce();
    assert.equal(dispatcherCalls.length, dispatcherCallsBefore, "no dispatcher calls on empty queue");
    assert.equal(state.acks.length, acksBefore, "no acks on empty queue");
  } finally {
    liveDispatcher.execute = originalExecute;
    server.close();
  }

  console.log("OK — poll/dispatch/ack integration test passed");
})().catch((e) => {
  console.error("FAIL:", e.stack || e.message);
  process.exit(1);
});
