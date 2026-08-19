/**
 * Generates the app icons from the same pixel grid the sprites use.
 *
 * Written by hand rather than pulled from a canvas so the icons are
 * reproducible: `npm run icons` regenerates them byte-for-byte.
 */
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0xf6, 0xf5, 0xf2];
const BLUE = [0x37, 0x8a, 0xdd];

/** rgba(0,0,0,.28) composited over an opaque colour. */
const shade = ([r, g, b]) => [r, g, b].map((c) => Math.round(c * 0.72));

// A half-sleeve t-shirt on the same 16x16 grid as src/sprites/shapes.ts.
const RECTS = [
  [4, 3, 8, 11, BLUE],
  [1, 3, 3, 4, BLUE],
  [12, 3, 3, 4, BLUE],
  [4, 3, 1, 4, shade(BLUE)],
  [11, 3, 1, 4, shade(BLUE)],
  [6, 3, 4, 2, shade(BLUE)],
];

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  const body = out.subarray(4, 8 + data.length);
  out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
  return out;
}

function render(size) {
  const unit = size / 16;
  const at = (v) => Math.round(v * unit);

  // One filter byte (0 = none) plus RGB per pixel, per scanline.
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * stride + 1 + x * 3;
      raw[i] = BG[0];
      raw[i + 1] = BG[1];
      raw[i + 2] = BG[2];
    }
  }

  for (const [rx, ry, rw, rh, colour] of RECTS) {
    for (let y = at(ry); y < at(ry + rh); y += 1) {
      for (let x = at(rx); x < at(rx + rw); x += 1) {
        const i = y * stride + 1 + x * 3;
        raw[i] = colour[0];
        raw[i + 1] = colour[1];
        raw[i + 2] = colour[2];
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = `public/icon-${size}.png`;
  writeFileSync(file, render(size));
  console.log(`${file} written`);
}
