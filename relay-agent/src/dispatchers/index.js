"use strict";

const zkteco = require("./zkteco");
const hikvision = require("./hikvision");
const generic = require("./generic");

const DISPATCHERS = {
  zkteco,
  essl: zkteco,
  realtime: zkteco,
  hikvision,
  // Brands without a bespoke dispatcher fall back to the generic HTTP one,
  // which logs the queued command and acks it. Operators can swap in the
  // real native call as their site requires.
  suprema: generic,
  matrix: generic,
  anviz: generic,
  dahua: generic,
  idemia: generic,
  virdi: generic,
  hid: generic,
};

function getDispatcher(brand) {
  return DISPATCHERS[String(brand || "").toLowerCase()] || generic;
}

module.exports = { getDispatcher };
