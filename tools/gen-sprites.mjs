// ============================================================
//  gen-sprites.mjs — bake the real PNG sprite sheets
//  Run: node tools/gen-sprites.mjs
//
//  The pixel art comes from js/sprite-data.js (the single source
//  of truth). This bakes the ASCII frames into RGBA PNGs with a minimal, dependency-free
//  PNG encoder (Node's built-in zlib).
//
//  Sheet layout (dimensions + frame order are load-bearing — the
//  harness asserts them, and game.js slices the sheet by cell):
//    player.png       64x32, 4x2 of 16x16
//                     [0:idle][1:runA][2:runB][3:skid]
//                     [4:jump][5:fall][6:land][7:reserved]
//    player-big.png   64x64, 4x2 of 16x32  (same order; marioBig 28-row art)
//    player-fire.png  64x64, 4x2 of 16x32  (same rows, FIRE_PAL recolour)
//    goomba.png       32x16, 2x1 of 16x16   [0:A][1:B]
//    mushroom.png   16x16                 [0]
//    fireflower.png 16x16                 (unchanged procedural art)
// ============================================================
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARIO_PAL, FIRE_PAL, GOOMBA_PAL, MUSH_PAL,
  marioSmall, marioRunA, marioRunB, marioSkid,
  marioSmallJump, marioFall, marioLand,
  marioBig, marioBigRunA, marioBigRunB, marioBigSkid,
  marioBigJump, marioBigFall, marioBigLand,
  goomba, goombaB, mushroom,
} from '../js/sprite-data.js';

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

// --- frame rasterizer: ASCII rows + palette -> 16x16 RGBA cell ---
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Rasterize one frame (rows + palette) into a cellW x cellH RGBA buffer
 * with a transparent background. Short frames are bottom-aligned so the
 * feet/base sit on the ground (the cell's bottom edge).
 */
function renderFrame(rows, palette, cellW = 16, cellH = 16) {
  const px = new Uint8Array(cellW * cellH * 4);
  const top = cellH - rows.length;   // bottom-align
  for (let i = 0; i < rows.length; i++) {
    const y = top + i;
    if (y < 0 || y >= cellH) continue;
    const row = rows[i];
    for (let x = 0; x < row.length && x < cellW; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || ch === '_' || ch === undefined) continue;
      const col = palette[ch];
      if (!col) continue;
      const [r, g, b] = hexToRgb(col);
      const idx = (y * cellW + x) * 4;
      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255;
    }
  }
  return px;
}

/** Copy a cellW x cellH frame buffer into a sheet at (cellX, cellY). */
function blit(sheet, sheetW, frame, cellW, cellH, cellX, cellY) {
  for (let y = 0; y < cellH; y++)
    for (let x = 0; x < cellW; x++) {
      const si = ((cellY + y) * sheetW + (cellX + x)) * 4;
      const fi = (y * cellW + x) * 4;
      sheet[si] = frame[fi]; sheet[si + 1] = frame[fi + 1];
      sheet[si + 2] = frame[fi + 2]; sheet[si + 3] = frame[fi + 3];
    }
}

// --- generate: player sheet (4×2 grid of 16×16 = 64×32) ---
function genPlayer() {
  const CW = 16, CH = 16, COLS = 4, ROWS = 2;
  const W = COLS * CW, H = ROWS * CH;
  const px = new Uint8Array(W * H * 4);   // transparent
  // frame order: [0:idle][1:runA][2:runB][3:skid][4:jump][5:fall][6:land][7:reserved]
  const frames = [
    [marioSmall, MARIO_PAL],
    [marioRunA, MARIO_PAL],
    [marioRunB, MARIO_PAL],
    [marioSkid, MARIO_PAL],
    [marioSmallJump, MARIO_PAL],
    [marioFall, MARIO_PAL],
    [marioLand, MARIO_PAL],
    null,   // 7: reserved — stays transparent
  ];
  frames.forEach((f, i) => {
    if (!f) return;
    const [rows, pal] = f;
    const col = i % COLS, row = Math.floor(i / COLS);
    blit(px, W, renderFrame(rows, pal, CW, CH), CW, CH, col * CW, row * CH);
  });
  writeFileSync(resolve(OUT_DIR, 'player.png'), encodePNG(W, H, px));
  console.log('  player.png   ' + W + 'x' + H + '  (4x2 grid, 16x16 cells)');
}

// --- generate: big player sheet (4×2 grid of 16×32 = 64×64) ---
// Same frame order as player.png, but the 28-row marioBig body (power-up form).
// The PNG baker bottom-aligns each 28-row frame in the 32px cell, so the feet
// sit on the cell's bottom edge — game.js derives the draw offset from the
// 32px cell height to keep the feet flush to the ground.
function genPlayerBig() {
  const CW = 16, CH = 32, COLS = 4, ROWS = 2;
  const W = COLS * CW, H = ROWS * CH;
  const px = new Uint8Array(W * H * 4);   // transparent
  const frames = [
    [marioBig, MARIO_PAL],           // 0: idle
    [marioBigRunA, MARIO_PAL],       // 1
    [marioBigRunB, MARIO_PAL],       // 2
    [marioBigSkid, MARIO_PAL],       // 3
    [marioBigJump, MARIO_PAL],       // 4
    [marioBigFall, MARIO_PAL],       // 5
    [marioBigLand, MARIO_PAL],       // 6
    null,                            // 7: reserved — stays transparent
  ];
  frames.forEach((f, i) => {
    if (!f) return;
    const [rows, pal] = f;
    const col = i % COLS, row = Math.floor(i / COLS);
    blit(px, W, renderFrame(rows, pal, CW, CH), CW, CH, col * CW, row * CH);
  });
  writeFileSync(resolve(OUT_DIR, 'player-big.png'), encodePNG(W, H, px));
  console.log('  player-big.png ' + W + 'x' + H + '  (4x2 grid, 16x32 cells)');
}

