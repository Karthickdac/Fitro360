"use strict";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function createLogger(level) {
  const min = LEVELS[level] || LEVELS.info;
  function emit(lvl, args) {
    if (LEVELS[lvl] < min) return;
    const ts = new Date().toISOString();
    const line = `[${ts}] ${lvl.toUpperCase()} ${args
      .map((a) => (typeof a === "string" ? a : safeJson(a)))
      .join(" ")}`;
    if (lvl === "error" || lvl === "warn") console.error(line);
    else console.log(line);
  }
  return {
    debug: (...a) => emit("debug", a),
    info: (...a) => emit("info", a),
    warn: (...a) => emit("warn", a),
    error: (...a) => emit("error", a),
  };
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

module.exports = { createLogger };
