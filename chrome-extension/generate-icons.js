/**
 * EdgeIQ — Icon Generator
 * Pure Node.js — no external dependencies.
 * Generates valid PNG files using zlib deflate + manual CRC32.
 * Run: node generate-icons.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── Colour palette ───────────────────────────────────────────────────────────
const BG_R = 0x0a, BG_G = 0x0f, BG_B = 0x1a;   // dark navy  #0a0f1a
const GR_R = 0x39, GR_G = 0xd9, GR_B = 0x7c;   // green      #39d97c
const RIM_R = 0x1e, RIM_G = 0x2a, RIM_B = 0x3a; // border     #1e2a3a

// ─── CRC32 table ─────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf, start = 0, end = buf.length) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── PNG chunk writer ─────────────────────────────────────────────────────────
function writeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);

  return Buffer.concat([len, typeBytes, data, crc]);
}

// ─── Pixel helper: is point inside bolt? ─────────────────────────────────────
/**
 * Draws a stylised lightning bolt centred in a unit square [0,1]x[0,1].
 * The bolt is defined by a filled polygon approximation.
 */
function inBolt(px, py, size) {
  // Normalise to [0,1]
  const x = px / size;
  const y = py / size;

  // Bolt polygon vertices (in unit square, origin top-left):
  // Top-right serif → diagonal down-left → inner notch right → bottom point → diagonal up-right → inner notch left → close
  const poly = [
    [0.55, 0.08],  // top-left of upper segment
    [0.72, 0.08],  // top-right
    [0.52, 0.48],  // mid-left
    [0.66, 0.48],  // mid-right
    [0.38, 0.92],  // bottom point
    [0.48, 0.52],  // lower-left inner
    [0.35, 0.52],  // further left
  ];

  return pointInPolygon(x, y, poly);
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  const n = poly.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

// ─── Generate pixel data for one icon ────────────────────────────────────────
function generatePixels(size) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1;           // circle radius
  const innerRadius = size / 2 - 2.5;   // inner fill radius

  // Row-filtered RGBA bytes
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r, g, b, a;

      if (dist > radius + 0.5) {
        // Fully outside — transparent
        r = 0; g = 0; b = 0; a = 0;
      } else if (dist > innerRadius) {
        // Thin border ring
        const alpha = Math.max(0, Math.min(1, (radius - dist + 0.5)));
        r = Math.round(RIM_R * alpha);
        g = Math.round(RIM_G * alpha);
        b = Math.round(RIM_B * alpha);
        a = Math.round(255 * alpha);
      } else {
        // Inside circle — background by default
        r = BG_R; g = BG_G; b = BG_B; a = 255;

        // Check if pixel is in the bolt shape
        if (inBolt(x, y, size)) {
          r = GR_R; g = GR_G; b = GR_B; a = 255;
        }
      }

      row.push(r, g, b, a);
    }
    rows.push(row);
  }

  return rows;
}

// ─── Build PNG buffer ─────────────────────────────────────────────────────────
function buildPNG(size) {
  const rows = generatePixels(size);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);        // width
  ihdrData.writeUInt32BE(size, 4);        // height
  ihdrData[8] = 8;                         // bit depth
  ihdrData[9] = 6;                         // colour type: RGBA
  ihdrData[10] = 0;                        // compression: deflate
  ihdrData[11] = 0;                        // filter: adaptive
  ihdrData[12] = 0;                        // interlace: none
  const ihdr = writeChunk('IHDR', ihdrData);

  // Build raw image data (filter byte 0 = None per row)
  const rawRows = [];
  for (const row of rows) {
    rawRows.push(0);           // filter type: None
    rawRows.push(...row);
  }
  const rawData = Buffer.from(rawRows);

  // Compress with zlib deflate (sync)
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = writeChunk('IDAT', compressed);

  // IEND chunk
  const iend = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const sizes = [16, 32, 48, 128];
  const iconsDir = path.join(__dirname, 'icons');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log('Created icons/ directory');
  }

  for (const size of sizes) {
    const pngBuffer = buildPNG(size);
    const outPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(outPath, pngBuffer);
    console.log(`Written: icons/icon${size}.png  (${pngBuffer.length} bytes)`);
  }

  console.log('\nAll icons generated successfully.');
  console.log('Load the extension in Chrome: chrome://extensions → Load unpacked → select chrome-extension/');
}

main();
