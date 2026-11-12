import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderAetheriaIcon(size, maskablePadding = 0) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const scale = (1 - maskablePadding * 2) * (size / 512);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / scale;
      const dy = (y - cy) / scale;
      const dist = Math.hypot(dx, dy);

      // Deep celestial radial gradient background
      const bgT = Math.min(1, Math.hypot(x - cx, y - cy) / (size * 0.72));
      let r = Math.round(23 * (1 - bgT) + 7 * bgT);
      let g = Math.round(37 * (1 - bgT) + 9 * bgT);
      let b = Math.round(84 * (1 - bgT) + 15 * bgT);

      // Outer gold ring
      if (Math.abs(dist - 186) < 8) {
        r = 232; g = 196; b = 104;
      }
      // Inner cyan ring
      else if (Math.abs(dist - 150) < 3.5) {
        r = 56; g = 189; b = 248;
      }

      // Astral diamond frame: |dx|/102 + |dy|/180 == 1
      const dDiamond = Math.abs(dx) / 102 + Math.abs(dy) / 180;
      if (Math.abs(dDiamond - 1) < 0.085) {
        r = 56; g = 189; b = 248;
      }

      // Central golden core & cyan inner spark
      if (dist < 44) {
        r = 232; g = 196; b = 104;
      }
      if (dist < 20) {
        r = 224; g = 242; b = 254;
      }

      const idx = (y * size + x) * 4;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

const pubDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(pubDir, { recursive: true });
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), renderAetheriaIcon(192, 0.04));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), renderAetheriaIcon(512, 0.04));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), renderAetheriaIcon(512, 0.16));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), renderAetheriaIcon(180, 0.04));
console.log('Generated PWA PNG icons in public/');