// --- generate: fire player sheet (4×2 grid of 16×32 = 64×64) ---
// Identical rows to the big sheet, recoloured with FIRE_PAL (red/white swap).
function genPlayerFire() {
  const CW = 16, CH = 32, COLS = 4, ROWS = 2;
  const W = COLS * CW, H = ROWS * CH;
  const px = new Uint8Array(W * H * 4);   // transparent
  const frames = [
    [marioBig, FIRE_PAL],            // 0: idle
    [marioBigRunA, FIRE_PAL],        // 1
    [marioBigRunB, FIRE_PAL],        // 2
    [marioBigSkid, FIRE_PAL],        // 3
    [marioBigJump, FIRE_PAL],        // 4
    [marioBigFall, FIRE_PAL],        // 5
    [marioBigLand, FIRE_PAL],        // 6
    null,                            // 7: reserved — stays transparent
  ];
  frames.forEach((f, i) => {
    if (!f) return;
    const [rows, pal] = f;
    const col = i % COLS, row = Math.floor(i / COLS);
    blit(px, W, renderFrame(rows, pal, CW, CH), CW, CH, col * CW, row * CH);
  });
  writeFileSync(resolve(OUT_DIR, 'player-fire.png'), encodePNG(W, H, px));
  console.log('  player-fire.png ' + W + 'x' + H + '  (4x2 grid, 16x32 cells)');
}

// --- generate: goomba sheet (2×1 grid of 16×16 = 32×16) ---
function genGoomba() {
  const CW = 16, CH = 16, W = 32, H = 16;
  const px = new Uint8Array(W * H * 4);   // transparent
  const frames = [
    [goomba, GOOMBA_PAL],   // 0: A
    [goombaB, GOOMBA_PAL],  // 1: B (feet swapped)
  ];
  frames.forEach(([rows, pal], i) => {
    blit(px, W, renderFrame(rows, pal, CW, CH), CW, CH, i * CW, 0);
  });
  writeFileSync(resolve(OUT_DIR, 'goomba.png'), encodePNG(W, H, px));
  console.log('  goomba.png   ' + W + 'x' + H + '  (2x1 grid, 16x16 cells)');
}

// --- generate: mushroom sheet (1×1 = 16×16) ---
function genMushroom() {
  const W = 16, H = 16;
  const px = new Uint8Array(W * H * 4);   // transparent
  blit(px, W, renderFrame(mushroom, MUSH_PAL, W, H), W, H, 0, 0);
  writeFileSync(resolve(OUT_DIR, 'mushroom.png'), encodePNG(W, H, px));
  console.log('  mushroom.png ' + W + 'x' + H + '  (1x1, 16x16)');
}

// --- generate: fire flower sheet (1×1 = 16×16) ---
// Phase 7b. A simple fire-petal flower: orange/red petals, yellow core,
// green stem — distinct from the mushroom so the fire power reads clearly.
function genFireflower() {
  const W = 16, H = 16;
  const px = new Uint8Array(W * H * 4);
  const put = (x, y, r, g, b) => { const i = (y * W + x) * 4; px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255; };
  // stem (green)
  for (let y = 11; y < 15; y++) for (let x = 7; x < 9; x++) put(x, y, 40, 180, 60);
  // petals (orange ring)
  for (let y = 3; y < 11; y++) for (let x = 3; x < 13; x++) {
    const dx = x - 7, dy = y - 7, d = Math.sqrt(dx*dx + dy*dy);
    if (d < 5.5) put(x, y, 255, 140, 0);
  }
  // inner petals (red)
  for (let y = 4; y < 10; y++) for (let x = 4; x < 12; x++) {
    const dx = x - 7, dy = y - 7, d = Math.sqrt(dx*dx + dy*dy);
    if (d < 3.2) put(x, y, 220, 42, 8);
  }
  // yellow core
  for (let y = 5; y < 9; y++) for (let x = 5; x < 11; x++) {
    const dx = x - 7, dy = y - 7, d = Math.sqrt(dx*dx + dy*dy);
    if (d < 2.0) put(x, y, 255, 220, 0);
  }
  writeFileSync(resolve(OUT_DIR, 'fireflower.png'), encodePNG(W, H, px));
  console.log('  fireflower.png ' + W + 'x' + H + '  (1x1, 16x16)');
}

console.log('Baking real sprite sheets into ' + OUT_DIR + '/');
genPlayer();
genPlayerBig();
genPlayerFire();
genGoomba();
genMushroom();
genFireflower();
console.log('Done.');
