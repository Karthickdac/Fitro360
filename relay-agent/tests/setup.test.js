"use strict";

// End-to-end test for the interactive setup wizard:
//   1. Drives it via piped stdin (the same code path install.bat hits)
//   2. Confirms the resulting config.json passes loadConfig() validation
//   3. Re-runs the wizard against the same file with "keep existing
//      devices" + a new log level and confirms only the metadata changed.
//
// Regression guard for the readline pipe race that previously caused the
// wizard to exit silently after the second prompt.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { loadConfig } = require("../src/config");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "f360-setup-"));
const cfgPath = path.join(tmpDir, "config.json");

function runWizard(answers) {
  return spawnSync(
    process.execPath,
    [
      "-e",
      `require('./src/setup').runWizard({configPath:${JSON.stringify(cfgPath)}}).catch(e=>{console.error(e);process.exit(1)})`,
    ],
    { input: answers, encoding: "utf8", cwd: path.resolve(__dirname, "..") },
  );
}

// 1. Initial wizard run.
let r = runWizard(
  [
    "https://app.fitro360.com", // cloudUrl
    "5", // poll seconds
    "info", // log level
    "zkteco", // brand
    "ZK-TEST-1", // serial
    "the-secret", // secret
    "192.168.1.50", // host
    "80", // port
    "admin", // user
    "devpwd", // password
    "n", // add another? no
  ].join("\n") + "\n",
);
if (r.status !== 0) {
  console.error("STDOUT:", r.stdout);
  console.error("STDERR:", r.stderr);
  throw new Error(`wizard exited ${r.status}`);
}
if (!fs.existsSync(cfgPath)) throw new Error("wizard did not write config.json");

let cfg = loadConfig(cfgPath);
if (cfg.devices.length !== 1) throw new Error("expected 1 device");
if (cfg.devices[0].serial !== "ZK-TEST-1") throw new Error("serial wrong");
if (cfg.devices[0].secret !== "the-secret") throw new Error("secret wrong");
if (cfg.devices[0].brand !== "zkteco") throw new Error("brand wrong");
if (cfg.logLevel !== "info") throw new Error("logLevel wrong");

// 2. Re-run, keep devices, change log level to debug.
r = runWizard(
  ["y", "https://app.fitro360.com", "5", "debug", "n"].join("\n") + "\n",
);
if (r.status !== 0) throw new Error(`re-run exited ${r.status}: ${r.stderr}`);
cfg = loadConfig(cfgPath);
if (cfg.logLevel !== "debug") throw new Error("re-run did not update log level");
if (cfg.devices.length !== 1 || cfg.devices[0].serial !== "ZK-TEST-1") {
  throw new Error("re-run dropped existing device");
}

// 3. Validate that an HTTP cloudUrl without explicit insecure-opt-in is rejected.
//    (We answer "n" to the insecure prompt — wizard should bail.)
r = runWizard(["http://localhost:5000", "n"].join("\n") + "\n");
const httpCfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
if (httpCfg.allowInsecureCloudUrl === true) {
  throw new Error("insecure flag was set despite user declining");
}

// 4. schtasks /TR string must escape both .exe path AND config path
//    even when the paths contain spaces — otherwise the boot service
//    silently fails to launch.
const { buildTaskRunString } = require("../src/service-win");
const fakeCfg = "C:\\ProgramData\\Fitro360\\config.json";
const tr = buildTaskRunString(fakeCfg);
// Each path must be wrapped in BACKSLASH-escaped quotes so schtasks
// preserves them after stripping its own outer quoting layer.
if (!tr.includes(`\\"${process.execPath}\\"`)) {
  throw new Error(`/TR did not escape execPath: ${tr}`);
}
if (!tr.includes(`\\"${fakeCfg}\\"`)) {
  throw new Error(`/TR did not escape config path: ${tr}`);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("OK — setup wizard end-to-end test passed");
