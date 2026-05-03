"use strict";

// Fallback dispatcher used when no brand-specific implementation ships
// with the relay yet. It logs the queued command for diagnostic purposes
// and acks the cloud as FAILED with a clear message — never as success —
// so the dashboard accurately reflects that nothing was delivered to the
// physical device. An integrator replaces this with a real HTTP/SDK call
// to the local device and returns { ok: true } once delivery succeeds.

async function execute(device, cmd, log) {
  // We deliberately ack as FAILED — never as success — so the cloud
  // dashboard accurately reflects that the command was not delivered.
  // An integrator can replace this with a real HTTP/SDK call to the
  // local device and return { ok: true } on success.
  const msg = `no native dispatcher implemented for brand "${device.brand}" (command "${cmd.command}")`;
  log.warn(`[${device.brand} ${device.serial}] ${msg}; payload=${JSON.stringify(cmd.payload || {})}`);
  return { ok: false, error: msg };
}

module.exports = { execute };
