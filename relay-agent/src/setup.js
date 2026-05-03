"use strict";

// Interactive setup wizard for the Fitro360 relay agent.
//
// Triggered by:
//   fitro360-relay.exe --setup
// or automatically on first run when no config.json is found.
//
// Writes a validated config.json to the platform-default location
// (%ProgramData%\Fitro360 on Windows, /etc/fitro360 on Linux/macOS) and,
// on Windows, locks down the file's ACL so only Administrators / SYSTEM
// can read the per-device secrets.
//
// Zero npm deps — uses readline + raw stdin only. This is important
// because the wizard ships inside the packaged single-file .exe, so it
// must work from a node snapshot with no node_modules at runtime.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");
const { spawnSync } = require("node:child_process");

const KNOWN_BRANDS = [
  "zkteco",
  "essl",
  "realtime",
  "hikvision",
  "suprema",
  "matrix",
  "anviz",
  "dahua",
  "idemia",
  "virdi",
  "hid",
];

function defaultConfigPath() {
  if (process.platform === "win32") {
    const pd = process.env.ProgramData || "C:\\ProgramData";
    return path.join(pd, "Fitro360", "config.json");
  }
  return "/etc/fitro360/config.json";
}

// Tiny line-reader that buffers any 'line' events emitted while we are
// not actively awaiting a prompt. The plain `rl.question(cb)` API drops
// such lines on the floor whenever stdin is piped (Node readline emits
// every line back-to-back as soon as the pipe is consumed, but only
// the line received during a pending question() reaches its callback).
// That race made the wizard exit silently on the second prompt under
// install.bat or any non-TTY driver.
function makeRl() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on("line", (l) => {
    if (waiters.length > 0) waiters.shift()(l);
    else queue.push(l);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length > 0) waiters.shift()(null);
  });
  rl.nextLine = () =>
    new Promise((resolve) => {
      if (queue.length > 0) return resolve(queue.shift());
      if (closed) return resolve(null);
      waiters.push(resolve);
    });
  return rl;
}

async function ask(rl, question, def) {
  const suffix = def !== undefined && def !== "" ? ` [${def}]` : "";
  process.stdout.write(`${question}${suffix}: `);
  const line = await rl.nextLine();
  const v = ((line == null ? "" : line) || "").trim();
  return v === "" && def !== undefined ? String(def) : v;
}

// Masked password input. Uses raw stdin echo-suppression so the secret
// never appears on screen or in shell history. Falls back to using the
// parent readline (echoed) if stdin is not a TTY (e.g. piped install
// scripts) — we *must* share that parent rl, otherwise creating a
// second readline against the same stdin would steal lines from it.
function askSecret(question, parentRl) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      // Non-interactive — share the parent rl's queued line stream so
      // we don't race with it (see makeRl comment above).
      const rl = parentRl || makeRl();
      stdout.write(`${question}: `);
      rl.nextLine().then((line) => {
        if (!parentRl) rl.close();
        resolve(((line == null ? "" : line) || "").trim());
      });
      return;
    }
    stdout.write(`${question}: `);
    const chars = [];
    const onData = (buf) => {
      const s = buf.toString("utf8");
      for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10) {
          // Enter
          stdin.removeListener("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(chars.join("").trim());
          return;
        }
        if (code === 3) {
          // Ctrl-C
          stdout.write("\n");
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          // Backspace
          if (chars.length > 0) {
            chars.pop();
            stdout.write("\b \b");
          }
          continue;
        }
        chars.push(ch);
        stdout.write("*");
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function askYesNo(rl, question, defYes) {
  const def = defYes ? "Y/n" : "y/N";
  for (;;) {
    const v = (await ask(rl, `${question} [${def}]`)).toLowerCase();
    if (v === "") return !!defYes;
    if (v === "y" || v === "yes") return true;
    if (v === "n" || v === "no") return false;
    console.log("Please answer y or n.");
  }
}

/* eslint-disable no-unused-vars */
async function askDevice(rl, index) {
  console.log(`\n— Device #${index + 1} —`);
  let brand;
  for (;;) {
    brand = (await ask(rl, `  Brand (${KNOWN_BRANDS.join(" | ")})`, "zkteco")).toLowerCase();
    if (KNOWN_BRANDS.includes(brand)) break;
    console.log(`  Unknown brand. Pick one of: ${KNOWN_BRANDS.join(", ")}`);
  }

  let serial;
  for (;;) {
    serial = await ask(rl, "  Device serial (as shown in Fitro360 → Devices)");
    if (serial) break;
    console.log("  Serial cannot be empty.");
  }

  let secret;
  for (;;) {
    secret = await askSecret("  Cloud secret (paste from the Devices page — input hidden)", rl);
    if (secret) break;
    console.log("  Secret cannot be empty.");
  }

  let host;
  for (;;) {
    host = await ask(rl, "  Device LAN IP or hostname (e.g. 192.168.1.50)");
    if (host) break;
    console.log("  Host cannot be empty.");
  }

  const defaultPort = brand === "hikvision" ? 443 : 80;
  const portStr = await ask(rl, "  Device port", String(defaultPort));
  const portNum = Number(portStr);
  // Accept any well-formed integer in 1..65535. We deliberately do
  // NOT use `Number(...) || default` because that would turn 0 (or any
  // non-numeric input) into the brand default and silently mask typos.
  const port = Number.isInteger(portNum) && portNum > 0 && portNum < 65536 ? portNum : defaultPort;

  const username = await ask(rl, "  Device admin username (blank if none)", "admin");
  const password = await askSecret("  Device admin password (input hidden, blank if none)", rl);

  const dev = { brand, serial, secret, host, port };
  if (username) dev.username = username;
  if (password) dev.password = password;
  return dev;
}

// Lock down the *directory* before we write the config file, so the
// secret payload is never on disk with default ACLs — even briefly.
// On Windows: only Administrators + SYSTEM may traverse / read.
// Anywhere else: 0700 on the dir.
//
// Also re-runs on the file itself after writing, so existing installs
// that pre-date the dir-level lockdown still get hardened.
function lockdownConfigDir(configDir) {
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(configDir, 0o700);
    } catch {}
    return;
  }
  try {
    spawnSync("icacls", [configDir, "/inheritance:r"], { stdio: "ignore" });
    spawnSync("icacls", [configDir, "/grant:r", "*S-1-5-32-544:(OI)(CI)F"], { stdio: "ignore" });
    spawnSync("icacls", [configDir, "/grant:r", "*S-1-5-18:(OI)(CI)F"], { stdio: "ignore" });
  } catch {}
}

