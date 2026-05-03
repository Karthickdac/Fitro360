"use strict";

const fs = require("node:fs");

function loadConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const cfg = JSON.parse(raw);

  const cloudUrl = (process.env.FITRO360_CLOUD_URL || cfg.cloudUrl || "").trim();
  if (!cloudUrl) throw new Error("cloudUrl is required (or set FITRO360_CLOUD_URL)");
  if (!/^https?:\/\//i.test(cloudUrl)) {
    throw new Error(`cloudUrl must start with http:// or https:// (got "${cloudUrl}")`);
  }
  // Refuse plaintext HTTP unless the operator has explicitly opted in
  // via `allowInsecureCloudUrl: true` in config.json (or the
  // FITRO360_ALLOW_INSECURE=1 env var). Without TLS the per-device
  // secret would be exposed to anything sniffing the path between the
  // gym PC and the cloud, and HMAC-signed paths would still be
  // replay-able for the lifetime of a queued command.
  const insecureOk =
    cfg.allowInsecureCloudUrl === true || process.env.FITRO360_ALLOW_INSECURE === "1";
  if (/^http:\/\//i.test(cloudUrl) && !insecureOk) {
    throw new Error(
      `cloudUrl is plaintext HTTP ("${cloudUrl}"). Use https:// in production. ` +
        `If this is a local test deployment, set "allowInsecureCloudUrl": true in config.json ` +
        `or FITRO360_ALLOW_INSECURE=1 in the environment.`,
    );
  }

  const devices = Array.isArray(cfg.devices) ? cfg.devices : [];
  if (devices.length === 0) {
    throw new Error("config.devices must contain at least one device");
  }
  for (const d of devices) {
    if (!d.serial) throw new Error("each device requires a `serial`");
    if (!d.secret) throw new Error(`device ${d.serial} is missing \`secret\``);
    if (!d.brand) throw new Error(`device ${d.serial} is missing \`brand\``);
    if (!d.host) throw new Error(`device ${d.serial} is missing \`host\``);
  }

  return {
    cloudUrl: cloudUrl.replace(/\/+$/, ""),
    pollIntervalMs: Math.max(1000, Number(cfg.pollIntervalMs) || 5000),
    logLevel: (process.env.FITRO360_LOG_LEVEL || cfg.logLevel || "info").toLowerCase(),
    devices,
  };
}

module.exports = { loadConfig };
