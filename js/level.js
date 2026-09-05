// ============================================================
//  Level 1-1  -  defined as clean feature placements
//  Grid: 15 rows tall (0 = top, 14 = bottom), 176 tiles wide.
//  Ground occupies rows 13 & 14. Pits carve the ground.
//  Tile chars:
//    '.' empty   '#' ground   'X' hard   'B' brick
//    '?' coin block   'M' mushroom block   'U' used
//    'Q'/'W' pipe cap (left/right)
//    'E'/'R' pipe body (left/right)
//  Floating coins 'C' and enemies are returned as entities.
// ============================================================
const TILE = 16;
  const LEVEL_W = 176;
  const LEVEL_H = 15;

  function buildLevel() {
    const g = [];
    for (let y = 0; y < LEVEL_H; y++) { const row = []; for (let x = 0; x < LEVEL_W; x++) row.push('.'); g.push(row); }
    const set = (x, y, c) => { if (x >= 0 && x < LEVEL_W && y >= 0 && y < LEVEL_H) g[y][x] = c; };

    // --- ground ---
    for (let x = 0; x < LEVEL_W; x++) { set(x, 13, '#'); set(x, 14, '#'); }

    // --- pits (holes in the ground) ---
    const pit = (x, w) => { for (let i = 0; i < w; i++) { set(x + i, 13, '.'); set(x + i, 14, '.'); } };
    pit(68, 3); pit(99, 3); pit(140, 4);

    const B = (x, y, c) => set(x, y, c);
    const pipe = (x, h) => {
      const top = 13 - h;
      set(x, top, 'Q'); set(x + 1, top, 'W');
      for (let y = top + 1; y < 13; y++) { set(x, y, 'E'); set(x + 1, y, 'R'); }
    };
    const stairs = (x, maxH) => { for (let i = 0; i < maxH; i++) { for (let y = 13 - (i + 1); y < 13; y++) set(x + i, y, 'X'); } };

    // --- features (left -> right) ---
    B(16, 8, '?');                                   // first ? block
    B(20, 8, 'B'); B(21, 8, '?'); B(22, 8, 'B'); B(23, 8, '?'); B(24, 8, 'B'); // brick/coin cluster
    for (let x = 20; x <= 24; x++) B(x, 6, 'C');      // coin arc above it

    pipe(28, 2); pipe(40, 3); pipe(56, 4);            // three growing pipes

    B(44, 8, 'M');                                   // mushroom block
    B(48, 8, 'B'); B(49, 8, 'B'); B(50, 8, 'B'); B(49, 4, '?'); // bricks + high coin block

    for (let x = 62; x <= 64; x++) B(x, 8, 'C');      // jump coins before pit 1

    B(74, 8, '?');                                   // post-pit coin block
    B(78, 8, 'B'); B(79, 8, 'B'); B(80, 8, 'B'); B(81, 8, 'B');
    for (let x = 78; x <= 81; x++) B(x, 5, 'C');      // high coins

    pipe(84, 3);

    for (let x = 104; x <= 107; x++) B(x, 8, 'C');    // coin row after pit 2
    B(105, 4, '?');
    pipe(112, 2);

    B(118, 8, 'B'); B(119, 8, 'B');
    for (let x = 118; x <= 119; x++) B(x, 5, 'C');

    B(146, 8, '?');
    for (let x = 147; x <= 149; x++) B(x, 8, 'C');    // coins after pit 3

    stairs(150, 8);                                   // final staircase

    const flagCol = 162;

    // --- collect floating coins into entities, clear their grid cell ---
    const coins = [];
    for (let y = 0; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) {
      if (g[y][x] === 'C') { coins.push({ x: x * TILE + 2, y: y * TILE + 2, w: 12, h: 12 }); g[y][x] = '.'; }
    }

    // --- goomba spawns (on the ground) ---
    const cols = [22, 30, 38, 46, 63, 74, 76, 86, 96, 106, 116, 124, 126, 134, 146];
    const enemies = cols.map((c) => ({ col: c, row: 13 }));

    return { w: LEVEL_W, h: LEVEL_H, grid: g, coins, enemies, flagCol, flagTopRow: 5, flagBaseRow: 13 };
  }

export { buildLevel };
