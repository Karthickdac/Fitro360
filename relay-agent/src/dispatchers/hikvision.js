"use strict";

// Hikvision exposes ISAPI endpoints over HTTPS on the device. Auth uses
// HTTP Digest with the device admin credentials. We implement the
// minimum digest handshake here so the relay has zero npm dependencies.

const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const { URL } = require("node:url");

function md5hex(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}

function parseDigestChallenge(header) {
  // www-authenticate: Digest realm="...", nonce="...", qop="auth", ...
  const out = {};
  const m = header.replace(/^Digest\s+/i, "");
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|([^,]+))/g;
  let match;
  while ((match = re.exec(m))) out[match[1].toLowerCase()] = match[2] ?? match[3];
  return out;
}

function buildDigestHeader(username, password, method, urlPath, challenge) {
  const realm = challenge.realm || "";
  const nonce = challenge.nonce || "";
  const qop = challenge.qop || "auth";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const nc = "00000001";
  const ha1 = md5hex(`${username}:${realm}:${password}`);
  const ha2 = md5hex(`${method}:${urlPath}`);
  const response = md5hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  return (
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${urlPath}",` +
    ` qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"` +
    (challenge.opaque ? `, opaque="${challenge.opaque}"` : "")
  );
}

function rawRequest(urlStr, opts = {}) {
  const u = new URL(urlStr);
  const lib = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
        rejectUnauthorized: false, // self-signed certs are common on these devices
        timeout: opts.timeoutMs || 8000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("device request timeout")));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function digestRequest(device, method, urlPath, body, contentType) {
  const scheme = device.https === false ? "http" : "https";
  const port = device.port || (scheme === "https" ? 443 : 80);
  const url = `${scheme}://${device.host}:${port}${urlPath}`;
  const headers = {};
  if (body) {
    headers["content-type"] = contentType || "application/json";
    headers["content-length"] = Buffer.byteLength(body);
  }
  let resp = await rawRequest(url, { method, headers, body });
  if (resp.status !== 401) return resp;
  const challenge = parseDigestChallenge(resp.headers["www-authenticate"] || "");
  const auth = buildDigestHeader(
    device.username || "admin",
    device.password || "",
    method,
    urlPath,
    challenge,
  );
  return rawRequest(url, {
    method,
    headers: Object.assign({}, headers, { authorization: auth }),
    body,
  });
}

async function execute(device, cmd, log) {
  try {
    if (cmd.command === "open") {
      const seconds = (cmd.payload && cmd.payload.seconds) || 5;
      // ISAPI: PUT /ISAPI/AccessControl/RemoteControl/door/1
      const body = `<?xml version="1.0"?><RemoteControlDoor><cmd>open</cmd><duration>${seconds}</duration></RemoteControlDoor>`;
      const resp = await digestRequest(
        device,
        "PUT",
        "/ISAPI/AccessControl/RemoteControl/door/1",
        body,
        "application/xml",
      );
      if (resp.status >= 200 && resp.status < 300) {
        log.info(`[hikvision ${device.serial}] open OK (HTTP ${resp.status})`);
        return { ok: true };
      }
      return { ok: false, error: `device HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
    }
    if (cmd.command === "delete") {
      const p = cmd.payload || {};
      if (!p.externalRef) return { ok: false, error: "delete: missing externalRef" };
      const body = JSON.stringify({ UserInfoDelCond: { EmployeeNoList: [{ employeeNo: String(p.externalRef) }] } });
      const resp = await digestRequest(
        device,
        "PUT",
        "/ISAPI/AccessControl/UserInfo/Delete?format=json",
        body,
        "application/json",
      );
      if (resp.status >= 200 && resp.status < 300) {
        log.info(`[hikvision ${device.serial}] delete OK (HTTP ${resp.status})`);
        return { ok: true };
      }
      return { ok: false, error: `device HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
    }
    if (cmd.command === "enroll") {
      const p = cmd.payload || {};
      if (!p.externalRef) return { ok: false, error: "enroll: missing externalRef" };
      // Minimal /ISAPI/AccessControl/UserInfo/SetUp payload — common across
      // most ISAPI firmware revisions. Sites with custom user schemas can
      // extend this by editing dispatchers/hikvision.js.
      const body = JSON.stringify({
        UserInfo: [
          {
            employeeNo: String(p.externalRef),
            name: String(p.memberName || p.externalRef).slice(0, 32),
            userType: "normal",
            Valid: { enable: true, beginTime: "2020-01-01T00:00:00", endTime: "2099-12-31T23:59:59" },
          },
        ],
      });
      const resp = await digestRequest(
        device,
        "POST",
        "/ISAPI/AccessControl/UserInfo/Record?format=json",
        body,
        "application/json",
      );
      if (resp.status >= 200 && resp.status < 300) {
        log.info(`[hikvision ${device.serial}] enroll OK (HTTP ${resp.status})`);
        return { ok: true };
      }
      return { ok: false, error: `device HTTP ${resp.status}: ${resp.body.slice(0, 200)}` };
    }
    return { ok: false, error: `unsupported hikvision command: ${cmd.command}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { execute, buildDigestHeader, parseDigestChallenge };
