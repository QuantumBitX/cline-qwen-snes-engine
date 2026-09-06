// ============================================================
//  gen-sprites.mjs — generate placeholder PNG sprite sheets
//  Run: node tools/gen-sprites.mjs
//
//  Creates simple colored-rectangle PNGs in assets/sprites/
//  so the sprite sheet engine can be tested end-to-end before
//  final art is produced.
// ============================================================
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'assets', 'sprites');
mkdirSync(OUT_DIR, { recursive: true });

// --- minimal PNG encoder (RGBA, 8-bit) ---
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Encode a PNG from RGBA pixel data.
 */
function encodePNG(w, h, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  ihdr[9] = 6;  ihdr[10] = 0;  ihdr[11] = 0;  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < w * 4; x++) {
      raw[rowStart + 1 + x] = pixels[y * w * 4 + x];
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function solidImage(w, h, r, g, b, a = 255) {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i*4]=r; px[i*4+1]=g; px[i*4+2]=b; px[i*4+3]=a; }
  return px;
}

function markCell(px, cellX, cellY, cellW, cellH, r, g, b) {
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++) {
      const idx = ((cellY + dy) * cellW + (cellX + dx)) * 4;
      px[idx]=r; px[idx+1]=g; px[idx+2]=b; px[idx+3]=255;
    }
}

// --- generate: player sheet (4×2 grid of 16×16 = 64×32) ---
function genPlayer() {
  const CW = 16, CH = 16, COLS = 4, ROWS = 2;
  const W = COLS * CW, H = ROWS * CH;
  const px = solidImage(W, H, 0, 0, 0, 0);
  const colors = [
    [220,42,8],[255,140,0],[255,210,0],[0,200,80],
    [0,100,255],[160,0,255],[0,220,220],[200,200,200],
  ];
  for (let i = 0; i < 8; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CW, cy = row * CH;
    for (let y = cy+2; y < cy+CH-2; y++)
      for (let x = cx+2; x < cx+CW-2; x++) {
        const idx = (y*W+x)*4;
        px[idx]=colors[i][0]; px[idx+1]=colors[i][1]; px[idx+2]=colors[i][2]; px[idx+3]=255;
      }
    markCell(px, cx, cy, CW, CH, 0, 0, 0);
  }
  writeFileSync(resolve(OUT_DIR, 'player.png'), encodePNG(W, H, px));
  console.log('  player.png  ' + W + 'x' + H + '  (4x2 grid, 16x16 cells)');
}

// --- generate: goomba sheet (2×1 grid of 16×16 = 32×16) ---
function genGoomba() {
  const CW = 16, CH = 16, W = 32, H = 16;
  const px = solidImage(W, H, 0, 0, 0, 0);
  const colors = [[177,94,30],[140,70,20]];
  for (let i = 0; i < 2; i++) {
    const cx = i * CW;
    for (let y = 2; y < CH-2; y++)
      for (let x = cx+2; x < cx+CW-2; x++) {
        const idx = (y*W+x)*4;
        px[idx]=colors[i][0]; px[idx+1]=colors[i][1]; px[idx+2]=colors[i][2]; px[idx+3]=255;
      }
    markCell(px, cx, 0, CW, CH, 0, 0, 0);
  }
  writeFileSync(resolve(OUT_DIR, 'goomba.png'), encodePNG(W, H, px));
  console.log('  goomba.png  ' + W + 'x' + H + '  (2x1 grid, 16x16 cells)');
}

// --- generate: mushroom sheet (1×1 = 16×16) ---
function genMushroom() {
  const W = 16, H = 16;
  const px = solidImage(W, H, 0, 0, 0, 0);
  for (let y = 2; y < 10; y++)
    for (let x = 2; x < 14; x++) {
      const idx = (y*W+x)*4;
      px[idx]=220; px[idx+1]=42; px[idx+2]=8; px[idx+3]=255;
    }
  for (let y = 10; y < 14; y++)
    for (let x = 4; x < 12; x++) {
      const idx = (y*W+x)*4;
      px[idx]=252; px[idx+1]=252; px[idx+2]=252; px[idx+3]=255;
    }
  for (const [dx,dy] of [[5,4],[10,4],[7,7]]) {
    const idx = (dy*W+dx)*4;
    px[idx]=252; px[idx+1]=252; px[idx+2]=252; px[idx+3]=255;
  }
  writeFileSync(resolve(OUT_DIR, 'mushroom.png'), encodePNG(W, H, px));
  console.log('  mushroom.png ' + W + 'x' + H + '  (1x1, 16x16)');
}

console.log('Generating placeholder sprite sheets in ' + OUT_DIR + '/');
genPlayer();
genGoomba();
genMushroom();
console.log('Done.');
