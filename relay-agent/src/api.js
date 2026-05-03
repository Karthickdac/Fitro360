"use strict";

const crypto = require("node:crypto");

// Wrap a fetch call with a hard AbortController timeout so a stalled
// cloud connection can't hang the poll loop indefinitely.
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
async function timedFetch(url, opts = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

// HMAC-SHA256 of `<METHOD>:<PATH>` using the device secret. Matches
// server/biometric/routes.ts polling + ack endpoints.
function signPath(method, urlPath, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${method.toUpperCase()}:${urlPath}`)
    .digest("hex");
}

async function fetchCommands(cloudUrl, device) {
  // The server signs the DECODED path (req.params.serial), so we sign
  // the same canonical form here even though the wire URL uses the
  // percent-encoded segment. This keeps signatures matching for any
  // serial that contains reserved URL characters.
  const canonicalPath = `/api/biometric/commands/${device.serial}`;
  const wirePath = `/api/biometric/commands/${encodeURIComponent(device.serial)}`;
  const sig = signPath("GET", canonicalPath, device.secret);
  let res;
  try {
    res = await timedFetch(`${cloudUrl}${wirePath}`, {
      method: "GET",
      headers: { "x-fitro360-sig": sig, "user-agent": "fitro360-relay/1.0" },
    });
  } catch (e) {
    return { ok: false, retriable: true, error: `network: ${e.message}` };
  }
  if (res.status === 404) return { ok: false, retriable: false, error: "device not registered" };
  if (res.status === 401) return { ok: false, retriable: false, error: "bad signature (wrong secret?)" };
  if (!res.ok) return { ok: false, retriable: true, error: `HTTP ${res.status}` };
  const json = await res.json();
  return { ok: true, commands: Array.isArray(json.commands) ? json.commands : [] };
}

async function ackCommand(cloudUrl, device, cmdId, status, errorMsg) {
  const canonicalPath = `/api/biometric/commands/${cmdId}/ack`;
  const wirePath = `/api/biometric/commands/${encodeURIComponent(cmdId)}/ack`;
  const sig = signPath("POST", canonicalPath, device.secret);
  const body = JSON.stringify({ status, error: errorMsg || undefined });
  const res = await timedFetch(`${cloudUrl}${wirePath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fitro360-sig": sig,
      "user-agent": "fitro360-relay/1.0",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ack failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
}

module.exports = { fetchCommands, ackCommand, signPath };
