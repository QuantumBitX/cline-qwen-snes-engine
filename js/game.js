//=====================================================
//  SUPER PLUMBER BROS.  -  NES-era platformer (canvas + keyboard)
// ============================================================
import {
  VIEW_W, VIEW_H, TILE,
  GRAV_UP_HELD, GRAV_UP_RELEAS, GRAV_DOWN, JUMP_VEL, TERM_VY,
  MAX_WALK, MAX_RUN, ACCEL_WALK, ACCEL_RUN, FRIC_GROUND,
  STOMP, STOMP_HOLD, STOMP_TOL,
  PLAYER_W as PW, SMALL_H, BIG_H, INVULN, START_TIME, TIME_TICK,
  MAX_STEP_UP, SLOPE_ACCEL, DROP_TIMER,
} from './engine/constants.js';
import { createInput } from './engine/input.js';
import { runLoop } from './engine/loop.js';
import { createCamera } from './engine/camera.js';
import { Sprites } from './sprites.js';
import { loadLevelData, setLevelTransport } from './engine/level.js';
import { createTilemap, bakeAutotile, ATLAS } from './engine/tilemap.js';
import { Chiptune } from './chiptune.js';
import { SpriteSheet } from './engine/spritesheet.js';
import { AnimController } from './engine/animation.js';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // (all tunables are imported from engine/constants.js)

  // --- SFX (WebAudio bleeps) ---
  const SFX = (function () {
    let ac = null;
    function ensure() { if (!ac) { try { ac = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); }
    function tone(f, d, type, vol, slide) {
      if (!ac) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
    }
    function seq(n, step, d, type, vol) { n.forEach((f, i) => setTimeout(() => tone(f, d, type, vol), i * step)); }
    return {
      ensure: ensure,
      jump() { ensure(); tone(300, 0.18, 'square', 0.12, 660); },
      coin() { ensure(); tone(988, 0.07, 'square', 0.11); setTimeout(() => tone(1319, 0.18, 'square', 0.11), 70); },
      stomp() { ensure(); tone(220, 0.14, 'square', 0.16, 80); },
      bump() { ensure(); tone(140, 0.09, 'square', 0.12, 90); },
      brk() { ensure(); tone(180, 0.12, 'square', 0.14, 60); },
      pow() { ensure(); seq([420, 520, 620, 760, 880, 1040, 1180, 1320], 45, 0.09, 'square', 0.10); },
      shrink() { ensure(); tone(500, 0.25, 'square', 0.12, 140); },
      die() { ensure(); seq([660, 520, 392, 262, 196, 147], 90, 0.14, 'square', 0.12); },
      flag() { ensure(); seq([392, 494, 587, 784, 988, 1175, 1319, 1568, 1760, 2093], 70, 0.11, 'square', 0.10); },
    };
  })();

  // --- Music (chiptune background track) ---
  const Music = (function () {
    const TRACK = 'C'; // Cloud Drift (92 BPM, C major)
    const VOL = 0.35;
    let muted = false;
    function ensure() { if (Chiptune) { Chiptune.setVolume(muted ? 0.001 : VOL); Chiptune.ensure(); } }
    function start() { if (!muted && Chiptune) { Chiptune.setVolume(VOL); Chiptune.start(TRACK); } }
    function stop() { if (Chiptune) Chiptune.stop(); }
    function toggleMute() {
      muted = !muted;
      if (Chiptune) {
        if (muted) { Chiptune.setVolume(0.001); Chiptune.stop(); }
        else { Chiptune.setVolume(VOL); Chiptune.start(TRACK); }
      }
      return muted;
    }
    function isMuted() { return muted; }
    return { ensure, start, stop, toggleMute, isMuted };
  })();

  // --- state ---
  let tilemap, W, H, coins, enemies, mushrooms, coinPops, shards, bounces;
  let player, camX, score, coinsTotal, lives, timeLeft, timeFrame, frame = 0;
  let state, deathTimer, completeTimer, flagX, flagBaseY, flagSlideDone = false;
  let paused = false, jumpHeld = false, jumpPressed = false;

  // --- Phase 4: sprite sheets + animation controller ---
  const playerSheet = new SpriteSheet('assets/sprites/player.png', 16, 16);
  const goombaSheet = new SpriteSheet('assets/sprites/goomba.png', 16, 16);
  const mushroomSheet = new SpriteSheet('assets/sprites/mushroom.png', 16, 16);
  const playerAnim = new AnimController();

  // --- input + camera (engine/) ---
  const input = createInput(window);
  const camera = createCamera();
  input.onKey((e) => {
    if (e.code === 'Enter') { SFX.ensure(); Music.ensure(); if (state === 'title' || state === 'gameover' || state === 'win') startGame(); }
    if (e.code === 'KeyP') { if (state === 'playing') { paused = !paused; if (paused) Music.stop(); else Music.start(); } }
    if (e.code === 'KeyM') { Music.toggleMute(); if (paused) Music.stop(); }
  });
  // --- level load / reset ---
  function loadLevel(fullReset) {
    tilemap = createTilemap(levelData);
    bakeAutotile(tilemap);   // Phase 2: bake the ground autotile mask (render-only, re-baked each life)
    W = levelData.w; H = levelData.h; coins = levelData.coins.map((c) => ({ ...c }));
    flagX = levelData.flag.col * TILE + 8; flagBaseY = levelData.flag.baseRow * TILE;
    enemies = levelData.enemies.map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h, vx: e.vx, vy: 0, active: false, dead: false, squish: 0, onGround: false }));
    mushrooms = []; coinPops = []; shards = []; bounces = [];
    if (fullReset) { score = 0; coinsTotal = 0; lives = 3; }
    resetPlayer(); camera.reset(0); camX = 0; timeLeft = START_TIME; timeFrame = 0;
  }
  function resetPlayer() {
    player = { x: levelData.spawn.x, y: levelData.spawn.y, w: PW, h: SMALL_H, vx: 0, vy: 0, onGround: false, onOneWay: false, dropTimer: 0, big: false, facing: 1, invuln: 0, anim: 0, bumped: false, bumpTx: 0, bumpTy: 0 };
  }
  function startGame() { loadLevel(true); state = 'playing'; Music.start(); }

  // --- tile / geometry helpers ---
  function tileAt(tx, ty) { if (ty < 0 || ty >= H) return '.'; if (tx < 0 || tx >= W) return '#'; return tilemap.tileAt(tx, ty); }
  function solidAt(tx, ty) { const c = tileAt(tx, ty); return c !== '.'; }
  function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // --- axis-separated tile collision (Phase 3: height-field + one-way) ---
  function move(ent, recordBump) {
    const MARGIN = 1;

    // === X axis: wall / step-up ===
    ent.x += ent.vx;
    if (ent.vx > 0) {
      const tx = Math.floor((ent.x + ent.w) / TILE);
      const top = Math.floor((ent.y + 1) / TILE), bot = Math.floor((ent.y + ent.h - 1) / TILE);
      let blocked = false, stepUpY = null;
      for (let ty = top; ty <= bot; ty++) {
        const c = tileAt(tx, ty);
        if (c === '.' || c === '-') continue;
        const sh = tilemap.slope(tx, ty);
        if (!sh) continue;
        const fx = (ent.x + ent.w - tx * TILE) / TILE;
        const surfY = ty * TILE + sh.hL + (sh.hR - sh.hL) * fx;
        if (surfY <= ent.y || surfY >= ent.y + ent.h) continue;
        const climb = (ent.y + ent.h) - surfY;
        if (climb > MAX_STEP_UP) { blocked = true; break; }
        else if (climb > 0 && (stepUpY === null || surfY < stepUpY)) stepUpY = surfY;
      }
      if (blocked) { ent.x = tx * TILE - ent.w; ent.vx = 0; }
      else if (stepUpY !== null) ent.y = stepUpY - ent.h;
    } else if (ent.vx < 0) {
      const tx = Math.floor(ent.x / TILE);
      const top = Math.floor((ent.y + 1) / TILE), bot = Math.floor((ent.y + ent.h - 1) / TILE);
      let blocked = false, stepUpY = null;
      for (let ty = top; ty <= bot; ty++) {
        const c = tileAt(tx, ty);
        if (c === '.' || c === '-') continue;
        const sh = tilemap.slope(tx, ty);
        if (!sh) continue;
        const fx = (ent.x - tx * TILE) / TILE;
        const surfY = ty * TILE + sh.hL + (sh.hR - sh.hL) * fx;
        if (surfY <= ent.y || surfY >= ent.y + ent.h) continue;
        const climb = (ent.y + ent.h) - surfY;
        if (climb > MAX_STEP_UP) { blocked = true; break; }
        else if (climb > 0 && (stepUpY === null || surfY < stepUpY)) stepUpY = surfY;
      }
      if (blocked) { ent.x = (tx + 1) * TILE; ent.vx = 0; }
      else if (stepUpY !== null) ent.y = stepUpY - ent.h;
    }

    // === Y axis: ground / slope / one-way ===
    const prevBottom = ent.y + ent.h; // feet after X resolution
    ent.y += ent.vy;
    ent.onGround = false;
    ent.onOneWay = false;

    if (ent.vy >= 0) {
      const xL = ent.x + MARGIN, xR = ent.x + ent.w - MARGIN;
      const bottomY = ent.y + ent.h;
      let bestSurface = null;

      // Solid surfaces (flat + slopes)
      for (const px of [xL, xR]) {
        const gy = tilemap.surfaceYAt(px, bottomY);
        if (gy !== null && gy >= prevBottom - 0.01 && gy <= bottomY + MAX_STEP_UP) {
          if (bestSurface === null || gy < bestSurface) bestSurface = gy;
        }
      }

      // One-way platforms (only when falling, feet were above, not dropping)
      if (ent.dropTimer <= 0) {
        const l = Math.floor(xL / TILE), r = Math.floor(xR / TILE);
        const ty = Math.floor(bottomY / TILE);
        for (let tx = l; tx <= r; tx++) {
          if (tilemap.isOneWay(tx, ty) && prevBottom <= ty * TILE + 0.01) {
            const platTop = ty * TILE;
            if (bestSurface === null || platTop < bestSurface) { bestSurface = platTop; ent.onOneWay = true; }
          }
        }
      }

      if (bestSurface !== null) { ent.y = bestSurface - ent.h; ent.vy = 0; ent.onGround = true; }
    } else {
      // Rising: ceiling / bump check
      const l = Math.floor((ent.x + 1) / TILE), r = Math.floor((ent.x + ent.w - 1) / TILE);
      const ty = Math.floor(ent.y / TILE);
      let best = -1, bo = 0;
      for (let tx = l; tx <= r; tx++) {
        const c = tileAt(tx, ty);
        if (c === '.' || c === '-') continue;
        const sh = tilemap.slope(tx, ty);
        if (!sh) continue;
        const ov = Math.min(ent.x + ent.w, (tx + 1) * TILE) - Math.max(ent.x, tx * TILE);
        if (ov > bo) { bo = ov; best = tx; }
      }
      if (best >= 0) { ent.y = (ty + 1) * TILE; ent.vy = 0; if (recordBump) { ent.bumped = true; ent.bumpTx = best; ent.bumpTy = ty; } }
    }

    if (ent.dropTimer > 0) ent.dropTimer--;
  }
  // --- scoring / spawning ---
  function addScore(n) { score += n; if (score < 0) score = 0; if (score > 999999) score = 999999; }
  function addCoin(n) { coinsTotal += n; if (coinsTotal % 100 === 0 && coinsTotal > 0) { lives++; SFX.pow(); } }
  function spawnCoinPop(tx, ty) { coinPops.push({ cx: tx * TILE + 8, cy: ty * TILE - 6, vy: -6, life: 22 }); }
  function spawnMush(tx, ty) { mushrooms.push({ x: tx * TILE + 1, y: ty * TILE - 2, w: 14, h: 14, vx: 1.0, vy: 0, emerging: true, restY: ty * TILE - 15, onGround: false }); }
  function spawnShards(tx, ty) { const cx = tx * TILE + 8, cy = ty * TILE + 8; for (let i = 0; i < 4; i++) shards.push({ x: cx - 2, y: cy - 2, vx: (i < 2 ? -1.4 : 1.4), vy: (i % 2 ? -3.2 : -1.6), life: 30 }); }

  // --- block bump (hit from below) ---
  function handleBump(tx, ty) {
    const c = tileAt(tx, ty);
    if (c === '?') { tilemap.set(tx, ty, 'U'); addScore(200); addCoin(1); spawnCoinPop(tx, ty); SFX.coin(); }
    else if (c === 'M') { tilemap.set(tx, ty, 'U'); spawnMush(tx, ty); SFX.pow(); }
    else if (c === 'B') { if (player.big) { tilemap.set(tx, ty, '.'); addScore(50); spawnShards(tx, ty); SFX.brk(); } else { bounces.push({ tx, ty, age: 0 }); SFX.bump(); } }
    else SFX.bump();
  }

  // --- player ---
  function updatePlayer() {
    const p = player;
    const left = input.held.ArrowLeft || input.held.KeyA, right = input.held.ArrowRight || input.held.KeyD;
    const run = input.held.ShiftLeft || input.held.ShiftRight || input.held.KeyX;
    const downHeld = input.held.ArrowDown || input.held.KeyS;
    const maxS = run ? MAX_RUN : MAX_WALK, acc = run ? ACCEL_RUN : ACCEL_WALK;
    const idle = !left && !right;
    if (left && !right) { p.vx -= acc; p.facing = -1; }
    else if (right && !left) { p.vx += acc; p.facing = 1; }

    // Phase 3: slope slide — nudge downhill when idle on a slope
    let slopeSlide = 0;
    if (p.onGround && idle) {
      const feetY = p.y + p.h;
      const gyL = tilemap.surfaceYAt(p.x + 1, feetY);
      const gyR = tilemap.surfaceYAt(p.x + p.w - 1, feetY);
      if (gyL !== null && gyR !== null && gyL !== gyR) {
        slopeSlide = (gyL > gyR) ? -SLOPE_ACCEL : SLOPE_ACCEL;
      }
    }
    if (idle) {
      if (slopeSlide !== 0) { p.vx += slopeSlide; }
      else { if (p.vx > 0) p.vx = Math.max(0, p.vx - FRIC_GROUND); else if (p.vx < 0) p.vx = Math.min(0, p.vx + FRIC_GROUND); }
    }
    p.vx = clamp(p.vx, -maxS, maxS);
    if (idle && slopeSlide === 0 && Math.abs(p.vx) < 0.05) p.vx = 0;

    // Phase 3: drop-through (Down + Jump on a one-way platform)
    if (downHeld && jumpPressed && p.onGround && p.onOneWay) {
      p.dropTimer = DROP_TIMER;
      p.onGround = false;
      p.vy = 2;
    } else if (jumpPressed && p.onGround) {
      p.vy = JUMP_VEL; p.onGround = false; SFX.jump();
    }
    const g = p.vy < 0 ? (jumpHeld ? GRAV_UP_HELD : GRAV_UP_RELEAS) : GRAV_DOWN;
    p.vy += g; if (p.vy > TERM_VY) p.vy = TERM_VY;

    const prevBottom = p.y + p.h;   // BUG #1 fix: remember feet line before moving
    p.bumped = false;
    move(p, true);
    if (p.bumped) handleBump(p.bumpTx, p.bumpTy);

    for (let i = coins.length - 1; i >= 0; i--) if (aabb(p, coins[i])) { coins.splice(i, 1); addCoin(1); addScore(200); SFX.coin(); }

    if (p.invuln > 0) p.invuln--;
    // Phase 4: advance the animation state machine
    const inputDir = left ? -1 : right ? 1 : 0;
    playerAnim.update(p, inputDir);
    checkEnemies(p, prevBottom);
    if (p.y > VIEW_H + 40) killPlayer();
  }
  // --- enemies ---
  function checkEnemies(p, prevBottom) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]; if (e.dead) continue;
      if (!aabb(p, e)) continue;
      // BUG #1 FIX: a stomp is when we were above the enemy's top line last
      // frame (within STOMP_TOL) and are falling into it this frame. Using the
      // previous feet position instead of the current overlap depth makes stomps
      // reliable even when the overlap is registered a frame late.
      const fromAbove = prevBottom <= e.y + STOMP_TOL;
      if (p.vy >= 0 && fromAbove) { e.dead = true; e.squish = 28; p.vy = jumpHeld ? STOMP_HOLD : STOMP; p.y = e.y - p.h; addScore(100); SFX.stomp(); }
      else damagePlayer();
    }
  }
  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) { if (--e.squish <= 0) enemies.splice(i, 1); continue; }
      if (!e.active) { if (e.x < camX + VIEW_W + 32) e.active = true; else continue; }
      const bv = e.vx; e.vy += GRAV_DOWN; if (e.vy > TERM_VY) e.vy = TERM_VY;
      move(e, false);
      if (bv !== 0 && e.vx === 0) e.vx = -bv; // turn around at a wall
      if (e.y > VIEW_H + 40) enemies.splice(i, 1);
    }
  }

  // --- mushrooms ---
  function updateMushrooms() {
    for (let i = mushrooms.length - 1; i >= 0; i--) {
      const m = mushrooms[i];
      if (m.emerging) { m.y -= 0.5; if (m.y <= m.restY) m.emerging = false; continue; }
      m.vy += GRAV_DOWN; if (m.vy > TERM_VY) m.vy = TERM_VY;
      const bv = m.vx; move(m, false); if (bv !== 0 && m.vx === 0) m.vx = -bv;
      if (m.y > VIEW_H + 40) { mushrooms.splice(i, 1); continue; }
      if (aabb(player, m)) { collectMush(m); mushrooms.splice(i, 1); }
    }
  }
  function collectMush(m) {
    if (!player.big) { player.big = true; player.y -= (BIG_H - SMALL_H); player.h = BIG_H; player.invuln = 60; }
    addScore(1000); SFX.pow();
  }

  // --- damage / death ---
  function damagePlayer() {
    if (player.invuln > 0) return;
    if (player.big) { player.big = false; player.y += (player.h - SMALL_H); player.h = SMALL_H; player.invuln = INVULN; SFX.shrink(); }
    else killPlayer();
  }
  function killPlayer() { if (state !== 'playing') return; state = 'dying'; player.vy = -9; deathTimer = 0; SFX.die(); Music.stop(); }
  function updateDying() {
    deathTimer++; player.vy += GRAV_DOWN; if (player.vy > TERM_VY) player.vy = TERM_VY; player.y += player.vy;
    if (player.y > VIEW_H + 120) { lives--; if (lives > 0) { loadLevel(false); state = 'playing'; Music.start(); } else state = 'gameover'; }
  }
  // --- timer / camera / flag ---
  function updateTimer() { timeFrame++; if (timeFrame >= TIME_TICK) { timeFrame = 0; timeLeft--; if (timeLeft <= 0) { timeLeft = 0; killPlayer(); } } }
  function updateCamera() { camera.update(player, W * TILE); camX = camera.x; }
  function checkFlag() {
    if (state === 'playing' && player.x + player.w / 2 >= flagX) {
      state = 'complete';
      addScore(clamp(Math.round((flagBaseY - player.y) / 8) * 100, 100, 5000));
      addScore(timeLeft * 10);
      completeTimer = 0; flagSlideDone = false; SFX.flag();
      player.vx = 0; player.vy = 0; player.x = flagX - 8; player.facing = -1;
    }
  }
  function updateComplete() {
    completeTimer++;
    if (!flagSlideDone) {
      if (player.y + player.h < flagBaseY) player.y += 2;
      else { player.y = flagBaseY - player.h; flagSlideDone = true; }
    } else {
      player.x += 0.6; player.facing = 1; if (player.x > flagX + 56) player.x = flagX + 56;
    }
    if (completeTimer > 140) { state = 'win'; Music.stop(); }
  }

  // --- main update (one 60fps tick) ---
  function update() {
    frame++;
    if (paused) return;
    jumpHeld = input.jumpHeld();
    jumpPressed = input.tickJump();

    if (state === 'title') return;
    if (state === 'gameover' || state === 'win') return;
    if (state === 'dying') { updateDying(); return; }
    if (state === 'complete') { updateComplete(); return; }

    updateTimer();
    updatePlayer();
    updateEnemies();
    updateMushrooms();
    for (let i = coinPops.length - 1; i >= 0; i--) { const c = coinPops[i]; c.vy += 0.5; c.cy += c.vy; if (--c.life <= 0) coinPops.splice(i, 1); }
    for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.vy += 0.5; s.x += s.vx; s.y += s.vy; if (--s.life <= 0) shards.splice(i, 1); }
    for (let i = bounces.length - 1; i >= 0; i--) { bounces[i].age++; if (bounces[i].age > 10) bounces.splice(i, 1); }
    updateCamera();
    checkFlag();
  }
  // --- render ---
  function render() {
    if (state === 'title') { drawTitle(); return; }
    drawBackground(); drawTiles(); drawCoins(); drawCoinPops(); drawCastle(); drawFlag(); drawShards(); drawMushrooms(); drawEnemies(); drawPlayer(); drawHUD();
    if (state === 'gameover') drawGameOver();
    if (state === 'win') drawWin();
    if (paused) drawPause();
  }

  function drawBackground() {
    ctx.fillStyle = '#5c94fc'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#fcfcfc';
    const c0 = (-camX * 0.4) % 160;
    for (let x = c0 - 160; x < VIEW_W + 80; x += 160) { cloud(x, 26); cloud(x + 70, 42); }
    const h0 = (-camX * 0.6) % 120;
    for (let x = h0 - 120; x < VIEW_W + 80; x += 120) hill(x, 184);
  }
  function cloud(x, y) { ctx.fillRect(x + 3, y, 12, 5); ctx.fillRect(x, y + 4, 18, 5); ctx.fillRect(x + 5, y + 9, 8, 2); }
  function hill(x, y) { ctx.fillStyle = '#00a800'; ctx.fillRect(x, y - 6, 56, 6); ctx.fillStyle = '#10b810'; ctx.fillRect(x + 8, y - 12, 40, 6); ctx.fillRect(x + 16, y - 18, 24, 6); }

  function drawTiles() {
    const s = Math.floor(camX / TILE), e = s + Math.ceil(VIEW_W / TILE) + 1;
    for (let ty = 0; ty < H; ty++) for (let tx = s; tx <= e; tx++) {
      if (tx < 0 || tx >= W) continue;
      const c = tilemap.tileAt(tx, ty); if (c === '.') continue;
      let dx = tx * TILE - camX, dy = ty * TILE + bounceOff(tx, ty);
      drawTile(c, dx, dy, tx, ty);
    }
  }
  function bounceOff(tx, ty) { for (const b of bounces) if (b.tx === tx && b.ty === ty) return -Math.round(6 * Math.sin(Math.PI * b.age / 10)); return 0; }
  function drawTile(c, x, y, tx, ty) {
    if (c === '#' || c === '=') ground(x, y, tilemap.autotile[ty * W + tx]);
    else if (c === 'X') hard(x, y); else if (c === 'B') brick(x, y);
    else if (c === '?' || c === 'M') qblock(x, y, ((frame / 8) | 0) % 2); else if (c === 'U') used(x, y);
    else if (c === 'Q') pipeL(x, y, 1); else if (c === 'W') pipeR(x, y, 1);
    else if (c === 'E') pipeL(x, y, 0); else if (c === 'R') pipeR(x, y, 0);
    else if (c === '/') slopeSlash(x, y);
    else if (c === '\\') slopeBack(x, y);
    else if (c === '-') oneWayPlank(x, y);
  }
  // --- Phase 2: autotiled ground (organic terrain) ---
  // `idx` is the bitmask from bakeAutotile(). We composite a dirt base with a
  // grass cap, lit/dark cliff edges and rounded corners on top. Pure rendering
  // — the collision layer above is untouched.
  function ground(x, y, idx) {
    autotileDirt(x, y);
    if (idx & ATLAS.cap) autotileCap(x, y);
    if (idx & ATLAS.edgeL) autotileEdgeL(x, y);
    if (idx & ATLAS.edgeR) autotileEdgeR(x, y);
    if (idx & ATLAS.cornerTL) autotileCornerTL(x, y);
    if (idx & ATLAS.cornerTR) autotileCornerTR(x, y);
  }
  function autotileDirt(x, y) {
    ctx.fillStyle = '#c8824c'; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = '#b06a34'; ctx.fillRect(x + 3, y + 7, 2, 2); ctx.fillRect(x + 10, y + 11, 2, 2); ctx.fillRect(x + 13, y + 6, 1, 1); ctx.fillRect(x + 5, y + 13, 1, 1);
    ctx.fillStyle = '#e0a86c'; ctx.fillRect(x + 7, y + 9, 1, 1); ctx.fillRect(x + 11, y + 14, 1, 1);
  }
  function autotileCap(x, y) {
    ctx.fillStyle = '#8ce83c'; ctx.fillRect(x, y, 16, 1);   // bright top highlight
    ctx.fillStyle = '#3cb830'; ctx.fillRect(x, y + 1, 16, 2); // grass body
    ctx.fillStyle = '#1a7a10'; ctx.fillRect(x, y + 3, 16, 1); // dark fringe into the dirt
  }
  function autotileEdgeL(x, y) {
    ctx.fillStyle = '#e0a86c'; ctx.fillRect(x, y + 4, 2, 12); // lit left cliff face
    ctx.fillStyle = '#f2c890'; ctx.fillRect(x, y + 4, 1, 12);
  }
  function autotileEdgeR(x, y) {
    ctx.fillStyle = '#8a4c1c'; ctx.fillRect(x + 14, y + 4, 2, 12); // shadowed right cliff face
    ctx.fillStyle = '#6a3410'; ctx.fillRect(x + 15, y + 4, 1, 12);
  }
  function autotileCornerTL(x, y) {
    ctx.fillStyle = '#3cb830'; ctx.fillRect(x, y + 4, 2, 2); // grass rounds down on the left
    ctx.fillStyle = '#1a7a10'; ctx.fillRect(x, y + 6, 2, 1);
  }
  function autotileCornerTR(x, y) {
    ctx.fillStyle = '#3cb830'; ctx.fillRect(x + 14, y + 4, 2, 2); // grass rounds down on the right
    ctx.fillStyle = '#1a7a10'; ctx.fillRect(x + 14, y + 6, 2, 1);
  }
  // --- Phase 3: slope rendering (dirt fill under diagonal + grass cap) ---
  function slopeSlash(x, y) {
    // '/' — surface rises left→right: (x, y+16) to (x+16, y)
    for (let px = 0; px < 16; px++) {
      const surfRow = 15 - px; // row index of the surface at this column
      if (surfRow < 15) { ctx.fillStyle = '#c8824c'; ctx.fillRect(x + px, y + surfRow + 1, 1, 15 - surfRow); }
      ctx.fillStyle = '#3cb830'; ctx.fillRect(x + px, y + surfRow, 1, 1);
      if (surfRow > 0) { ctx.fillStyle = '#8ce83c'; ctx.fillRect(x + px, y + surfRow - 1, 1, 1); }
    }
  }
  function slopeBack(x, y) {
    // '\' — surface rises right→left: (x, y) to (x+16, y+16)
    for (let px = 0; px < 16; px++) {
      const surfRow = px; // row index of the surface at this column
      if (surfRow < 15) { ctx.fillStyle = '#c8824c'; ctx.fillRect(x + px, y + surfRow + 1, 1, 15 - surfRow); }
      ctx.fillStyle = '#3cb830'; ctx.fillRect(x + px, y + surfRow, 1, 1);
      if (surfRow > 0) { ctx.fillStyle = '#8ce83c'; ctx.fillRect(x + px, y + surfRow - 1, 1, 1); }
    }
  }
  // --- Phase 3: one-way platform (2px top bar) ---
  function oneWayPlank(x, y) {
    ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x, y, 16, 2);
    ctx.fillStyle = '#A0722B'; ctx.fillRect(x, y, 16, 1);
    ctx.fillStyle = '#6B3A1B'; ctx.fillRect(x, y + 1, 16, 1);
  }
  function hard(x, y) { ctx.fillStyle = '#b0b0b0'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x, y, 16, 2); ctx.fillRect(x, y, 2, 16); ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x + 14, y, 2, 16); ctx.fillRect(x, y + 14, 16, 2); ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + 12, y + 2, 2, 2); ctx.fillRect(x + 2, y + 12, 2, 2); ctx.fillRect(x + 12, y + 12, 2, 2); }
  function brick(x, y) { ctx.fillStyle = '#c04a10'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#f08030'; ctx.fillRect(x, y, 16, 1); ctx.fillStyle = '#7a2a08'; ctx.fillRect(x, y + 7, 16, 1); ctx.fillRect(x + 7, y, 1, 7); ctx.fillRect(x + 3, y + 8, 1, 8); ctx.fillRect(x + 11, y + 8, 1, 8); }
  function qblock(x, y, fr) { ctx.fillStyle = fr ? '#f8a830' : '#e08020'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#ffd070'; ctx.fillRect(x, y, 16, 1); ctx.fillRect(x, y, 1, 16); ctx.fillStyle = '#7a3c08'; ctx.fillRect(x + 14, y, 2, 16); ctx.fillRect(x, y + 14, 16, 2); ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 13, y + 1, 2, 2); ctx.fillRect(x + 1, y + 13, 2, 2); ctx.fillRect(x + 13, y + 13, 2, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x + 5, y + 3, 6, 2); ctx.fillRect(x + 9, y + 5, 2, 2); ctx.fillRect(x + 7, y + 7, 4, 2); ctx.fillRect(x + 7, y + 9, 2, 2); ctx.fillRect(x + 7, y + 12, 2, 2); }
  function used(x, y) { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#6a4018'; ctx.fillRect(x + 14, y, 2, 16); ctx.fillRect(x, y + 14, 16, 2); ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 13, y + 1, 2, 2); ctx.fillRect(x + 1, y + 13, 2, 2); ctx.fillRect(x + 13, y + 13, 2, 2); }
  function pipeL(x, y, cap) { pipeBase(x, y, cap); ctx.fillStyle = '#58d854'; ctx.fillRect(x + 2, y, cap ? 14 : 3, 16); }
  function pipeR(x, y, cap) { pipeBase(x, y, cap); ctx.fillStyle = '#005800'; ctx.fillRect(x + 12, y, cap ? 4 : 4, 16); }
  function pipeBase(x, y, cap) { ctx.fillStyle = '#00a800'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#58d854'; ctx.fillRect(x, y, 16, cap ? 3 : 2); }
  // --- entities ---
  function oval(cx, cy, rx, ry) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawCoinAt(cx, cy) {
    const w = Math.abs(Math.cos(frame * 0.15));
    const rx = Math.max(1, Math.round(1 + w * 4));
    ctx.fillStyle = '#7a4a08'; oval(cx, cy, rx + 1, 6);
    ctx.fillStyle = '#fcb800'; oval(cx, cy, rx, 5);
    ctx.fillStyle = '#fff0a0'; oval(cx, cy - 1, Math.max(1, rx / 2), 2);
  }
  function drawCoins() { for (const c of coins) drawCoinAt(c.x - camX + c.w / 2, c.y + c.h / 2); }
  function drawCoinPops() { for (const c of coinPops) drawCoinAt(c.cx - camX, c.cy); }
  function drawCastle() {
    const bx = 166 * TILE - camX; if (bx > VIEW_W + 80 || bx < -80) return;
    const gy = 13 * TILE, w = 48, h = 44, x = bx, y = gy - h;
    ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#707070'; for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 12 + 1, y - 4, 8, 5);
    ctx.fillStyle = '#202020'; ctx.fillRect(x + w / 2 - 6, y + 20, 12, h - 20); ctx.fillRect(x + 6, y + 8, 8, 8); ctx.fillRect(x + w - 14, y + 8, 8, 8);
  }
  function drawFlag() {
    const x = flagX - camX; if (x > VIEW_W + 10 || x < -20) return;
    const topY = 5 * TILE, baseY = 13 * TILE;
    ctx.fillStyle = '#00a800'; ctx.fillRect(x - 1, topY, 2, baseY - topY); ctx.fillRect(x - 3, topY - 4, 6, 4);
    let fy = topY + 4;
    if (state === 'complete') fy = flagSlideDone ? baseY - 24 : Math.min(baseY - 24, topY + 4 + completeTimer * 0.6);
    ctx.beginPath(); ctx.moveTo(x - 1, fy); ctx.lineTo(x - 13, fy + 5); ctx.lineTo(x - 1, fy + 10); ctx.closePath(); ctx.fill();
  }
  function drawShards() { for (const s of shards) { ctx.fillStyle = '#c04a10'; ctx.fillRect(s.x - camX, s.y, 4, 4); ctx.fillStyle = '#7a2a08'; ctx.fillRect(s.x - camX, s.y + 3, 4, 1); } }
  function drawMushrooms() {
    for (const m of mushrooms) {
      if (mushroomSheet.loaded) {
        mushroomSheet.draw(ctx, 0, m.x - camX + (m.w - 16) / 2, m.y + m.h - 16);
      } else {
        drawSprite(Sprites.mushroom, m.x - camX + (m.w - Sprites.mushroom.width) / 2, m.y + m.h - Sprites.mushroom.height, false);
      }
    }
  }
  function drawEnemies() {
    for (const e of enemies) {
      const dx = e.x - camX - 1;
      if (goombaSheet.loaded) {
        if (e.dead) {
          ctx.save(); ctx.translate(Math.round(dx), e.y + e.h - 8); ctx.scale(1, 0.5);
          goombaSheet.draw(ctx, 0, 0, 0);
          ctx.restore();
        } else {
          const fi = (e.active && Math.abs(e.vx) > 0.1) ? ((frame >> 3) & 1) : 0;
          goombaSheet.draw(ctx, fi, dx, e.y - 2, { flipX: e.vx > 0 });
        }
      } else {
        if (e.dead) { ctx.save(); ctx.translate(dx, e.y + e.h - 6); ctx.scale(1, 0.5); ctx.drawImage(Sprites.goomba, 0, 0); ctx.restore(); }
        else drawSprite(Sprites.goomba, dx, e.y - 2, false);
      }
    }
  }
  function drawSprite(img, x, y, flip) {
    const ix = Math.round(x), iy = Math.round(y);
    if (!flip) ctx.drawImage(img, ix, iy);
    else { ctx.save(); ctx.translate(ix + img.width, iy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
  }
  function drawPlayer() {
    const p = player; if (p.invuln > 0 && (frame & 4)) return;
    if (playerSheet.loaded) {
      // Phase 4: draw from the PNG sprite sheet
      const fi = playerAnim.frame;
      const dx = p.x - camX + (p.w - 16) / 2;
      const dy = p.y + p.h - 16;
      playerSheet.draw(ctx, fi, dx, dy, { flipX: p.facing < 0 });
    } else {
      // Fallback: ASCII pixel-art
      const img = p.big ? Sprites.marioBig : (p.onGround ? Sprites.marioSmall : Sprites.marioSmallJump);
      const bob = (p.onGround && Math.abs(p.vx) > 0.2 && ((frame >> 2) & 1)) ? -1 : 0;
      drawSprite(img, p.x - camX + (p.w - img.width) / 2, p.y + p.h - img.height + bob, p.facing < 0);
    }
  }

  // --- HUD & screens ---
  function drawHUD() {
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.font = '8px monospace';
    ctx.fillText('MARIO', 8, 6); ctx.fillText(String(score).padStart(6, '0'), 8, 14);
    drawCoinAt(84, 10); ctx.fillText('x' + String(coinsTotal % 100).padStart(2, '0'), 92, 14);
    ctx.fillText('WORLD', 140, 6); ctx.fillText('1-1', 150, 14);
    ctx.fillText('TIME', 196, 6); ctx.fillText(String(timeLeft).padStart(3, '0'), 198, 14);
    ctx.fillText('x' + lives, 236, 6);
  }
  function drawTitle() {
    ctx.fillStyle = '#5c94fc'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#00a800'; ctx.fillRect(0, 176, VIEW_W, 64);
    ctx.fillStyle = '#fcfcfc'; for (let i = 0; i < 3; i++) cloud(20 + i * 80, 36);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.fillText('SUPER', 128, 58);
    ctx.fillStyle = '#fcb800'; ctx.font = 'bold 20px monospace'; ctx.fillText('PLUMBER BROS.', 128, 80);
    ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText('A NES-ERA PLATFORMER', 128, 112);
    ctx.fillStyle = '#ffd000'; ctx.font = '9px monospace'; if ((frame >> 4) & 1) ctx.fillText('PRESS ENTER TO START', 128, 140);
    ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
    ctx.fillText('<  >  /  A D : move', 128, 184);
    ctx.fillText('SPACE / W / UP : jump (hold=higher)', 128, 196);
    ctx.fillText('SHIFT / X : run    P : pause    M : mute', 128, 208);
    ctx.textAlign = 'left';
  }
  function overlay() { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  function drawGameOver() {
    overlay(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f00'; ctx.font = 'bold 18px monospace'; ctx.fillText('GAME OVER', 128, 90);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.fillText('SCORE ' + String(score).padStart(6, '0'), 128, 118);
    ctx.fillStyle = '#ffd000'; ctx.font = '9px monospace'; ctx.fillText('PRESS ENTER TO RETRY', 128, 150);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
  function drawWin() {
    overlay(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 16px monospace'; ctx.fillText('COURSE CLEAR!', 128, 84);
    ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.fillText('SCORE ' + String(score).padStart(6, '0'), 128, 112); ctx.fillText('COINS ' + (coinsTotal % 100), 128, 126);
    ctx.fillStyle = '#ffd000'; if ((frame >> 4) & 1) ctx.fillText('PRESS ENTER TO PLAY AGAIN', 128, 156);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
  function drawPause() {
    overlay(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('PAUSED', 128, 110);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
  // --- load level data BEFORE boot (injectable transport: fetch in the
  //     browser, disk in the Node harness) so loadLevel() stays synchronous
  //     and the game loop is never made async ---
  const LEVEL_URL = 'assets/levels/w1-1.json';
  const isNode = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
  if (isNode) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const { resolve, dirname } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    setLevelTransport(async (url) => JSON.parse(await readFile(resolve(here, '..', url), 'utf8')));
  } else {
    setLevelTransport((url) => fetch(url).then((r) => { if (!r.ok) throw new Error('level fetch failed: ' + url); return r.json(); }));
  }
  let levelData = await loadLevelData(LEVEL_URL);

  // --- Phase 4: initialize sprite sheets (init in Node, load in browser) ---
  if (isNode) {
    playerSheet.init(64, 32);   // 4×2 grid of 16×16
    goombaSheet.init(32, 16);   // 2×1 grid of 16×16
    mushroomSheet.init(16, 16); // 1×1
  } else {
    await Promise.all([playerSheet.load(), goombaSheet.load(), mushroomSheet.load()]);
  }

  // --- boot (fixed-timestep loop lives in engine/loop.js) ---
  state = 'title';
  loadLevel(true);
  runLoop(update, render);

  // --- test / debug handle (used by test/harness.mjs; harmless in browser) ---
  export const __internals = {
    get state() { return state; },
    get player() { return player; },
    get camX() { return camX; },
    get score() { return score; },
    get coins() { return coins; },
    get lives() { return lives; },
    get timeLeft() { return timeLeft; },
    get enemies() { return enemies; },
    get frame() { return frame; },
    get grid() { return tilemap.rows(); },
    get W() { return W; },
    get H() { return H; },
    get flagX() { return flagX; },
    get tilemap() { return tilemap; },
    // Phase 4: sprite sheet + animation access
    get playerSheet() { return playerSheet; },
    get goombaSheet() { return goombaSheet; },
    get mushroomSheet() { return mushroomSheet; },
    get playerAnim() { return playerAnim; },
    startGame,
    // Phase 3 test hook: load a different level data object for testing
    loadTestLevel(data) { levelData = data; loadLevel(true); state = 'playing'; },
  };

