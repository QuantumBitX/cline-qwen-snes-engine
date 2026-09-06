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
//
//  A fresh tilemap COPIES the level's initial collision buffer, so bumping
//  / breaking tiles during a life never mutates the source level data:
//  loadLevel() re-creates the tilemap from the pristine buffer each time.
//
//  Boundary handling (top/bottom -> empty, left/right -> solid) is a game
//  rule and stays in game.js; this module is a pure in-bounds query.
// ============================================================

const EMPTY = '.';
const EMPTY_CODE = EMPTY.charCodeAt(0);

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