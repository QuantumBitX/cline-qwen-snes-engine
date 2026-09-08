// ============================================================
//  Sprites - pixel-art data + palette -> offscreen canvases
//  Built once at load. The builder is tolerant: a short row is
//  padded with transparency, so minor authoring slips are safe.
//
//  The pixel art itself (palettes + ASCII rows) now lives in
//  sprite-data.js so the same source feeds both this canvas
//  builder and the PNG baker (tools/gen-sprites.mjs).
// ============================================================
import {
  MARIO_PAL, GOOMBA_PAL, MUSH_PAL,
  marioSmall as marioSmallRows,
  marioSmallJump as marioSmallJumpRows,
  marioBig as marioBigRows,
  marioRunA as marioRunARows,
  marioRunB as marioRunBRows,
  marioSkid as marioSkidRows,
  marioLand as marioLandRows,
  marioFall as marioFallRows,
  goomba as goombaRows,
  goombaB as goombaBRows,
  mushroom as mushroomRows,
} from './sprite-data.js';

function buildSprite(rows, palette) {
    let w = 0;
    for (let i = 0; i < rows.length; i++) if (rows[i].length > w) w = rows[i].length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = rows.length;
    const c = cv.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const ch = x < row.length ? row[x] : '.';
        if (ch === '.' || ch === ' ' || ch === '_' || ch === undefined) continue;
        const col = palette[ch];
        if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
      }
    }
    return cv;
  }

  const marioSmall = buildSprite(marioSmallRows, MARIO_PAL);
  const marioSmallJump = buildSprite(marioSmallJumpRows, MARIO_PAL);
  const marioBig = buildSprite(marioBigRows, MARIO_PAL);
  const goomba = buildSprite(goombaRows, GOOMBA_PAL);
  const mushroom = buildSprite(mushroomRows, MUSH_PAL);

  // New animation frames (reachable in-browser; the PNG is the primary path)
  const marioRunA = buildSprite(marioRunARows, MARIO_PAL);
  const marioRunB = buildSprite(marioRunBRows, MARIO_PAL);
  const marioSkid = buildSprite(marioSkidRows, MARIO_PAL);
  const marioLand = buildSprite(marioLandRows, MARIO_PAL);
  const marioFall = buildSprite(marioFallRows, MARIO_PAL);
  const goombaB = buildSprite(goombaBRows, GOOMBA_PAL);

export const Sprites = { marioSmall, marioSmallJump, marioBig, goomba, mushroom, marioRunA, marioRunB, marioSkid, marioLand, marioFall, goombaB, buildSprite };

  // Dev validation (open DevTools console to inspect)
  (function () {
    const d = (o) => o.width + 'x' + o.height;
    const dims = { marioSmall: d(marioSmall), marioSmallJump: d(marioSmallJump), marioBig: d(marioBig), goomba: d(goomba), mushroom: d(mushroom) };
    console.log('[Sprites] ready', dims);
  })();
