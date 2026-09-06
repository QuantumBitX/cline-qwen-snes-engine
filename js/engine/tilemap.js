// ============================================================
//  tilemap.js — multi-layer tile store + query API (Phase 1)
//
//  Wraps a level's collision layer (a flat Uint8Array of char codes,
//  produced by engine/level.js) behind a small query API:
//    tileAt(tx, ty)  -> tile char at (tx, ty)          (in-bounds)
//    solidAt(tx, ty) -> is that tile solid?            (in-bounds)
//    set(tx, ty, c)  -> write a tile char (bumps / breaks)
//    rows()          -> H x W array-of-arrays-of-chars snapshot, matching
//                       the legacy hardcoded grid shape (inspection + the
//                       1:1 grid-diff against js/level.js)
//    slope(tx, ty)   -> {hL,hR} height data or null    (Phase 3)
//    isOneWay(tx,ty) -> is that tile a one-way platform (Phase 3)
//    surfaceYAt(x,y) -> interpolated surface Y or null  (Phase 3)
//
//  A fresh tilemap COPIES the level's initial collision buffer, so bumping
//  / breaking tiles during a life never mutates the source level data:
//  loadLevel() re-creates the tilemap from the pristine buffer each time.
//
//  Boundary handling (top/bottom -> empty, left/right -> solid) is a game
//  rule and stays in game.js; this module is a pure in-bounds query.
// ============================================================

import { TILE } from './constants.js';

const EMPTY = '.';
const EMPTY_CODE = EMPTY.charCodeAt(0);

// --- autotiling (Phase 2) ---
// Feature bits for the ground autotile. bakeAutotile() writes one bitmask per
// tile into tilemap.autotile; the renderer composites these over a dirt base.
// (Slopes are excluded from this mask path — they draw from dedicated frames
// in Phase 3 so their silhouettes stay clean.)
export const ATLAS = {
  dirt: 0,      // base body (no overlay)
  cap: 1,       // grass cap on top       (N empty)
  edgeL: 2,     // brighten left edge     (W empty)
  edgeR: 4,     // darken right edge      (E empty)
  cornerTL: 8,  // top-left corner cap    (N & W empty)
  cornerTR: 16, // top-right corner cap   (N & E empty)
};

// A tile is "ground" (part of the autotiled terrain) if it's `#` (authored
// ground) or `=` (explicit ground filler / dirt body). Both are solid; the
// autotile treats them identically.
function isGroundChar(c) { return c === '#' || c === '='; }

// --- Phase 3: slope height data + one-way detection ---
// slopeHeights(c) returns {hL, hR} for a tile char:
//   hL/hR = surface offset from tile TOP at the left/right edge (0..TILE).
//   Flat solid: {hL:0, hR:0} → surface at tile top.
//   '/' 45° up-right: {hL:16, hR:0} → left edge at bottom, right edge at top.
//   '\' 45° up-left:  {hL:0, hR:16} → left edge at top, right edge at bottom.
//   null for empty / one-way (handled separately).
function slopeHeights(c) {
  if (c === '.') return null;
  if (c === '-') return null;           // one-way: not a solid surface
  if (c === '/') return { hL: 16, hR: 0 };
  if (c === '\\') return { hL: 0, hR: 16 };
  return { hL: 0, hR: 0 };             // all other solid chars: flat
}

function isOneWayChar(c) { return c === '-'; }

export function createTilemap(levelData) {
  const w = levelData.w;
  const h = levelData.h;
  // copy the initial collision buffer so runtime mutations are isolated
  const data = new Uint8Array(levelData.layers.collision);

  const inBounds = (tx, ty) => tx >= 0 && tx < w && ty >= 0 && ty < h;

  return {
    get width() { return w; },
    get height() { return h; },

    tileAt(tx, ty) {
      if (!inBounds(tx, ty)) return EMPTY;
      return String.fromCharCode(data[ty * w + tx]);
    },
    solidAt(tx, ty) {
      if (!inBounds(tx, ty)) return false;
      return data[ty * w + tx] !== EMPTY_CODE;
    },
    // Phase 2: is this tile part of the autotiled ground (`#` or `=`)?
    // Out-of-bounds is false (the level edge reads as "empty" for the mask,
    // so the outer rim renders as a cliff face).
    isGround(tx, ty) {
      if (!inBounds(tx, ty)) return false;
      return isGroundChar(String.fromCharCode(data[ty * w + tx]));
    },
    // Phase 3: slope height data for a tile.
    // Returns {hL, hR} for solid tiles, null for empty/one-way.
    slope(tx, ty) {
      if (!inBounds(tx, ty)) return null;
      return slopeHeights(String.fromCharCode(data[ty * w + tx]));
    },
    // Phase 3: is this tile a one-way platform?
    isOneWay(tx, ty) {
      if (!inBounds(tx, ty)) return false;
      return isOneWayChar(String.fromCharCode(data[ty * w + tx]));
    },
    // Phase 3: surface Y (world pixels) at world-x, probing at probeY.
    // Returns the interpolated surface height, or null if no solid surface.
    surfaceYAt(x, probeY) {
      const tx = Math.floor(x / TILE), ty = Math.floor(probeY / TILE);
      if (!inBounds(tx, ty)) return null;
      const sh = slopeHeights(String.fromCharCode(data[ty * w + tx]));
      if (!sh) return null;
      const fx = (x - tx * TILE) / TILE;
      return ty * TILE + sh.hL + (sh.hR - sh.hL) * fx;
    },
    set(tx, ty, c) {
      if (!inBounds(tx, ty)) return;
      data[ty * w + tx] = c.charCodeAt(0);
    },
    // H x W array-of-arrays-of-chars snapshot (same shape as the legacy grid)
    rows() {
      const out = [];
      for (let y = 0; y < h; y++) {
        const row = new Array(w);
        for (let x = 0; x < w; x++) row[x] = String.fromCharCode(data[y * w + x]);
        out.push(row);
      }
      return out;
    },
  };
}

// --- bake the ground autotile mask (Phase 2; run once after load) ---
// Moore-neighbour mask, feature-rule sheet (ROADMAP Phase 2). For every ground
// tile we inspect its 8 neighbours and OR in the features that apply:
//   N empty -> grass cap;  W empty -> lit left edge;  E empty -> dark right edge;
//   N&W empty -> top-left corner cap;  N&E empty -> top-right corner cap.
// The result is stored as tilemap.autotile (Int16Array, one bitmask per tile;
// 0 for non-ground). This is a PURE rendering concern — it never touches the
// collision buffer, so gameplay / collision / grid-diff are unaffected.
export function bakeAutotile(tilemap) {
  const W = tilemap.width, H = tilemap.height;
  const out = new Int16Array(W * H);
  const g = (x, y) => x >= 0 && x < W && y >= 0 && y < H && tilemap.isGround(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!g(x, y)) { out[y * W + x] = 0; continue; }
      const N = g(x, y - 1), E = g(x + 1, y), Ws = g(x - 1, y);
      let idx = ATLAS.dirt;                 // default body
      if (!N) idx |= ATLAS.cap;
      if (!E) idx |= ATLAS.edgeR;
      if (!Ws) idx |= ATLAS.edgeL;
      if (!N && !E) idx |= ATLAS.cornerTR;
      if (!N && !Ws) idx |= ATLAS.cornerTL;
      out[y * W + x] = idx;
    }
  tilemap.autotile = out;
  return out;
}