// ============================================================
//  Sprites - pixel-art data + palette -> offscreen canvases
//  Built once at load. The builder is tolerant: a short row is
//  padded with transparency, so minor authoring slips are safe.
// ============================================================
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

  const MARIO_PAL = { r: '#DC2A08', s: '#FAB878', h: '#5B3B1E', b: '#1B5FD6', w: '#FCFCFC', k: '#1A1A1A' };
  const GOOMBA_PAL = { g: '#B15E1E', d: '#5B3B14', w: '#FCFCFC', k: '#1A1A1A' };
  const MUSH_PAL = { r: '#DC2A08', w: '#FCFCFC', s: '#FAB878', k: '#1A1A1A' };

  const marioSmall = buildSprite([
    ".....rrrrr......",
    "....rrrrrrrrr...",
    "....rrrrrrrrrr..",
    "....rrrrrrrrrrr.",
    "....rrrrrrrrrrrr",
    "....hhsssssss...",
    "....hssssskss...",
    "....hshhhhhhs...",
    "....rrrrrrrrr...",
    "....rbrrrrrbr...",
    "....sbbbbbbbs...",
    "....bbbbbbbb....",
    "....bbwbbwbb....",
    "....bbbbbbbb....",
    ".....hhh.hhh....",
    "....hhhh.hhhh...",
  ], MARIO_PAL);

  const marioSmallJump = buildSprite([
    "......rrrr......",
    "....rrrrrrrr....",
    "....rrrrrrrrrr..",
    "....rrrrrrrrrrr.",
    "....rrrrrrrrrrrr",
    "....hhsssssss...",
    "....hssssskss...",
    "....hshhhhhhs...",
    ".s..rrrrrrrrr.s.",
    ".s..bbbbbbbbb.s.",
    "....bbbbbbbbb...",
    "....bbwbbwbb....",
    "....bbbbbbbbb...",
    ".....bbbbbbbb...",
    ".....hhhhhhhh...",
    "....hhhhhhhhhh..",
  ], MARIO_PAL);

  const marioBig = buildSprite([
    "......rrrr......",
    "....rrrrrrrr....",
    "....rrrrrrrrrr..",
    "....rrrrrrrrrrr.",
    "....rrrrrrrrrrrr",
    "....hhsssssss...",
    "....hssssskss...",
    "....hshhhhhhs...",
    "....rrrrrrrrr...",
    "....rbrrrrrbr...",
    "....sbbbbbbbs...",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbwbbwbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbwbbwbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    "....bbbbbbbb....",
    ".....bbbbbbbb...",
    ".....bbbbbbbb...",
    ".....hhhh.hh....",
    "....hhhh..hhhh..",
  ], MARIO_PAL);

  const goomba = buildSprite([
    ".....gggggg.....",
    "....gggggggg....",
    "...gggggggggg...",
    "..gggggggggggg..",
    "..gwwggggggwwg..",
    "..gkkggggggkkg..",
    "..gggggggggggg..",
    "..gggggggggggg..",
    "..gggggggggggg..",
    "..gggggggggggg..",
    "..gggggggggggg..",
    ".gggggggggggggg.",
    ".gggggggggggggg.",
    ".gggggggggggggg.",
    ".gggddddddddggg.",
    ".ggg.dddddd.ggg.",
  ], GOOMBA_PAL);

  const mushroom = buildSprite([
    ".....rrrrrr.....",
    "....rrrrrrrrr...",
    "...rrwrrrrwrr...",
    "..rrwrrrrrrwrr..",
    ".rrrrwrrrrwrrrr.",
    ".rrrrrrrrrrrrrr.",
    "rrrrrrrrrrrrrrrr",
    ".ssssssssssssss.",
    ".ssssssssssssss.",
    ".ssssksssskssss.",
    ".ssssssssssssss.",
    "..sssskkssssss..",
    "...ssssssssss...",
  ], MUSH_PAL);

export const Sprites = { marioSmall, marioSmallJump, marioBig, goomba, mushroom, buildSprite };

  // Dev validation (open DevTools console to inspect)
  (function () {
    const d = (o) => o.width + 'x' + o.height;
    const dims = { marioSmall: d(marioSmall), marioSmallJump: d(marioSmallJump), marioBig: d(marioBig), goomba: d(goomba), mushroom: d(mushroom) };
    console.log('[Sprites] ready', dims);
  })();
