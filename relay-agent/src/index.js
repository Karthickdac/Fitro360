#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadConfig } = require("./config");
const { createLogger } = require("./logger");
const { Poller } = require("./poller");

function parseArgs(argv) {
  const out = { configPath: null, once: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "-c" || a === "--config") && argv[i + 1]) {
      out.configPath = argv[++i];
    } else if (a === "--once") {
      out.once = true;
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a === "--version") {
      const pkg = require("../package.json");
      console.log(pkg.version);
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`fitro360-relay — on-prem relay agent for Fitro360

Usage:
  fitro360-relay [--config <path>] [--once]

Options:
  -c, --config <path>   Path to config.json (default: ./config.json or
                        %ProgramData%/Fitro360/config.json on Windows,
                        /etc/fitro360/config.json on Linux)
  --once                Drain the queue once and exit (useful for cron / tests)
      --version         Print version
  -h, --help            Show this help

Environment overrides:
  FITRO360_CONFIG       Path to config.json
  FITRO360_CLOUD_URL    Cloud base URL (overrides cloudUrl in config)
  FITRO360_LOG_LEVEL    debug | info | warn | error
`);
}

function defaultConfigCandidates() {
  const cands = [];
  if (process.env.FITRO360_CONFIG) cands.push(process.env.FITRO360_CONFIG);
  cands.push(path.resolve(process.cwd(), "config.json"));
  if (process.platform === "win32") {
    const pd = process.env.ProgramData || "C:/ProgramData";
    cands.push(path.join(pd, "Fitro360", "config.json"));
  } else {
    cands.push("/etc/fitro360/config.json");
  }
  return cands;
}

function pickConfigPath(explicit) {
  if (explicit) return explicit;
  for (const c of defaultConfigCandidates()) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const cfgPath = pickConfigPath(args.configPath);
  if (!cfgPath) {
    console.error(
      "ERROR: No config.json found. Pass --config <path> or place one at ./config.json.",
    );
    console.error("Example config:\n");
    console.error(
      fs.readFileSync(path.join(__dirname, "..", "config.example.json"), "utf8"),
    );
    process.exit(2);
  }

  let cfg;
  try {
    cfg = loadConfig(cfgPath);
  } catch (e) {
    console.error(`ERROR: failed to load ${cfgPath}: ${e.message}`);
    process.exit(2);
  }

  const log = createLogger(cfg.logLevel);
  log.info(`fitro360-relay starting (config=${cfgPath}, cloud=${cfg.cloudUrl})`);
  log.info(`Devices configured: ${cfg.devices.length}`);

  const poller = new Poller(cfg, log);
  if (args.once) {
    await poller.drainOnce();
    log.info("Drain-once complete, exiting.");
    return;
  }

  const stop = () => {
    log.info("Shutdown signal received, stopping poller…");
    poller.stop();
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  poller.start();
}

main().catch((e) => {
  console.error("FATAL:", e && e.stack ? e.stack : e);
  process.exit(1);
});