function lockdownConfigFile(configPath) {
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(configPath, 0o600);
    } catch {}
    return;
  }
  try {
    spawnSync("icacls", [configPath, "/inheritance:r"], { stdio: "ignore" });
    spawnSync("icacls", [configPath, "/grant:r", "*S-1-5-32-544:F"], { stdio: "ignore" });
    spawnSync("icacls", [configPath, "/grant:r", "*S-1-5-18:F"], { stdio: "ignore" });
  } catch {}
}

async function runWizard(opts = {}) {
  const cfgPath = opts.configPath || defaultConfigPath();
  console.log("");
  console.log("===========================================");
  console.log("  Fitro360 Relay Agent — Setup Wizard");
  console.log("===========================================");
  console.log(`Config will be written to: ${cfgPath}`);
  console.log("Press Ctrl-C at any time to cancel.\n");

  let existing = null;
  if (fs.existsSync(cfgPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      console.log(`An existing config was found (${existing.devices?.length || 0} device(s)).`);
    } catch (e) {
      console.log(`Existing ${cfgPath} is not valid JSON; it will be replaced.`);
    }
  }

  const rl = makeRl();
  try {
    if (existing && existing.devices?.length) {
      const reuse = await askYesNo(rl, "Keep the existing devices and just edit cloudUrl / log level?", true);
      if (!reuse) existing = null;
    }

    const cloudUrl = await ask(
      rl,
      "Cloud URL (the Fitro360 base URL you sign in to)",
      existing?.cloudUrl || "https://app.fitro360.com",
    );
    if (!/^https?:\/\//i.test(cloudUrl)) {
      console.error(`\nERROR: cloudUrl must start with http:// or https:// (got "${cloudUrl}")`);
      process.exitCode = 2;
      return null;
    }
    const allowInsecure =
      /^http:\/\//i.test(cloudUrl)
        ? await askYesNo(
            rl,
            "  WARNING: cloudUrl is plain HTTP. Allow insecure (test deployments only)?",
            false,
          )
        : false;

    const pollSecStr = await ask(
      rl,
      "Poll interval in seconds",
      String(Math.max(1, Math.round((existing?.pollIntervalMs || 5000) / 1000))),
    );
    const pollIntervalMs = Math.max(1000, (Number(pollSecStr) || 5) * 1000);

    const logLevel = (await ask(
      rl,
      "Log level (debug | info | warn | error)",
      existing?.logLevel || "info",
    )).toLowerCase();

    let devices = existing?.devices ? [...existing.devices] : [];
    if (devices.length === 0) {
      devices.push(await askDevice(rl, 0));
    }
    while (await askYesNo(rl, "\nAdd another biometric device?", false)) {
      devices.push(await askDevice(rl, devices.length));
    }

    const cfg = {
      cloudUrl: cloudUrl.replace(/\/+$/, ""),
      pollIntervalMs,
      logLevel,
      devices,
    };
    if (allowInsecure) cfg.allowInsecureCloudUrl = true;

    const cfgDir = path.dirname(cfgPath);
    fs.mkdirSync(cfgDir, { recursive: true });
    // Harden the *directory* first so the file (and its secrets) is
    // never on disk with world-readable inherited ACLs, even briefly.
    lockdownConfigDir(cfgDir);
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + os.EOL, { mode: 0o600 });
    lockdownConfigFile(cfgPath);
    console.log(`\n✓ Wrote ${cfgPath} (${devices.length} device(s)).`);
    return { configPath: cfgPath, askYesNo: (q, d) => askYesNo(rl, q, d) };
  } finally {
    rl.close();
  }
}

module.exports = { runWizard, defaultConfigPath };
