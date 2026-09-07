// ============================================================
//  particles.js — pooled particle system (Phase 6: VFX / "Game Juice")
//
//  A fixed-size OBJECT POOL of particles. The whole pool is pre-allocated
//  once; dead slots are reused forever and NOTHING is created inside
//  emit()/update()/draw() — no per-frame allocation, no GC hitches.
//
//  * emit(x, y, opts)  -> grabs a dead slot, or DROPS the spawn when the
//    pool is full (returns the particle, or null when dropped).
//  * update()          -> advances physics (vy += gravity; x += vx; y += vy)
//    and decays life; a particle dies when life hits 0 and its slot returns
//    to the free list.
//  * draw(ctx, camX)   -> renders alive particles with alpha = life/max
//    (free fade-out). `ctx` is injected by the caller (a stub in the headless
//    harness), mirroring the parallax DI pattern.
//
//  Kinds:
//    dot / dust / poof  -> soft squares (feet dust, landing puff, item poof)
//    shard              -> 4x4 brick debris (brick break)
//    coin               -> rising + spinning + fading coin
//    text               -> floating score popup (e.g. "+200")
//    bounce             -> NOT drawn; a per-tile draw-Y offset queried via
//                          bounceOffset(tx, ty) (generalizes the old bounceOff)
//
//  This module is a pure engine: emit()/update() are DOM-free and unit-
//  testable; only draw() touches the (injected) 2D context.
// ============================================================

import { VIEW_W } from './constants.js';

const TWO_PI = Math.PI * 2;

export class ParticleSystem {
  /**
   * @param {number} capacity - fixed pool size (hard cap; never grows)
   */
  constructor(capacity = 128) {
    this.capacity = capacity;
    // Pre-allocate the ENTIRE pool up front. Each slot is a plain object that
    // is reused forever — the pool array itself is never resized.
    this.pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = {
        alive: false,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, max: 1,
        size: 2, color: '#ffffff', gravity: 0,
        kind: 'dot',
        tx: 0, ty: 0,        // tile coords (bounce kind only)
        text: '',            // text kind only
      };
    }
    // Free list = indices of dead slots. LIFO reuse keeps it allocation-free.
    this._free = new Array(capacity);
    for (let i = 0; i < capacity; i++) this._free[i] = capacity - 1 - i;
    this._freeTop = capacity;      // number of entries currently in _free
    this._bounceCount = 0;         // active 'bounce' particles (fast-path)
    this.alive = 0;                // live particle count (always <= capacity)
  }

  /**
   * Spawn one particle. Reuses a dead slot; if the pool is full the spawn is
   * DROPPED and null is returned (this is what keeps the pool bounded).
   *
   * @param {number} x       - world x (px)
   * @param {number} y       - world y (px; == screen y, no vertical camera)
   * @param {object} [opts]  - { kind, vx, vy, gravity, size, color, life, tx, ty, text }
   * @returns {object|null}  the particle slot, or null when the pool is full
   */
  emit(x, y, opts = {}) {
    if (this._freeTop === 0) return null;   // pool full -> drop the spawn
    const i = this._free[--this._freeTop];
    const p = this.pool[i];
    p.alive = true;
    p.x = x; p.y = y;
    p.vx = opts.vx || 0;
    p.vy = opts.vy || 0;
    p.gravity = opts.gravity || 0;
    p.size = opts.size || 2;
    p.color = opts.color || '#ffffff';
    p.kind = opts.kind || 'dot';
    p.tx = opts.tx | 0;
    p.ty = opts.ty | 0;
    p.text = opts.text || '';
    p.max = opts.life || 20;
    p.life = p.max;
    if (p.kind === 'bounce') this._bounceCount++;
    this.alive++;
    return p;
  }

  /**
   * Advance every alive particle by one 60fps tick. Dead slots recycle into
   * the free list. No allocation happens here.
   */
  update() {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      if (--p.life <= 0) {
        p.alive = false;
        if (p.kind === 'bounce') this._bounceCount--;
        this._free[this._freeTop++] = i;
        this.alive--;
      }
    }
  }

  /** Kill every particle (level restart). */
  clear() {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (p.alive) {
        p.alive = false;
        if (p.kind === 'bounce') this._bounceCount--;
        this._free[this._freeTop++] = i;
        this.alive--;
      }
    }
  }

  /**
   * Block-bounce draw-Y offset for a tile (generalizes the old bounceOff()).
   * `age` is derived from the particle's remaining life: age = max - life, so
   * a bounce emitted with life 11 sweeps age 0..10 over 11 frames, matching
   * the original `bounces` array exactly.
   * @returns {number} a negative (upward) pixel offset, or 0 when idle
   */
  bounceOffset(tx, ty) {
    if (this._bounceCount === 0) return 0;      // common case: nothing bouncing
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (p.alive && p.kind === 'bounce' && p.tx === tx && p.ty === ty) {
        const age = p.max - p.life;
        return -Math.round(6 * Math.sin(Math.PI * age / 10));
      }
    }
    return 0;
  }

  /**
   * Render all alive (non-bounce) particles. alpha = life/max gives a free
   * fade-out; off-screen particles are culled. `ctx` is injected (stub in the
   * headless harness).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX - camera x (world px)
   */
  draw(ctx, camX) {
    const viewW = (ctx && ctx.canvas && ctx.canvas.width) || VIEW_W;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (!p.alive || p.kind === 'bounce') continue;
      const sx = p.x - camX;
      if (sx < -8 || sx > viewW + 8) continue;   // cull off-screen
      const sy = p.y;
      ctx.globalAlpha = p.life / p.max;          // free fade-out
      this._draw(ctx, p, sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  // --- per-kind renderers (keep the switch small and allocation-free) ---
  _draw(ctx, p, sx, sy) {
    switch (p.kind) {
      case 'coin': {
        // rising + spinning + fading coin (spin phase from its own elapsed
        // time; the coin is short-lived so this reads identically to a
        // frame-based spin). Fade comes from the caller's globalAlpha.
        const t = p.max - p.life;
        const w = Math.abs(Math.cos(t * 0.15));
        const rx = Math.max(1, Math.round(1 + w * 4));
        ctx.fillStyle = '#7a4a08'; this._oval(ctx, sx, sy, rx + 1, 6);
        ctx.fillStyle = '#fcb800'; this._oval(ctx, sx, sy, rx, 5);
        ctx.fillStyle = '#fff0a0'; this._oval(ctx, sx, sy - 1, Math.max(1, rx / 2), 2);
        break;
      }
      case 'shard': {
        // brick-break debris: a 4x4 brick with a dark seam (matches old drawShards)
        ctx.fillStyle = '#c04a10'; ctx.fillRect(sx, sy, 4, 4);
        ctx.fillStyle = '#7a2a08'; ctx.fillRect(sx, sy + 3, 4, 1);
        break;
      }
      case 'text': {
        // floating score popup; save/restore isolates the text state so we
        // never leak alignment into the HUD or other draws.
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, Math.round(sx), Math.round(sy));
        ctx.restore();
        break;
      }
      default: {
        // dot / dust / poof: a soft square centered on the particle
        const s = p.size | 0;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(sx - (s >> 1)), Math.round(sy - (s >> 1)), s, s);
      }
    }
  }

  _oval(ctx, cx, cy, rx, ry) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TWO_PI); ctx.fill();
  }
}