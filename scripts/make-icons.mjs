// Area11 — PWA icons banane wala chhota script (koi extra library nahi)
//   node scripts/make-icons.mjs
// Emerald background + safaid cross (pharmacy) -> public/icons/*.png
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** emerald tiles + white cross; `pad` = maskable ke liye andar khali jagah */
function draw(size, pad = 0) {
  const m = size * pad;              // kinare ki chhut
  const inner = size - m * 2;
  const armW = inner * 0.22;         // cross ki motai
  const armL = inner * 0.62;         // cross ki lambai
  const cx = size / 2, cy = size / 2;
  return png(size, (x, y) => {
    if (x < m || y < m || x > size - m || y > size - m) return [255, 255, 255, 0];
    // halka sa gradient (upar gehra, neeche halka emerald)
    const t = y / size;
    const r = Math.round(4 + 10 * t), g = Math.round(105 + 30 * t), b = Math.round(78 + 20 * t);
    const inCrossX = Math.abs(x - cx) <= armW / 2 && Math.abs(y - cy) <= armL / 2;
    const inCrossY = Math.abs(y - cy) <= armW / 2 && Math.abs(x - cx) <= armL / 2;
    if (inCrossX || inCrossY) return [255, 255, 255, 255];
    return [r, g, b, 255];
  });
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", draw(192));
writeFileSync("public/icons/icon-512.png", draw(512));
writeFileSync("public/icons/maskable-512.png", draw(512, 0.12));
console.log("icons ban gaye: public/icons/{icon-192,icon-512,maskable-512}.png");
