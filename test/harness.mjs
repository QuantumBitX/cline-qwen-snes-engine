// ============================================================
//  Headless test harness for the SNES-upgrade engine.
//  Runs the REAL game module under Node with the browser stubs
//  and asserts behaviour — especially the two HANDOVER bug fixes.
//  Run:  node test/harness.mjs
// ============================================================
import { installBrowser } from './browser-stub.mjs';
import { ParticleSystem } from '../js/engine/particles.js';

let failures = 0, passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}

const b = installBrowser();

// release every movement/jump key so a deterministic test starts clean
function clearKeys() {
  for (const c of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyZ', 'KeyJ']) b.release(c);
}

const mod = await import('../js/game.js');
const G = mod.__internals;

// ---- timing sanity: one logic update per advance(1) ----
console.log('[timing]');
{
  const f0 = G.frame;
  b.advance(1);
  check('exactly one 60fps update per advance(1)', G.frame === f0 + 1, `frame ${f0} -> ${G.frame}`);
}

// ---- 1. boot ----
console.log('[boot]');
check('boots to title state', G.state === 'title', 'state=' + G.state);
check('level loaded (W/H set)', G.W > 0 && G.H > 0, `W=${G.W} H=${G.H}`);
check('grid is H rows, each W wide', Array.isArray(G.grid) && G.grid.length === G.H && G.grid[0].length === G.W);
check('player starts at x=32', G.player && Math.abs(G.player.x - 32) < 1, 'x=' + (G.player && G.player.x));

// ---- 2. start ----
console.log('[start]');
b.press('Enter'); b.advance(1);
check('Enter starts the game (state playing)', G.state === 'playing', 'state=' + G.state);

// ---- 3. movement (start area is flat; first pit is at tile col 68) ----
console.log('[movement]');
{
  clearKeys();
  const x0 = G.player.x;
  b.press('ArrowRight'); b.advance(20); const x1 = G.player.x;
  b.release('ArrowRight');
  check('holding -> moves the player right', x1 > x0 + 5, `x ${x0.toFixed(1)} -> ${x1.toFixed(1)}`);
  check('still playing after moving', G.state === 'playing', 'state=' + G.state);
}

// ---- 4. jump ----
console.log('[jump]');
{
  clearKeys(); b.advance(5);
  const y0 = G.player.y;
  b.press('Space'); b.advance(3);
  const yMid = G.player.y;
  check('jumping raises the player (y decreases)', yMid < y0, `y ${y0} -> ${yMid}`);
  b.release('Space'); b.advance(40);
  check('player lands back on the ground', G.player.onGround === true, 'onGround=' + G.player.onGround);
}

// ---- 5. STOMP (BUG #1 fix: reliable stomp) ----
console.log('[stomp  ·  bug #1]');
{
  G.startGame(); clearKeys(); b.advance(1);
  const e = G.enemies[0];
  const px = G.player;
  px.x = e.x + (e.w - px.w) / 2;   // aligned over the goomba
  px.y = e.y - px.h;               // feet exactly at the goomba's top
  px.vy = 3; px.vx = 0; px.onGround = false;   // falling into it
  const scoreBefore = G.score;
  b.advance(1);
  check('stomp kills the goomba', e.dead === true);
  check('stomp bounces the player upward (vy < 0)', px.vy < 0, 'vy=' + px.vy);
  check('stomp awards exactly 100 points', G.score === scoreBefore + 100, `score ${scoreBefore} -> ${G.score}`);
  check('player still alive after stomp', G.state === 'playing', 'state=' + G.state);
}

// ---- 6. side hit must NOT be a stomp (stomp/damage discrimination) ----
console.log('[damage · stomp discrimination]');
{
  G.startGame(); clearKeys(); b.advance(1);
  const e = G.enemies[0];
  const px = G.player;
  px.x = e.x;                      // overlapping horizontally
  px.y = e.y;                      // feet at e.y+14, well below the goomba's top
  px.vy = 0; px.vx = 0; px.onGround = false;
  b.advance(1);
  check('side hit is NOT treated as a stomp (goomba survives)', e.dead === false);
  check('side hit damages the small player (state -> dying)', G.state === 'dying', 'state=' + G.state);
}

// ---- 7. flag -> complete ----
console.log('[flag]');
{
  G.startGame(); clearKeys(); b.advance(1);
  const px = G.player;
  px.x = G.flagX + 4; px.y = 194; px.vy = 0; px.vx = 0;
  b.advance(1);
  check('reaching the flag pole -> complete', G.state === 'complete', 'state=' + G.state);
}

// ---- 8. CAMERA (BUG #2 fix: follow + bounded + never leaves player) ----
console.log('[camera  ·  bug #2]');
{
  const { createCamera } = await import('../js/engine/camera.js');
  const cam = createCamera();
  const p = { x: 32, w: 12, facing: 1 };
  const levelW = G.W * 16;
  cam.update(p, levelW);
  let prevCam = cam.x, maxJump = 0, visible = true;
  for (let i = 0; i < 120; i++) {
    p.x += 3;                      // run speed
    cam.update(p, levelW);
    maxJump = Math.max(maxJump, Math.abs(cam.x - prevCam));
    prevCam = cam.x;
    const onScreen = (p.x + p.w / 2) - cam.x;
    if (onScreen < 0 || onScreen > 256) visible = false;
  }
  check('camera follows the player (camX > 0)', cam.x > 0, 'camX=' + cam.x.toFixed(1));
  check('camera per-frame movement is bounded (smooth, no hard snap)', maxJump <= 5.5, 'maxJump=' + maxJump.toFixed(2));
  check('player is never left behind (always on screen)', visible);
}

// ---- 9. PHASE 1: level loader (JSON -> typed arrays) + tilemap query API ----
console.log('[phase 1 · loader + tilemap]');
{
  const { parseLevel } = await import('../js/engine/level.js');
  const { createTilemap } = await import('../js/engine/tilemap.js');

  const raw = {
    id: 'test', tileSize: 16, width: 8, height: 4,
    layers: { collision: ['........', '..?.....', '..#.....', '########'] },
    entities: [
      { type: 'coin', x: 34, y: 34 },
      { type: 'goomba', x: 64, y: 34, speed: 0.5 },
      { type: 'flag', x: 104, baseRow: 3, topRow: 1 },
    ],
  };

  // loader: typed arrays
  const L = parseLevel(raw);
  check('loader: w/h parsed', L.w === 8 && L.h === 4, `w=${L.w} h=${L.h}`);
  check('loader: collision is a Uint8Array of w*h bytes',
    L.layers.collision instanceof Uint8Array && L.layers.collision.length === 8 * 4,
    'len=' + (L.layers.collision && L.layers.collision.length));
  check('loader: collision bytes hold the tile chars',
    L.layers.collision[1 * 8 + 2] === '?'.charCodeAt(0) &&
    L.layers.collision[2 * 8 + 2] === '#'.charCodeAt(0) &&
    L.layers.collision[3 * 8 + 0] === '#'.charCodeAt(0));
  check('loader: optional layers are null when absent',
    L.layers.background === null && L.layers.foreground === null);

  // loader: entities resolved
  check('loader: coin resolved to {x,y,w:12,h:12}',
    L.coins.length === 1 && L.coins[0].x === 34 && L.coins[0].y === 34 && L.coins[0].w === 12 && L.coins[0].h === 12,
    JSON.stringify(L.coins));
  check('loader: goomba resolved to {x,y,w:14,h:14,vx:-speed}',
    L.enemies.length === 1 && L.enemies[0].x === 64 && L.enemies[0].y === 34 &&
    L.enemies[0].w === 14 && L.enemies[0].h === 14 && L.enemies[0].vx === -0.5,
    JSON.stringify(L.enemies));
  check('loader: flag resolved to {col,topRow,baseRow}',
    L.flag && L.flag.col === 6 && L.flag.topRow === 1 && L.flag.baseRow === 3,
    JSON.stringify(L.flag));

  // loader: schema check throws on malformed maps
  const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
  check('loader: rejects non-object', throws(() => parseLevel(null)));
  check('loader: rejects missing collision layer',
    throws(() => parseLevel({ width: 8, height: 4, layers: {} })));
  check('loader: rejects wrong row count',
    throws(() => parseLevel({ width: 8, height: 4, layers: { collision: ['........'] } })));
  check('loader: rejects over-wide row',
    throws(() => parseLevel({ width: 8, height: 4, layers: { collision: ['........', '........', '........', '.........'] } })));
  check('loader: rejects unknown entity type',
    throws(() => parseLevel({ width: 8, height: 4, layers: { collision: ['........', '........', '........', '........'] }, entities: [{ type: 'bogus' }] })));

  // tilemap: query API
  const tm = createTilemap(L);
  check('tilemap: width/height', tm.width === 8 && tm.height === 4);
  check('tilemap: tileAt reads the right char', tm.tileAt(2, 1) === '?' && tm.tileAt(2, 2) === '#' && tm.tileAt(0, 3) === '#');
  check('tilemap: solidAt true for tiles, false for empty', tm.solidAt(2, 2) === true && tm.solidAt(0, 0) === false);
  tm.set(2, 1, 'U');
  check('tilemap: set mutates the cell', tm.tileAt(2, 1) === 'U');
  const rows = tm.rows();
  check('tilemap: rows() is H arrays of W chars',
    Array.isArray(rows) && rows.length === 4 && rows[0].length === 8);
  check('tilemap: rows() reflects the mutation', rows[1][2] === 'U' && rows[2][2] === '#');
  check('tilemap: copies the source buffer (no aliasing)',
    L.layers.collision[1 * 8 + 2] === '?'.charCodeAt(0),
    'src=' + String.fromCharCode(L.layers.collision[1 * 8 + 2]));
}

// ---- 10. PHASE 2: decorative autotiling (Moore-neighbour mask) ----
console.log('[phase 2 · autotiling]');
{
  const { parseLevel } = await import('../js/engine/level.js');
  const { createTilemap, bakeAutotile, ATLAS } = await import('../js/engine/tilemap.js');

  // A 6x2 map that exercises every autotile feature:
  //   row0: ##.###   (a notch in the top of the ground)
  //   row1: ######   (solid base)
  const raw = {
    id: 'test', tileSize: 16, width: 6, height: 2,
    layers: { collision: ['##.###', '######'] },
    entities: [],
  };
  const tm = createTilemap(parseLevel(raw));
  const at = bakeAutotile(tm);   // bakes into tm.autotile and returns the array
  const cell = (x, y) => at[y * 6 + x];

  check('autotile: is an Int16Array of w*h entries',
    at instanceof Int16Array && at.length === 12, 'len=' + (at && at.length));
  check('autotile: interior dirt has no features (bitmask 0)',
    cell(1, 1) === ATLAS.dirt && cell(3, 1) === ATLAS.dirt && cell(4, 1) === ATLAS.dirt,
    `cells ${cell(1, 1)},${cell(3, 1)},${cell(4, 1)}`);
  check('autotile: flat grass cap where only N is empty',
    cell(4, 0) === ATLAS.cap && cell(2, 1) === ATLAS.cap,
    `cells ${cell(4, 0)},${cell(2, 1)} (expect ${ATLAS.cap})`);
  check('autotile: lit left edge where only W is empty',
    cell(0, 1) === ATLAS.edgeL, `cell ${cell(0, 1)} (expect ${ATLAS.edgeL})`);
  check('autotile: dark right edge where only E is empty',
    cell(5, 1) === ATLAS.edgeR, `cell ${cell(5, 1)} (expect ${ATLAS.edgeR})`);
  check('autotile: top-left corner = cap|edgeL|cornerTL',
    cell(0, 0) === (ATLAS.cap | ATLAS.edgeL | ATLAS.cornerTL) &&
    cell(3, 0) === (ATLAS.cap | ATLAS.edgeL | ATLAS.cornerTL),
    `cells ${cell(0, 0)},${cell(3, 0)} (expect ${ATLAS.cap | ATLAS.edgeL | ATLAS.cornerTL})`);
  check('autotile: top-right corner = cap|edgeR|cornerTR',
    cell(1, 0) === (ATLAS.cap | ATLAS.edgeR | ATLAS.cornerTR) &&
    cell(5, 0) === (ATLAS.cap | ATLAS.edgeR | ATLAS.cornerTR),
    `cells ${cell(1, 0)},${cell(5, 0)} (expect ${ATLAS.cap | ATLAS.edgeR | ATLAS.cornerTR})`);
  check('autotile: non-ground tiles are 0', cell(2, 0) === 0, `cell ${cell(2, 0)}`);
  check('autotile: does not mutate the collision layer',
    tm.tileAt(2, 0) === '.' && tm.tileAt(0, 1) === '#',
    `tileAt(2,0)=${tm.tileAt(2, 0)} tileAt(0,1)=${tm.tileAt(0, 1)}`);
}

// ---- 11. PHASE 3: slope + one-way physics ----
console.log('[phase 3 · slopes + one-way]');
{
  const { parseLevel } = await import('../js/engine/level.js');
  const { createTilemap } = await import('../js/engine/tilemap.js');

  // --- tilemap unit tests: slope() + isOneWay() + surfaceYAt() ---
  const raw = {
    id: 'slope-test', tileSize: 16, width: 8, height: 4,
    layers: { collision: ['........', '........', '.../\\-..', '########'] },
    entities: [],
  };
  const tm = createTilemap(parseLevel(raw));
  check('slope: / tile returns {hL:16,hR:0}',
    JSON.stringify(tm.slope(3, 2)) === JSON.stringify({ hL: 16, hR: 0 }),
    'got ' + JSON.stringify(tm.slope(3, 2)));
  check('slope: \\ tile returns {hL:0,hR:16}',
    JSON.stringify(tm.slope(4, 2)) === JSON.stringify({ hL: 0, hR: 16 }),
    'got ' + JSON.stringify(tm.slope(4, 2)));
  check('slope: flat # returns {hL:0,hR:0}',
    JSON.stringify(tm.slope(0, 3)) === JSON.stringify({ hL: 0, hR: 0 }));
  check('slope: empty returns null', tm.slope(0, 0) === null);
  check('slope: one-way returns null', tm.slope(5, 2) === null);
  check('isOneWay: - tile is true', tm.isOneWay(5, 2) === true);
  check('isOneWay: # tile is false', tm.isOneWay(0, 3) === false);
  check('surfaceYAt: flat ground at tile top',
    tm.surfaceYAt(8, 52) === 48, `got ${tm.surfaceYAt(8, 52)}`);
  check('surfaceYAt: / slope left edge = tile bottom',
    Math.abs(tm.surfaceYAt(48.01, 33) - 48) < 1, `got ${tm.surfaceYAt(48.01, 33)}`);
  check('surfaceYAt: / slope right edge = tile top',
    Math.abs(tm.surfaceYAt(63.99, 33) - 32) < 1, `got ${tm.surfaceYAt(63.99, 33)}`);
  check('surfaceYAt: / slope mid = interpolated',
    Math.abs(tm.surfaceYAt(56, 33) - 40) < 0.1, `got ${tm.surfaceYAt(56, 33)}`);
  check('surfaceYAt: empty returns null', tm.surfaceYAt(8, 8) === null);
  check('surfaceYAt: one-way returns null', tm.surfaceYAt(88, 33) === null);
}

// ---- 12. PHASE 3: integration (slope level physics) ----
console.log('[phase 3 · integration]');
{
  const { parseLevel } = await import('../js/engine/level.js');
  const slopeLevel = parseLevel({
    id: 'w1-1-slopes', tileSize: 16, width: 40, height: 15,
    layers: { collision: [
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '....................----................',
      '........................................',
      '...../....\\.............................',
      '########################################',
      '########################################',
    ]},
    entities: [{ type: 'flag', x: 616, baseRow: 13, topRow: 5 }],
  });
  G.loadTestLevel(slopeLevel);
  clearKeys();
  b.advance(1);
  const p = G.player;

  // Test: slope walking (player walks up the / slope at col 5)
  p.x = 64; p.y = 194; p.vx = 0; p.vy = 0; p.onGround = true;
  b.advance(1);
  const yBefore = p.y;
  b.press('ArrowRight'); b.advance(8); b.release('ArrowRight');
  check('slope: walking up / slope raises the player',
    p.y < yBefore, `y ${yBefore} -> ${p.y}`);
  check('slope: player on ground after walking up', p.onGround === true);

  // Test: slope slide (idle on the \ slope at col 10, slides right)
  clearKeys();
  p.x = 164; p.y = 183; p.vx = 0; p.vy = 0; p.onGround = true;
  b.advance(1);
  const vx0 = p.vx;
  b.advance(2);
  check('slope slide: idle on \\ slope gains rightward vx',
    p.vx > vx0 + 0.1, `vx ${vx0} -> ${p.vx}`);

  // Test: one-way platform landing
  clearKeys();
  p.x = 340; p.y = 100; p.vx = 0; p.vy = 0; p.onGround = false; p.dropTimer = 0;
  b.advance(30);
  check('one-way: player lands on - platform',
    p.onGround === true && p.onOneWay === true,
    `onGround=${p.onGround} onOneWay=${p.onOneWay} feet=${p.y + p.h}`);
  check('one-way: feet at platform top (Y=160)',
    Math.abs(p.y + p.h - 160) < 1, `feet=${p.y + p.h}`);

  // Test: one-way jump-through (jump from below passes through)
  clearKeys();
  p.x = 340; p.y = 194; p.vx = 0; p.vy = 0; p.onGround = true; p.dropTimer = 0;
  b.advance(1);
  b.press('Space'); b.advance(8);
  const feetMid = p.y + p.h;
  b.release('Space'); b.advance(60);
  check('one-way jump-through: rises above platform top',
    feetMid < 162, `feet mid-jump=${feetMid}`);
  check('one-way jump-through: lands back on the one-way platform',
    p.onGround === true && p.onOneWay === true, `y=${p.y} onOneWay=${p.onOneWay}`);

  // Test: drop-through (Down+Jump on one-way)
  clearKeys();
  p.x = 340; p.y = 146; p.vx = 0; p.vy = 0; p.onGround = true; p.onOneWay = true; p.dropTimer = 0;
  b.advance(1);
  b.press('ArrowDown'); b.press('Space'); b.advance(1);
  b.release('Space'); b.release('ArrowDown');
  b.advance(30);
  check('drop-through: player falls below platform',
    p.y + p.h > 160, `feet=${p.y + p.h}`);
  check('drop-through: lands on ground below',
    p.onGround === true, `onGround=${p.onGround} y=${p.y}`);

  // Restore w1-1
  G.startGame();
}

// ---- Phase 4: sprite sheet + animation controller ----
console.log('[phase 4 · spritesheet]');
{
  const { computeFrames, SpriteSheet } = await import('../js/engine/spritesheet.js');
  const frames = computeFrames(64, 32, 16, 16);
  check('computeFrames: 64x32 / 16x16 → 8 frames', frames.length === 8, 'got ' + frames.length);
  check('computeFrames: frame 0 at (0,0)', frames[0].sx === 0 && frames[0].sy === 0);
  check('computeFrames: frame 1 at (16,0)', frames[1].sx === 16 && frames[1].sy === 0);
  check('computeFrames: frame 3 at (48,0)', frames[3].sx === 48 && frames[3].sy === 0);
  check('computeFrames: frame 4 at (0,16)', frames[4].sx === 0 && frames[4].sy === 16);
  check('computeFrames: frame 7 at (48,16)', frames[7].sx === 48 && frames[7].sy === 16);
  const gFrames = computeFrames(32, 16, 16, 16);
  check('computeFrames: 32x16 / 16x16 → 2 frames', gFrames.length === 2);
  check('computeFrames: goomba frame 1 at (16,0)', gFrames[1].sx === 16 && gFrames[1].sy === 0);
  const nFrames = computeFrames(50, 30, 16, 16);
  check('computeFrames: 50x30 / 16x16 → 3 frames (floor)', nFrames.length === 3, 'got ' + nFrames.length);
  const sheet = new SpriteSheet('test.png', 16, 16);
  check('SpriteSheet: not loaded before init', sheet.loaded === false);
  sheet.init(64, 32);
  check('SpriteSheet: loaded after init', sheet.loaded === true);
  check('SpriteSheet: 8 frames after init(64,32)', sheet.frames.length === 8);
  check('SpriteSheet: cellW=16 cellH=16', sheet.cellW === 16 && sheet.cellH === 16);
  const gameCtx = b.canvas.getContext('2d');
  sheet.draw(gameCtx, 0, 10, 20);
  sheet.draw(gameCtx, 7, 10, 20);
  sheet.draw(gameCtx, 8, 10, 20);
  sheet.draw(gameCtx, 1, 10, 20, { flipX: true });
  check('SpriteSheet.draw: no throw (including wrap + flip)', true);
  check('game: playerSheet loaded', G.playerSheet.loaded === true);
  check('game: playerSheet has 8 frames', G.playerSheet.frames.length === 8);
  check('game: goombaSheet loaded', G.goombaSheet.loaded === true);
  check('game: goombaSheet has 2 frames', G.goombaSheet.frames.length === 2);
  check('game: mushroomSheet loaded', G.mushroomSheet.loaded === true);
  check('game: mushroomSheet has 1 frame', G.mushroomSheet.frames.length === 1);
}

console.log('[phase 4 · animation]');
{
  const { pickPlayerState, AnimController } = await import('../js/engine/animation.js');
  check('pickPlayerState: idle (onGround, vx=0)',
    pickPlayerState({ onGround: true, vx: 0, vy: 0 }, 0) === 'idle');
  check('pickPlayerState: idle (onGround, vx=0.1)',
    pickPlayerState({ onGround: true, vx: 0.1, vy: 0 }, 0) === 'idle');
  check('pickPlayerState: run (onGround, vx=1.5)',
    pickPlayerState({ onGround: true, vx: 1.5, vy: 0 }, 1) === 'run');
  check('pickPlayerState: run (onGround, vx=-1.5)',
    pickPlayerState({ onGround: true, vx: -1.5, vy: 0 }, -1) === 'run');
  check('pickPlayerState: run_fast (onGround, vx=3.0)',
    pickPlayerState({ onGround: true, vx: 3.0, vy: 0 }, 1) === 'run_fast');
  check('pickPlayerState: run_fast (onGround, vx=-2.5)',
    pickPlayerState({ onGround: true, vx: -2.5, vy: 0 }, -1) === 'run_fast');
  check('pickPlayerState: skid (moving right, input left)',
    pickPlayerState({ onGround: true, vx: 2.0, vy: 0 }, -1) === 'skid');
  check('pickPlayerState: skid (moving left, input right)',
    pickPlayerState({ onGround: true, vx: -2.0, vy: 0 }, 1) === 'skid');
  check('pickPlayerState: NOT skid (low speed, opposite input)',
    pickPlayerState({ onGround: true, vx: 1.0, vy: 0 }, -1) !== 'skid');
  check('pickPlayerState: jump (airborne, vy<0)',
    pickPlayerState({ onGround: false, vx: 0, vy: -5 }, 0) === 'jump');
  check('pickPlayerState: fall (airborne, vy>0)',
    pickPlayerState({ onGround: false, vx: 0, vy: 5 }, 0) === 'fall');

  const ac = new AnimController();
  ac.update({ onGround: true, vx: 0, vy: 0 }, 0);
  check('AnimController: starts in idle, frame 0', ac.state === 'idle' && ac.frame === 0);
  ac.update({ onGround: true, vx: 1.5, vy: 0 }, 1);
  check('AnimController: transitions to run', ac.state === 'run');
  check('AnimController: run frame is 1 or 2', ac.frame === 1 || ac.frame === 2);
  const runFrame0 = ac.frame;
  for (let i = 0; i < 8; i++) ac.update({ onGround: true, vx: 1.5, vy: 0 }, 1);
  check('AnimController: run frame advances after interval', ac.frame !== runFrame0);
  ac.update({ onGround: true, vx: 3.0, vy: 0 }, 1);
  check('AnimController: transitions to run_fast', ac.state === 'run_fast');
  const fastFrame0 = ac.frame;
  for (let i = 0; i < 4; i++) ac.update({ onGround: true, vx: 3.0, vy: 0 }, 1);
  check('AnimController: run_fast advances in 4 ticks', ac.frame !== fastFrame0);
  ac.update({ onGround: true, vx: 2.0, vy: 0 }, -1);
  check('AnimController: skid state, frame 3', ac.state === 'skid' && ac.frame === 3);
  ac.update({ onGround: false, vx: 1, vy: -5 }, 1);
  check('AnimController: jump state, frame 4', ac.state === 'jump' && ac.frame === 4);
  ac.update({ onGround: false, vx: 1, vy: 5 }, 1);
  check('AnimController: fall state, frame 5', ac.state === 'fall' && ac.frame === 5);
  ac.update({ onGround: true, vx: 0, vy: 0 }, 0);
  check('AnimController: land after fall, frame 6', ac.state === 'land' && ac.frame === 6);
  for (let i = 0; i < 6; i++) ac.update({ onGround: true, vx: 0, vy: 0 }, 0);
  check('AnimController: back to idle after land timer', ac.state === 'idle');
  ac.reset();
  check('AnimController: reset → idle, frame 0', ac.state === 'idle' && ac.frame === 0);
  G.startGame(); clearKeys(); b.advance(1);
  check('game: playerAnim exists and has state', typeof G.playerAnim.state === 'string');
  check('game: playerAnim.frame is a number 0-7',
    G.playerAnim.frame >= 0 && G.playerAnim.frame < 8, 'frame=' + G.playerAnim.frame);
}

// ============================================================
// Phase 5: parallax scrolling
// ============================================================
console.log('[phase 5 · parallax offset math]');
{
  const { layerOffset } = await import('../js/engine/parallax.js');
  check('layerOffset(0, f, w) === 0', layerOffset(0, 0.5, 100) === 0);
  check('layerOffset: factor 0 is static', layerOffset(999, 0, 100) === 0);
  check('layerOffset(100, 0.5, 100) === -50', layerOffset(100, 0.5, 100) === -50, 'got ' + layerOffset(100, 0.5, 100));
  check('layerOffset(50, 0.5, 100) === -25', layerOffset(50, 0.5, 100) === -25, 'got ' + layerOffset(50, 0.5, 100));
  check('layerOffset: full wrap -> 0', layerOffset(200, 0.5, 100) === 0, 'got ' + layerOffset(200, 0.5, 100));
  check('layerOffset: invalid width -> 0', layerOffset(10, 0.5, 0) === 0);
  // range: always in [-w, 0] across a sweep of camX and every real factor
  let inRange = true;
  for (const f of [0, 0.15, 0.3, 0.4, 0.7, 1]) {
    for (let camX = 0; camX <= 2000; camX += 3) {
      const ox = layerOffset(camX, f, 137);
      if (ox < -137 - 1e-9 || ox > 1e-9) { inRange = false; break; }
    }
    if (!inRange) break;
  }
  check('layerOffset always in [-w, 0] (sweep)', inRange);
  // periodicity: offset repeats every (w / f) of camX
  const w = 137, f = 0.25, period = w / f;
  let periodic = true;
  for (const camX of [0, 13, 77, 201, 431, 999]) {
    if (Math.abs(layerOffset(camX + period, f, w) - layerOffset(camX, f, w)) > 1e-9) { periodic = false; break; }
  }
  check('layerOffset is periodic (period = w/f)', periodic);
  // monotonic drift within one period: larger camX -> more negative
  const o1 = layerOffset(10, 0.5, 100), o2 = layerOffset(20, 0.5, 100);
  check('layerOffset: larger camX -> more negative (within period)', o2 < o1, `o1=${o1} o2=${o2}`);
  // large camX stays in range; exact multiple wraps to 0 (seamless)
  const big = layerOffset(10000, 0.7, 256);
  check('layerOffset: large camX stays in range', big >= -256 && big <= 0, 'got ' + big);
  check('layerOffset: camX*f = w -> 0 (seamless wrap)', layerOffset(512, 0.5, 256) === 0, 'got ' + layerOffset(512, 0.5, 256));
}

console.log('[phase 5 · parallax tiling + game wiring]');
{
  const { layerOffset } = await import('../js/engine/parallax.js');
  check('game: parallax exists with draw()', G.parallax && typeof G.parallax.draw === 'function');
  check('game: parallax has 5 layers', G.parallax && G.parallax.layers.length === 5, 'got ' + (G.parallax && G.parallax.layers.length));
  const factors = G.parallax.layers.map(L => L.factor);
  check('game: layer factors [0, 0.15, 0.3, 0.4, 0.7]',
    JSON.stringify(factors) === JSON.stringify([0, 0.15, 0.3, 0.4, 0.7]), JSON.stringify(factors));
  check('game: factors monotonic back->front', G.parallax.layers.every((L, i, a) => i === 0 || a[i - 1].factor <= L.factor));
  check('game: every layer has canvas + positive size', G.parallax.layers.every(L => L.canvas && L.width > 0 && L.height > 0));
  // tiling coverage: count drawImage calls for a fixed camX (must cover the view)
  const camX = 123;
  const countingCtx = { calls: 0, drawImage() { this.calls++; } };
  let expected = 0;
  for (const L of G.parallax.layers) {
    const ox = layerOffset(camX, L.factor, L.width);
    expected += Math.ceil((256 - ox) / L.width);
  }
  G.parallax.draw(countingCtx, camX, 256);
  check('parallax.draw tiles all layers to cover the view', countingCtx.calls === expected,
    `got ${countingCtx.calls} expected ${expected}`);
  // at camX=0 every layer draws at least once
  const countingCtx2 = { calls: 0, drawImage() { this.calls++; } };
  G.parallax.draw(countingCtx2, 0, 256);
  check('parallax.draw at camX=0 draws >= 1 tile per layer', countingCtx2.calls >= G.parallax.layers.length,
    'got ' + countingCtx2.calls);
}

// ============================================================
//  PHASE 6 — pooled particle system (VFX / "Game Juice")
// ============================================================
console.log('[phase6: particle pool]');
{
  const ps = new ParticleSystem(8);
  check('pool: capacity reflects constructor arg', ps.capacity === 8, 'cap=' + ps.capacity);
  check('pool: starts empty', ps.alive === 0, 'alive=' + ps.alive);

  for (let i = 0; i < 8; i++) ps.emit(0, 0, { kind: 'dot', life: 5 });
  check('pool: fills to capacity', ps.alive === 8, 'alive=' + ps.alive);

  const dropped = ps.emit(0, 0, { kind: 'dot', life: 5 });
  check('pool: overflow spawn is dropped (returns null)', dropped === null);
  check('pool: never grows beyond capacity', ps.alive === 8, 'alive=' + ps.alive);

  // a life-1 particle retires after a single update
  const ps0 = new ParticleSystem(4);
  ps0.emit(0, 0, { kind: 'dot', life: 1 });
  check('pool: one alive after emit', ps0.alive === 1, 'alive=' + ps0.alive);
  ps0.update();
  check('pool: update retires a slot whose life hit 0', ps0.alive === 0, 'alive=' + ps0.alive);

  // alpha = life/max fade math on a surviving particle
  const ps2 = new ParticleSystem(4);
  ps2.emit(0, 0, { kind: 'dot', life: 10 });
  const slot = ps2.pool[0];
  check('fade: fresh particle life == max', slot.life === 10 && slot.max === 10, `life=${slot.life} max=${slot.max}`);
  ps2.update();
  check('fade: life decrements each update', slot.life === 9, 'life=' + slot.life);
  check('fade: alpha == life/max', Math.abs(slot.life / slot.max - 0.9) < 1e-9, 'alpha=' + (slot.life / slot.max));
}

// ---- block-bounce sine math preserved (generalized from old bounceOff) ----
console.log('[phase6: block bounce math]');
{
  const ps = new ParticleSystem(4);
  ps.emit(0, 0, { kind: 'bounce', tx: 3, ty: 4, life: 11 });
  check('bounce: offset 0 at age 0', ps.bounceOffset(3, 4) === 0, 'off=' + ps.bounceOffset(3, 4));
  let sineOk = true, detail = '';
  for (let a = 1; a <= 10; a++) {
    ps.update();
    const got = ps.bounceOffset(3, 4);
    const expect = -Math.round(6 * Math.sin(Math.PI * a / 10));
    if (got !== expect) { sineOk = false; detail = `age ${a}: got ${got} expect ${expect}`; break; }
  }
  check('bounce: ages 1..10 match old sine math', sineOk, detail || 'all match');
  ps.update(); // age 11 -> expired
  check('bounce: offset 0 after expiry', ps.bounceOffset(3, 4) === 0, 'off=' + ps.bounceOffset(3, 4));
  check('bounce: unrelated tile -> 0', ps.bounceOffset(9, 9) === 0, 'off=' + ps.bounceOffset(9, 9));
}

// ---- emit/update/draw no-throw across every kind (stub 2D ctx) ----
console.log('[phase6: draw no-throw]');
{
  const ps = new ParticleSystem(16);
  const ctx2d = b.canvas.getContext('2d');
  const kinds = ['coin', 'shard', 'text', 'dot', 'dust', 'poof', 'bounce'];
  let threw = null;
  try {
    for (const k of kinds) ps.emit(10, 10, { kind: k, text: k === 'text' ? '+200' : undefined, tx: 1, ty: 1, life: 5 });
    ps.update();
    ps.draw(ctx2d, 0);
  } catch (e) { threw = e; }
  check('draw: no-throw across all particle kinds', threw === null, threw ? String(threw) : 'ok');
}

// ---- integration: game wiring (the real game drives the pool) ----
console.log('[phase6: game wiring]');
{
  check('wiring: __internals.particles exposed', G.particles && typeof G.particles.emit === 'function', 'type=' + typeof G.particles);
  check('wiring: game pool capacity is 128', G.particles && G.particles.capacity === 128, 'cap=' + (G.particles && G.particles.capacity));
  check('wiring: bounceOffset exposed on the game pool', G.particles && typeof G.particles.bounceOffset === 'function');

  // Force a landing: drop the player from a height; landing must emit dust.
  clearKeys();
  G.startGame();
  G.player.x = 32;
  G.player.y = 40;
  G.player.vy = 0;
  G.particles.clear();
  let sawParticles = false;
  for (let i = 0; i < 60; i++) { b.advance(1); if (G.particles.alive > 0) { sawParticles = true; break; } }
  check('wiring: landing emits dust particles into the pool', sawParticles, 'alive stayed 0 for 60 frames');

  // The pool must clean itself up in-game (lifecycle works through update()).
  let drained = false;
  for (let i = 0; i < 90; i++) { b.advance(1); if (G.particles.alive === 0) { drained = true; break; } }
  check('wiring: particles expire and the pool drains', drained, 'alive=' + G.particles.alive);
}

// ---- Phase 7a: high-score persistence (localStorage round-trip) ----
console.log('[phase7a: high score]');
{
  // The stub's localStorage starts empty, so the boot high score is 0 (a real
  // browser would load a prior run's value here via loadHighScore()).
  G.startGame(); clearKeys();
  // Teleport the player to the flag and let the level clear — winning is what
  // persists the best score to localStorage (saveHighScore on 'win').
  G.player.x = G.flagX + 5; G.player.y = 194; G.player.vx = 0; G.player.vy = 0;
  let won = false;
  for (let i = 0; i < 400; i++) { b.advance(1); if (G.state === 'win') { won = true; break; } }
  check('7a: reaching the flag clears the level (state win)', won, 'state=' + G.state);
  check('7a: the clear awarded score', G.score > 0, 'score=' + G.score);
  check('7a: high score tracks the best (>= final score)', G.highScore >= G.score, `hi=${G.highScore} score=${G.score}`);
  const stored = localStorage.getItem('spb_highscore');
  check('7a: beaten high score round-trips to localStorage', stored !== null && parseInt(stored, 10) === G.highScore, `stored=${stored} hi=${G.highScore}`);
  check('7a: persisted value is a clean integer string', typeof stored === 'string' && /^\d+$/.test(stored), 'stored=' + stored);
}

// ---- Phase 7b: fire flower + fireballs ----
console.log('[phase7b: fire flower + fireballs]');
{
  // wiring: the fire-flower sheet is loaded in headless mode
  check('7b: fireflower sheet is wired + loaded', G.fireflowerSheet && G.fireflowerSheet.loaded === true, 'loaded=' + (G.fireflowerSheet && G.fireflowerSheet.loaded));

  // 1. fire key spawns a fireball (only in fire power)
  G.startGame(); clearKeys();
  b.advance(1);
  let px = G.player;
  px.power = 'fire'; px.h = 28; px.x = 32; px.y = 180; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  b.press('KeyZ'); b.advance(1); b.release('KeyZ');
  check('7b: fire key spawns a fireball', G.fireballs.length === 1, 'n=' + G.fireballs.length);
  check('7b: fireball launches in the facing direction (vx > 0)', G.fireballs.length === 1 && G.fireballs[0].vx > 0, 'vx=' + (G.fireballs[0] && G.fireballs[0].vx));

  // 2. fire key does nothing when not in fire power
  G.startGame(); clearKeys(); b.advance(1);
  px = G.player;
  px.power = 'small'; px.x = 32; px.y = 194; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  b.press('KeyZ'); b.advance(1); b.release('KeyZ');
  check('7b: fire key is ignored in small power', G.fireballs.length === 0, 'n=' + G.fireballs.length);

  // 3. the fireball travels forward
  G.startGame(); clearKeys();
  b.advance(1);
  px = G.player;
  px.power = 'fire'; px.h = 28; px.x = 32; px.y = 180; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  b.press('KeyZ'); b.advance(1); b.release('KeyZ');
  const fx0 = G.fireballs[0].x;
  for (let k=0;k<8;k++) b.advance(1);
  check('7b: fireball moves forward (x increases)', G.fireballs.length === 1 && G.fireballs[0].x > fx0, `x ${fx0.toFixed(1)} -> ${(G.fireballs[0] && G.fireballs[0].x).toFixed(1)}`);

  // 4. the fireball bounces off the ground
  let bounced = false;
  for (let i = 0; i < 80 && G.fireballs.length; i++) { b.advance(1); if (G.fireballs[0] && G.fireballs[0].bounces > 0) { bounced = true; break; } }
  check('7b: fireball bounces off the ground', bounced, 'bounces=' + (G.fireballs[0] && G.fireballs[0].bounces));

  // 5. a fireball that hits a live enemy kills it and pops
  G.startGame(); clearKeys(); b.advance(1);
  px = G.player;
  px.power = 'fire'; px.h = 28; px.x = 32; px.y = 180; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  const e = G.enemies[0];
  e.x = 52; e.y = 194; e.vy = 0; e.vx = 0; e.active = true; e.dead = false;
  const scoreBeforeKill = G.score;
  b.press('KeyZ'); b.advance(1); b.release('KeyZ');
  let killed = false;
  for (let i = 0; i < 60; i++) { if (e.dead) { killed = true; break; } if (!G.fireballs.length) break; b.advance(1); }
  check('7b: fireball kills an enemy on contact', killed, 'e.dead=' + e.dead);
  check('7b: fireball kill awards 100 points', G.score === scoreBeforeKill + 100, `score ${scoreBeforeKill} -> ${G.score}`);
  check('7b: fireball pops (removed) after the kill', G.fireballs.length === 0, 'n=' + G.fireballs.length);

  // 6. collecting a fire flower sets power = 'fire' (from small it also grows)
  G.startGame(); clearKeys(); b.advance(1);
  px = G.player;
  px.power = 'small'; px.h = 14; px.x = 32; px.y = 194; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  G.fireflowers.push({ x: 34, y: 194, w: 14, h: 14, emerging: false, restY: 194, onGround: true });
  b.advance(1);
  check('7b: collecting a fire flower sets power to fire', px.power === 'fire', 'power=' + px.power);
  check('7b: small -> fire also grows the player (h = 28)', px.h === 28, 'h=' + px.h);
  check('7b: the fire flower is consumed', G.fireflowers.length === 0, 'n=' + G.fireflowers.length);

  // 7. taking damage degrades fire -> big (not straight to small)
  G.startGame(); clearKeys(); b.advance(1);
  px = G.player;
  const e7 = G.enemies[0];
  px.power = 'fire'; px.h = 28; px.x = 32; px.y = 180; px.vx = 0; px.vy = 0; px.onGround = true; px.invuln = 0;
  e7.x = px.x; e7.y = px.y; e7.vx = 0; e7.vy = 0; e7.active = true; e7.dead = false;
  b.advance(1);
  check('7b: side damage degrades fire -> big', px.power === 'big', 'power=' + px.power);
  check('7b: player survives a fire->big degradation (still playing)', G.state === 'playing', 'state=' + G.state);
  check('7b: fire->big keeps the big height (h = 28)', px.h === 28, 'h=' + px.h);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

