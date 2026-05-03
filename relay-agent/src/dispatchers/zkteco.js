"use strict";

// ZKTeco / ESSL / Realtime use the ADMS push protocol over plain HTTP on
// port 80 of the device. The same firmware also exposes a TCP "PUSH SDK"
// on port 4370. Most field deployments enable HTTP so this dispatcher
// targets that path; the TCP-only variant requires the upstream
// `node-zklib` package and can be slotted in here without touching the
// poller.

const http = require("node:http");

function deviceHttp(device, urlPath, opts = {}) {
  const body = opts.body;
  const headers = Object.assign(
    {
      "user-agent": "fitro360-relay/1.0",
      accept: "*/*",
    },
    opts.headers || {},
  );
  if (body && !headers["content-type"]) {
    headers["content-type"] = "text/plain; charset=utf-8";
  }
  if (body) headers["content-length"] = Buffer.byteLength(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: device.host,
        port: device.port || 80,
        path: urlPath,
        method: opts.method || "GET",
        headers,
        timeout: opts.timeoutMs || 8000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("device request timeout")));
    if (body) req.write(body);
    req.end();
  });
}

// ZKTeco devices read queued commands from /iclock/getrequest at their own
// poll interval. We can also push a command directly when the device has
// the optional "command push" SDK enabled, but the universal approach is
// to seed the device-side queue via the push protocol's command channel.
//
// For an open-door, the canonical ADMS command is:
//   "C:<id>:DATA UPDATE OPENDOOR\tDoor=1\tDuration=<seconds>"
function buildAdmsCommand(cmd) {
  const id = cmd.id || Date.now();
  switch (cmd.command) {
    case "open": {
      const seconds = (cmd.payload && cmd.payload.seconds) || 5;
      return `C:${id}:DATA UPDATE OPENDOOR\tDoor=1\tDuration=${seconds}`;
    }
    case "enroll": {
      const p = cmd.payload || {};
      return [
        `C:${id}:DATA UPDATE USERINFO`,
        `PIN=${p.externalRef}`,
        `Name=${(p.memberName || "").slice(0, 24)}`,
        `Privilege=0`,
        p.templateData ? `Template=${p.templateData}` : "",
      ]
        .filter(Boolean)
        .join("\t");
    }
    case "delete": {
      const p = cmd.payload || {};
      return `C:${id}:DATA DELETE USERINFO\tPIN=${p.externalRef}`;
    }
    default:
      return null;
  }
}

async function execute(device, cmd, log) {
  const admsCmd = buildAdmsCommand(cmd);
  if (!admsCmd) {
    return { ok: false, error: `unsupported zkteco command: ${cmd.command}` };
  }
  // ADMS firmware accepts queued commands via /iclock/devicecmd; the
  // device next polls /iclock/getrequest to drain them. We post the
  // full command string as the body and authenticate using the
  // device-local communication password (?pwd=) — this is the native
  // ZKTeco/ESSL auth scheme.
  //
  // SECURITY: we deliberately do NOT fall back to the cloud HMAC
  // `secret` here. The cloud secret authenticates this agent to the
  // Fitro360 backend; leaking it on the LAN (where it would land in
  // device logs and be sniffable on plain HTTP) would let an attacker
  // forge polls and acks against the cloud. If you have not set a
  // device-side comm key, leave `password` unset and the request goes
  // out without ?pwd — most ZKTeco firmware accepts that for devices
  // configured without a comm key.
  const pwd = device.password;
  const sn = encodeURIComponent(device.serial);
  const urlPath = `/iclock/devicecmd?SN=${sn}${pwd ? `&pwd=${encodeURIComponent(pwd)}` : ""}`;
  try {
    const resp = await deviceHttp(device, urlPath, {
      method: "POST",
      body: admsCmd + "\n",
    });
    if (resp.status >= 200 && resp.status < 300) {
      log.info(`[zkteco ${device.serial}] queued ${cmd.command} (HTTP ${resp.status})`);
      return { ok: true };
    }
    return { ok: false, error: `device HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { execute, buildAdmsCommand };
