// ============================================================
//  Headless test harness for the SNES-upgrade engine.
//  Runs the REAL game module under Node with the browser stubs
//  and asserts behaviour — especially the two HANDOVER bug fixes.
//  Run:  node test/harness.mjs
// ============================================================
import { installBrowser } from './browser-stub.mjs';

let failures = 0, passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; console.log('  PASS ' + name); }
  else { failures++; console.log('  FAIL ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}

const b = installBrowser();

// release every movement/jump key so a deterministic test starts clean
function clearKeys() {
  for (const c of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'ShiftLeft', 'ShiftRight', 'KeyX']) b.release(c);
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

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
