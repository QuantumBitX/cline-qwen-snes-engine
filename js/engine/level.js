// ============================================================
//  level.js — JSON level loader (Phase 1)
//
//  Turns a parsed level JSON object into a compact, typed in-memory
//  representation:
//    - each layer (background / collision / foreground) is a flat
//      Uint8Array of character codes (one byte per tile, row-major),
//      so a 176x15 level is a single 2640-byte buffer instead of 2640
//      per-cell string allocations;
//    - the pixel-anchored `entities` list is resolved into the exact
//      coins / enemies / flag structures the game consumes.
//
//  The raw-JSON "transport" is injectable (setLevelTransport) so the
//  browser can use fetch() and the headless Node harness can read the
//  file from disk. Level data is loaded ONCE before boot, so the
//  loadLevel() call site in game.js stays synchronous and the game
//  loop is never made async.
//
//  Format spec: assets/levels/README.md (and ROADMAP_SNES_UPGRADE.md
//  Phase 1). One char per tile, resolved through the shared legend.
// ============================================================

const EMPTY = '.';

// --- rows (array of equal-length strings) -> flat Uint8Array of codes ---
// Row-major, y then x. A space is normalised to '.' (empty) so levels can
// be authored with either convention; the 1-1 JSON already uses '.'.
function rowsToCodes(rows, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = (typeof row === 'string' && x < row.length) ? row[x] : ' ';
      out[y * w + x] = (ch === ' ') ? EMPTY.charCodeAt(0) : ch.charCodeAt(0);
    }
  }
  return out;
}

// --- resolve the pixel-anchored entity list into game structures ---
// coin   -> { x, y, w:12, h:12 }
// goomba -> { x, y, w:14, h:14, vx:-speed }   (speed defaults to 0.5)
// flag   -> { col, topRow, baseRow }          (col derived from the pole x)
function resolveEntities(list, tileSize) {
  const coins = [];
  const enemies = [];
  let flag = null;
  for (const e of list) {
    switch (e.type) {
      case 'coin':
        coins.push({ x: e.x, y: e.y, w: 12, h: 12 });
        break;
      case 'goomba':
        enemies.push({ x: e.x, y: e.y, w: 14, h: 14, vx: -(e.speed ?? 0.5) });
        break;
      case 'flag':
        flag = { col: Math.round((e.x - 8) / tileSize), topRow: e.topRow, baseRow: e.baseRow };
        break;
      default:
        throw new Error('level: unknown entity type "' + e.type + '"');
    }
  }
  return { coins, enemies, flag };
}

// --- pure: parsed JSON -> typed LevelData (with a schema check) ---
// The schema check gives safe authoring without a linter: a malformed map
// throws a clear, actionable error instead of silently building a bad level.
export function parseLevel(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('level: not a JSON object');
  const w = raw.width | 0;
  const h = raw.height | 0;
  if (!(w > 0) || !(h > 0)) throw new Error('level: width/height must be positive integers');
  const tileSize = raw.tileSize || 16;
  if (!(tileSize > 0)) throw new Error('level: tileSize must be positive');

  const layers = raw.layers;
  if (!layers || !Array.isArray(layers.collision)) {
    throw new Error('level: layers.collision (array of row strings) is required');
  }
  if (layers.collision.length !== h) {
    throw new Error('level: layers.collision must have exactly ' + h + ' rows, got ' + layers.collision.length);
  }
  for (let y = 0; y < h; y++) {
    const row = layers.collision[y];
    if (typeof row !== 'string') throw new Error('level: collision row ' + y + ' must be a string');
    if (row.length > w) throw new Error('level: collision row ' + y + ' is ' + row.length + ' chars, wider than width ' + w);
  }

  const { coins, enemies, flag } = resolveEntities(Array.isArray(raw.entities) ? raw.entities : [], tileSize);

  return {
    id: raw.id || 'level',
    tileSize, w, h,
    camera: raw.camera || { mode: 'follow', lead: 0.35 },
    spawn: raw.spawn || { x: 2 * tileSize, y: (h - 1) * tileSize - 14 },
    parallax: Array.isArray(raw.parallax) ? raw.parallax.slice() : [],
    layers: {
      background: layers.background ? rowsToCodes(layers.background, w, h) : null,
      collision: rowsToCodes(layers.collision, w, h),
      foreground: layers.foreground ? rowsToCodes(layers.foreground, w, h) : null,
    },
    coins, enemies, flag,
  };
}

// --- injectable transport: (url) => Promise<parsedJson> ---
// The browser installs a fetch()-based transport; the Node harness installs
// a disk-reading one. Keeping it injectable means this module never imports
// node:* or touches the DOM directly.
let transport = null;
export function setLevelTransport(fn) { transport = fn; }
export function getLevelTransport() { return transport; }

// --- async loader: fetch/read the raw JSON, then parse it ---
export async function loadLevelData(url) {
  if (typeof transport !== 'function') {
    throw new Error('level: no transport installed (call setLevelTransport first)');
  }
  const raw = await transport(url);
  return parseLevel(raw);
}