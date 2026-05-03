#!/usr/bin/env node
// Minimal pure-Node ZIP writer (store + deflate). Used as a fallback
// in build-windows.sh when neither `zip` nor PowerShell's
// Compress-Archive is available on the build host (e.g. Replit).
//
// Produces a standard PKZIP-compatible archive. Deflate compression
// via node:zlib for everything except files already gzip-compressed
// upstream (the packaged .exe), which we store uncompressed because
// re-deflating compressed bytes is wasteful and won't shrink them.
//
// Usage:  node scripts/zip-dir.js <srcDir> <outZip>
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error("usage: zip-dir.js <srcDir> <outZip>");
  process.exit(2);
}

// CRC32 — minimal table-based implementation (matches RFC 1952 / PKZIP).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// DOS time/date for the local file header. Use mtime; if we hit
// pre-1980 we clamp to 1980-01-01 (zip's epoch).
function dosTimeDate(d) {
  const year = Math.max(1980, d.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >>> 1);
  return { dosDate, dosTime };
}

function* walk(dir, base = "") {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? base + "/" + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) yield* walk(full, rel);
    else if (st.isFile()) yield { full, rel, st };
  }
}

const chunks = [];
const central = [];
let offset = 0;

for (const entry of walk(SRC)) {
  const data = fs.readFileSync(entry.full);
  // Files that are already compressed upstream (.exe via pkg --compress
  // GZip, .zip, .gz) — store uncompressed.
  const noCompress = /\.(exe|zip|gz|png|jpg|jpeg)$/i.test(entry.rel);
  const compressed = noCompress ? data : zlib.deflateRawSync(data, { level: 9 });
  const useStore = noCompress || compressed.length >= data.length;
  const payload = useStore ? data : compressed;
  const method = useStore ? 0 : 8;

  const crc = crc32(data);
  const nameBuf = Buffer.from(entry.rel, "utf8");
  const { dosDate, dosTime } = dosTimeDate(entry.st.mtime);

  // ─── Local file header ───
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); // signature
  lfh.writeUInt16LE(20, 4); // version needed
  lfh.writeUInt16LE(0x0800, 6); // flags: utf-8 filename
  lfh.writeUInt16LE(method, 8);
  lfh.writeUInt16LE(dosTime, 10);
  lfh.writeUInt16LE(dosDate, 12);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(payload.length, 18); // compressed size
  lfh.writeUInt32LE(data.length, 22); // uncompressed size
  lfh.writeUInt16LE(nameBuf.length, 26);
  lfh.writeUInt16LE(0, 28); // extra length
  chunks.push(lfh, nameBuf, payload);

  // ─── Central directory entry ───
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4); // version made by
  cdh.writeUInt16LE(20, 6); // version needed
  cdh.writeUInt16LE(0x0800, 8); // flags
  cdh.writeUInt16LE(method, 10);
  cdh.writeUInt16LE(dosTime, 12);
  cdh.writeUInt16LE(dosDate, 14);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(payload.length, 20);
  cdh.writeUInt32LE(data.length, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt16LE(0, 30); // extra
  cdh.writeUInt16LE(0, 32); // comment
  cdh.writeUInt16LE(0, 34); // disk number
  cdh.writeUInt16LE(0, 36); // internal attrs
  cdh.writeUInt32LE(0, 38); // external attrs
  cdh.writeUInt32LE(offset, 42); // relative offset of local header
  central.push({ cdh, name: nameBuf });

  offset += lfh.length + nameBuf.length + payload.length;
}

const cdStart = offset;
let cdSize = 0;
for (const c of central) {
  chunks.push(c.cdh, c.name);
  cdSize += c.cdh.length + c.name.length;
}

// ─── End of central directory ───
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4); // disk
eocd.writeUInt16LE(0, 6); // disk with cd
eocd.writeUInt16LE(central.length, 8);
eocd.writeUInt16LE(central.length, 10);
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(cdStart, 16);
eocd.writeUInt16LE(0, 20); // comment length
chunks.push(eocd);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat(chunks));
console.log(`wrote ${OUT} (${central.length} files, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
