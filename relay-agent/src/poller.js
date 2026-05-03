"use strict";

const { fetchCommands, ackCommand } = require("./api");
const { getDispatcher } = require("./dispatchers");

class Poller {
  constructor(cfg, log) {
    this.cfg = cfg;
    this.log = log;
    this.timers = new Map();
    this.stopped = false;
  }

  start() {
    for (const device of this.cfg.devices) {
      const tick = () => this.pollOne(device).finally(() => {
        if (this.stopped) return;
        // Note: do NOT call unref() — these recurring timers are the
        // only thing keeping the daemon process alive between polls.
        // unref()-ing them would let Node exit as soon as the event
        // loop went idle, defeating the whole long-running agent.
        const t = setTimeout(tick, this.cfg.pollIntervalMs);
        this.timers.set(device.serial, t);
      });
      tick();
    }
  }

  stop() {
    this.stopped = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  async drainOnce() {
    await Promise.all(this.cfg.devices.map((d) => this.pollOne(d)));
  }

  // Retry the ack with exponential backoff so transient cloud / network
  // hiccups don't strand commands in `picked_up` on the cloud queue.
  // We give up after a bounded number of attempts and log loudly so the
  // operator can investigate; the next poll cycle will re-deliver any
  // commands the cloud still considers pending.
  async ackWithRetry(device, cmd, outcome) {
    const status = outcome.ok ? "done" : "failed";
    const errMsg = outcome.ok ? undefined : outcome.error;
    const maxAttempts = 5;
    let delay = 500;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.stopped) return;
      try {
        await ackCommand(this.cfg.cloudUrl, device, cmd.id, status, errMsg);
        this.log.info(
          `[${device.serial}] ack ${cmd.id} ${status}` +
            (outcome.ok ? "" : `: ${outcome.error}`) +
            (attempt > 1 ? ` (attempt ${attempt})` : ""),
        );
        return;
      } catch (e) {
        if (attempt === maxAttempts) {
          this.log.error(
            `[${device.serial}] ack ${cmd.id} gave up after ${attempt} attempts: ${e.message}`,
          );
          return;
        }
        this.log.warn(
          `[${device.serial}] ack ${cmd.id} attempt ${attempt} failed: ${e.message}; retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 8000);
      }
    }
  }

  async pollOne(device) {
    try {
      const result = await fetchCommands(this.cfg.cloudUrl, device);
      if (!result.ok) {
        if (result.retriable) this.log.warn(`[${device.serial}] poll: ${result.error}`);
        else this.log.error(`[${device.serial}] poll: ${result.error}`);
        return;
      }
      const cmds = result.commands;
      if (cmds.length === 0) {
        this.log.debug(`[${device.serial}] no pending commands`);
        return;
      }
      this.log.info(`[${device.serial}] received ${cmds.length} command(s)`);
      const dispatcher = getDispatcher(device.brand);
      for (const cmd of cmds) {
        let outcome;
        try {
          outcome = await dispatcher.execute(device, cmd, this.log);
        } catch (e) {
          outcome = { ok: false, error: e.message };
        }
        await this.ackWithRetry(device, cmd, outcome);
      }
    } catch (e) {
      this.log.error(`[${device.serial}] unexpected: ${e.message}`);
    }
  }
}

module.exports = { Poller };
