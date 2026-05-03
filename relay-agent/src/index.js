#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadConfig } = require("./config");
const { createLogger } = require("./logger");
const { Poller } = require("./poller");
const { runWizard, defaultConfigPath } = require("./setup");

function parseArgs(argv) {
  const out = {
    configPath: null,
    once: false,
    setup: false,
    installService: false,
    uninstallService: false,
    startService: false,
    stopService: false,
    statusService: false,
    yes: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "-c" || a === "--config") && argv[i + 1]) {
      out.configPath = argv[++i];
    } else if (a === "--once") {
      out.once = true;
    } else if (a === "--setup") {
      out.setup = true;
    } else if (a === "--install-service") {
      out.installService = true;
    } else if (a === "--uninstall-service") {
      out.uninstallService = true;
    } else if (a === "--start-service") {
      out.startService = true;
    } else if (a === "--stop-service") {
      out.stopService = true;
    } else if (a === "--service-status") {
      out.statusService = true;
    } else if (a === "-y" || a === "--yes") {
      out.yes = true;
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
  fitro360-relay [--config <path>]            run as a daemon (default)
  fitro360-relay --setup                      interactive config wizard
  fitro360-relay --install-service            register Windows boot service
  fitro360-relay --uninstall-service          remove Windows boot service
  fitro360-relay --start-service              start the installed service now
  fitro360-relay --stop-service               stop the installed service
  fitro360-relay --service-status             print scheduled task status
  fitro360-relay --once                       drain queue once and exit

Options:
  -c, --config <path>     Path to config.json (default: %ProgramData%/Fitro360/config.json
                          on Windows, /etc/fitro360/config.json on Linux/macOS).
  -y, --yes               Auto-accept prompts (used by install.bat).
      --version           Print version
  -h, --help              Show this help

Environment overrides:
  FITRO360_CONFIG         Path to config.json
  FITRO360_CLOUD_URL      Cloud base URL (overrides cloudUrl in config)
  FITRO360_LOG_LEVEL      debug | info | warn | error
`);
}

function defaultConfigCandidates() {
  const cands = [];
  if (process.env.FITRO360_CONFIG) cands.push(process.env.FITRO360_CONFIG);
  cands.push(path.resolve(process.cwd(), "config.json"));
  cands.push(defaultConfigPath());
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

async function runDaemon(args, cfgPath) {
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

async function main() {
  const args = parseArgs(process.argv);

  // ─── Service control commands (Windows) ──────────────────────────
  if (args.installService || args.uninstallService || args.startService || args.stopService || args.statusService) {
    const svc = require("./service-win");
    try {
      if (args.uninstallService) {
        svc.uninstallService();
      } else if (args.startService) {
        svc.startService();
      } else if (args.stopService) {
        svc.stopService();
      } else if (args.statusService) {
        svc.statusService();
      } else if (args.installService) {
        const cfgPath = args.configPath || defaultConfigPath();
        if (!fs.existsSync(cfgPath)) {
          console.log(`No config found at ${cfgPath} — running setup wizard first.`);
          await runWizard({ configPath: cfgPath });
        }
        svc.installService(cfgPath);
      }
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // ─── Setup wizard ────────────────────────────────────────────────
  if (args.setup) {
    try {
      await runWizard({ configPath: args.configPath || defaultConfigPath() });
      console.log("\nNext steps:");
      console.log(
        process.platform === "win32"
          ? "  • Install as a boot service:   fitro360-relay --install-service"
          : "  • Run via systemd (Linux):     sudo systemctl start fitro360-relay",
      );
      console.log("  • Test the agent right now:    fitro360-relay --once");
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  // ─── Daemon mode ─────────────────────────────────────────────────
  let cfgPath = pickConfigPath(args.configPath);
  if (!cfgPath) {
    // First-run experience: if the user double-clicked the .exe with
    // no config anywhere, auto-launch the setup wizard instead of
    // dumping a stack trace and exiting.
    if (process.stdin.isTTY) {
      console.log("No config.json found — launching setup wizard.");
      const result = await runWizard({ configPath: defaultConfigPath() });
      if (!result) process.exit(2);
      cfgPath = result.configPath;
    } else {
      console.error(
        "ERROR: No config.json found. Run `fitro360-relay --setup` to create one,",
      );
      console.error("       or pass --config <path> to point at an existing file.");
      process.exit(2);
    }
  }

  await runDaemon(args, cfgPath);
}

main().catch((e) => {
  console.error("FATAL:", e && e.stack ? e.stack : e);
  process.exit(1);
});
