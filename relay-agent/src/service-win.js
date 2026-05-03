"use strict";

// Windows service registration for the Fitro360 relay agent.
//
// We use Task Scheduler (schtasks.exe) instead of a true Win32 service
// because:
//   * schtasks ships with every Windows install — no nssm / sc-create
//     dance needed.
//   * Task Scheduler restarts the task on boot AND on failure, with
//     no extra wrapper process.
//   * It works identically whether the agent is invoked as
//     `node src/index.js` (dev) or as a single-file `fitro360-relay.exe`
//     (the typical end-user install).
//
// The task runs as the SYSTEM principal so it survives user logoff,
// has access to the locked-down config file under %ProgramData%, and
// can reach the LAN regardless of whether anyone is signed in.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TASK_NAME = "Fitro360Relay";

function ensureWindows() {
  if (process.platform !== "win32") {
    throw new Error("--install-service / --uninstall-service is Windows-only on this build.");
  }
}

function isElevated() {
  // `net session` requires admin rights; if it fails we are not elevated.
  const r = spawnSync("net", ["session"], { stdio: "ignore" });
  return r.status === 0;
}

// Build the /TR (Task Run) string for schtasks.exe.
//
// Critical detail: when the path to the .exe (or any path in the
// arguments) contains a space, schtasks strips ONE layer of outer
// quotes when storing the action. The conventional fix is to wrap
// each path in *escaped* inner quotes — `\"…\"` — so what schtasks
// stores after stripping its outer layer is a still-quoted command
// line that cmd.exe will parse correctly.
//
// Resulting argv element passed to spawn:
//     /TR "\"C:\Path with space\fitro360-relay.exe\" --config \"C:\ProgramData\Fitro360\config.json\""
function buildTaskRunString(configPath) {
  const execPath = process.execPath;
  const quote = (p) => `\\"${p}\\"`;
  if (process.pkg) {
    return `${quote(execPath)} --config ${quote(configPath)}`;
  }
  const indexJs = path.resolve(__dirname, "index.js");
  return `${quote(execPath)} ${quote(indexJs)} --config ${quote(configPath)}`;
}

function installService(configPath) {
  ensureWindows();
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}. Run --setup first.`);
  }
  if (!isElevated()) {
    throw new Error(
      "Installing the service requires administrator rights. Right-click the installer or PowerShell and choose 'Run as administrator'.",
    );
  }

  const tr = buildTaskRunString(configPath);
  // /F overwrites if the task already exists.
  const r = spawnSync(
    "schtasks",
    ["/Create", "/TN", TASK_NAME, "/TR", tr, "/SC", "ONSTART", "/RU", "SYSTEM", "/RL", "HIGHEST", "/F"],
    { stdio: "inherit" },
  );
  if (r.status !== 0) {
    throw new Error(`schtasks /Create failed (exit ${r.status}).`);
  }
  // Start it now so the operator doesn't have to reboot.
  spawnSync("schtasks", ["/Run", "/TN", TASK_NAME], { stdio: "inherit" });
  console.log(`✓ Installed scheduled task '${TASK_NAME}' and started it.`);
  console.log(`  It will auto-start on every boot as SYSTEM.`);
  console.log(`  Inspect with:  schtasks /Query /TN ${TASK_NAME} /V /FO LIST`);
}

function uninstallService() {
  ensureWindows();
  if (!isElevated()) {
    throw new Error("Uninstalling the service requires administrator rights.");
  }
  spawnSync("schtasks", ["/End", "/TN", TASK_NAME], { stdio: "ignore" });
  const r = spawnSync("schtasks", ["/Delete", "/TN", TASK_NAME, "/F"], { stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(
      `schtasks /Delete failed (exit ${r.status}). The task may not exist — that's fine.`,
    );
  }
  console.log(`✓ Removed scheduled task '${TASK_NAME}'.`);
}

function startService() {
  ensureWindows();
  const r = spawnSync("schtasks", ["/Run", "/TN", TASK_NAME], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`schtasks /Run failed (exit ${r.status}).`);
}

function stopService() {
  ensureWindows();
  const r = spawnSync("schtasks", ["/End", "/TN", TASK_NAME], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`schtasks /End failed (exit ${r.status}).`);
}

function statusService() {
  ensureWindows();
  spawnSync("schtasks", ["/Query", "/TN", TASK_NAME, "/V", "/FO", "LIST"], { stdio: "inherit" });
}

module.exports = {
  TASK_NAME,
  installService,
  uninstallService,
  startService,
  stopService,
  statusService,
  // exported for tests
  buildTaskRunString,
};
