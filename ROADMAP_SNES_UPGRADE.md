# SNES "Super Mario World" Engine Upgrade — Roadmap

> **Generated:** 2026-09-05 · **Status:** ✅ **Phases 0–7b delivered & committed** · Phase 7c/7d (stretch) pending (live checklist in `HANDOVER.md` §7)
> Companion to `HANDOVER.md`. Step‑by‑step plan for upgrading *Super Plumber Bros.* from a NES‑era single‑layer platformer to a **data‑driven, 16‑bit‑style** engine.
> ⚠️ Originally a plan-only doc. **Phases 0–7b have since been executed** (ES-module refactor, JSON level format, autotiling, slope/one-way physics, sprite sheets + real art, parallax, VFX, high-score + fire flower/fireballs — see `HANDOVER.md` §3 for per-phase summaries). Phases 7c–7d remain planning.

---

## Scope & hard constraints
- **No build step, no npm, no node runtime for the GAME** — it runs in the browser with zero deps. Serve with `python3 -m http.server 8000`, open `index.html`.
  - *Dev-time relaxation (added in Phase 0):* a **Node test harness** (`npm test` → `test/harness.mjs`) validates behaviour headlessly. Dev tool only — the shipped game still needs no npm/node.
- **ES modules** (`<script type="module">`) — adopted in Phase 0 (original plan: keep plain `<script>` + recommend modules). Still no build step.
- Preserve the fixed **60 fps** timestep and the existing `js/chiptune.js` music engine.
- The workspace path **contains a space** — always quote it in the shell.

## Open decisions (confirm before Phase 0)
| # | Decision | Recommendation | Alternative |
|---|---|---|---|
| 1 | Module system | **ES modules** (`<script type="module">`) | keep IIFEs on `window` |
| 2 | Logical resolution | **256×240** (zero disruption, matches current CSS scaling) | 512×240 "wide SMW" |
| 3 | Art assets | generate **placeholder PNG sheets/tiles** so the engine is fully playable before final art | user supplies final PNGs |

## End‑state file structure
```
index.html
assets/
  sprites/    # mario_small.png, mario_big.png, goomba.png, item_*.png …
  tiles/      # autotile + block tile sheets (atlas format)
  bg/         # parallax: sky.png, mountains.png, hills.png, trees.png
  levels/     # w1-1.json, …
js/
  engine/
    constants.js      # all tuning (physics, sizes) in one place
    input.js          # key state + edge detection (jump-pressed, …)
    loop.js           # fixed 60fps timestep (moved from game.js)
    camera.js         # follow + clamp + (optional) shake
    collision.js      # AABB + slope height-field + one-way platforms  ★
    particle.js       # pooled ParticleSystem                          ★
  game/
    level.js          # JSON loader → typed arrays
    tilemap.js        # multi-layer store + autotile bake + queries   ★
    spritesheet.js    # PNG loader + frame slicing + draw             ★
    animation.js      # state-based frame controller                  ★
    parallax.js       # multi-layer scrolling background              ★
    player.js         # physics + animation + VFX hooks
    enemy.js
    item.js
    vfx.js            # dust / coin-pop / block-bounce / score popups ★
  game.js             # orchestrator: state machine + update/render
```
(★ = new file this upgrade introduces.)

---

## Phase 0 — Foundations & Groundwork ✅ DELIVERED
*Goal: decouple the `game.js` monolith so later phases are isolated and testable. No gameplay change.*
- Adopt **ES modules** (decision 1). Preserve an IIFE fallback path if preferred.
- Extract `constants.js`, `input.js`, `loop.js`, `camera.js` out of `game.js`.
- **Fix the 2 known bugs now** (from `HANDOVER.md` §5): stomp‑collision tolerance + camera overshoot — so slopes are built on clean physics.
- Centralise `VIEW_W/VIEW_H/TILE` (decision 2: 256×240 vs 512×240).
- **Acceptance:** 1‑1 still plays identically; each extraction is independently verifiable.

---

## Phase 1 — Data‑Driven Multi‑Layer Tilemaps  ★ ✅ DELIVERED
Replace the single procedural JS grid with a **JSON, three‑layer** format: `background` / `collision` / `foreground` + a pixel‑anchored `entities` list. Each layer is an array of equal‑length strings; one char = one tile resolved through a shared legend.

### Level JSON format
```jsonc
{
  "id": "w1-1",
  "tileSize": 16,
  "width": 224,
  "height": 15,
  "camera": { "mode": "follow", "lead": 0.35 },
  "spawn": { "x": 48, "y": 192 },
  "parallax": ["assets/bg/sky.png", "assets/bg/mountains.png", "assets/bg/hills.png"],

  "layers": {
    "background": [   // decorative, NO collision (optional; superseded by parallax imgs)
      "         t              t           t                t        ",
      "         t              t           t                t        "
    ],
    "collision": [    // the gameplay surface
      "  ~ / ~                                              ",
      "         ?                                          ",
      "         B ? B ? B                                  ",
      "  # = #              o                              ",
      "  / # #  \\            B                             ",
      "  # # # # #   _ _ _ _  ? M ?                       ",
      "  # # # # #   _ _ _ _  B B B ?                     ",
      "  # # # # #                    # # # #            ",
      "  # # # # #        Q W        # # # #    _ _ _    ",
      "  # # # # #        E R   Q W   # # # #    _ _ _    ",
      "  # # # # #        E R   E R   # # # #         ~ / ",
      "  # # # # #  \\     # # # #   # # # # # # # #  # # #",
      "  # # # # #  \\     # # # #   # # # # # # # #  # # #"
    ],
    "foreground": [   // drawn OVER the player
      "         v v v                                         "
    ]
  },

  "entities": [
    { "type": "goomba",   "x": 352,  "y": 208, "speed": 0.5 },
    { "type": "goomba",   "x": 480,  "y": 208, "speed": 0.5 },
    { "type": "coin",     "x": 336,  "y": 128 },
    { "type": "mushroom", "x": 704,  "y": 128, "block": true },
    { "type": "flag",     "x": 2560, "baseRow": 13, "topRow": 5 }
  ]
}
```

### Tile legend (collision layer) — one char → tile descriptor
| Char | Meaning | Collision | Notes |
|---|---|---|---|
| ` `/`.` | empty | none | |
| `#` | ground | solid | **autotiled** (grass cap / dirt / corner by neighbours) |
| `=` | ground filler | solid | explicit dirt body (autotile also infers) |
| `/` `\` | 45° slope (up‑right / up‑left) | solid + slope | height‑field surface |
| `~` `^` | 22.5° slope (up‑right / up‑left) | solid + slope | "small" SMW slope |
| `_` | one‑way platform | semi‑solid | jump up‑through, land on, drop‑through |
| `o` | hard block | solid | |
| `B` | brick | solid, breakable (big) | |
| `?` / `M` | coin / item block | solid, bumpable | |
| `U` | used block | solid | |
| `Q W E R` | pipe cap L/R, body L/R | solid | explicit multi‑tile pipe |
| *(fg)* `v`,`b` | vine / bush | none (draw over player) | foreground only |
| *(bg)* `t`,`h` | tree / hill | none | background only |

### What this phase builds
- **`level.js` (loader):** fetch/parse JSON → validate dims → convert each layer string to a **typed `Int16Array`** (tile IDs) for O(1) lookup; entities → normalized objects.
- **`tilemap.js`:** stores the 3 arrays + exposes the query API the whole engine depends on: `tileAt`, `isSolid`, `isOneWay`, `slope(tx,ty)`, `surfaceYAt(x,y)` (defined in Phase 3).
- **Migration:** transcribe 1‑1 into `levels/w1-1.json` (ground, pits, pipes, stairs, blocks, coins, goombas, flag) so behaviour is **1:1** before any physics change.
- **Acceptance:** 1‑1 loads from JSON and plays identically; adding `levels/w1-2.json` needs **zero engine edits**.

---

## Phase 2 — Decorative Autotiling  ★ ✅ DELIVERED
Make `#` ground render as organic terrain (grass top, dirt body, lit/shaded corners) instead of a flat repeating block.

### Algorithm (Moore‑neighbour mask, baked once at load)
For every ground tile, inspect its 8 neighbours and build a **neighbour mask** (bit per occupied direction):
```
1=N  2=NE  4=E  8=SE  16=S  32=SW  64=W  128=NW
mask = (N?1:0)|(NE?2:0)|(E?4:0)|(SE?8:0)|(S?16:0)|(SW?32:0)|(W?64:0)|(NW?128:0)
```
Two authoring flavours:
- **Full 256‑entry pattern sheet** (RPG Maker/Tiled style) — exhaustive, pixel‑perfect, but 256 tiles to author.
- **Feature‑rule sheet (recommended for the SNES look)** — a small hand‑authored set driven by 3 rules:
  1. **Surface cap** — if `N` empty → draw the ~4 px grass cap on top (the signature look).
  2. **Side shading** — if `W` empty → brighten left edge; if `E` empty → darken right edge (cliff profile).
  3. **Corners** — `N&E` empty → top‑right cap; `N&W` empty → top‑left cap.

```js
function bakeAutotile(tilemap) {            // run once after load
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
  tilemap.autotile = out;                   // render reads this, not the raw grid
}
```
- Slopes (`/ \ ~ ^`) are **excluded** from the mask path and drawn from dedicated slope frames so their silhouettes stay clean.
- **Asset:** one 16×16 autotile sheet (cap, cap+edgeL, cap+edgeR, cornerTL, cornerTR, edgeL, edgeR, dirt). A **placeholder sheet** is generated in code so the engine runs before final art (decision 3).
- **Acceptance:** exposed ground shows grass tops + dirt below, cliffs show lit/dark edges, corners are clean; a level authored with only `#`/`/`/`\` yields organic hills.

---

## Phase 3 — Slope Physics & Semi‑Solids  ★ ✅ DELIVERED (core physics)
Replace the flat AABB grid resolution in `move()` with a **per‑tile height‑field** so ground level varies *within* a tile.

### 3a. Slope as a height field
Each slope tile stores the surface height **from the top of the tile** at its left/right edges `(hL, hR)`. Surface world‑Y = `ty*16 + lerp(hL, hR, fx)`, where `fx = (x % 16)/16`.

| Tile | (hL, hR) | Geometry |
|---|---|---|
| flat solid | `(0, 0)` | surface at tile top |
| `/` 45° ↑right | `(16, 0)` | Δ16 px → `atan(16/16) = 45°` |
| `\` 45° ↑left | `(0, 16)` | |
| `~` 22.5° ↑right | `(16, 8)` | Δ8 px → `atan(8/16) = 26.6°` (SMW "small slope") |
| `^` 22.5° ↑left | `(8, 16)` | |

> Exact‑angle note: `tan(45°)=1.0 → Δ16 px`. True 22.5° is `tan(22.5°)·16 ≈ 6.6 px`; SMW uses the **8 px half‑tile step**, so `~`/`^` give the authentic small‑slope feel. Use Δ = 8 (visual) or 7 (exact) — tunable in `constants.js`.

### 3b. Unified ground query
```js
// tilemap.js
surfaceYAt(x, probeY) {
  const tx = Math.floor(x / TILE), ty = Math.floor(probeY / TILE);
  const s = this.slope(tx, ty);            // {hL,hR} for slope tiles, {0,0} for solid, null for empty
  if (!s) return null;                     // nothing to stand on at this probe
  const fx = (x - tx * TILE) / TILE;
  return ty * TILE + s.hL + (s.hR - s.hL) * fx;
}
```

### 3c. Falling / landing (rides slopes naturally)
Sample the surface at the **two inset bottom corners** of the AABB; land on the highest (smallest‑Y) surface at/below the previous feet line.
```js
const MARGIN = 1;                          // inset avoids catching tile seams
function resolveGroundFall(ent, prevBottom) {
  if (ent.vy < 0) return;                  // rising: no ground snap
  const xL = ent.x + MARGIN, xR = ent.x + ent.w - MARGIN;
  const gyL = tilemap.surfaceYAt(xL, prevBottom + ent.vy);
  const gyR = tilemap.surfaceYAt(xR, prevBottom + ent.vy);
  let surface = null;
  for (const gy of [gyL, gyR])
    if (gy != null && gy >= prevBottom - EPS)      // only land on/below where we were
      surface = (surface == null || gy < surface) ? gy : surface;
  if (surface != null) { ent.y = surface - ent.h; ent.vy = 0; ent.onGround = true; }
}
```
A flat solid is just `(0,0)`, so **one path handles flats, 45° and 22.5°** — the feet track the interpolated line as the player ascends (the SMW "glued to the slope" feel).

### 3d. Horizontal blocking / step‑up
After moving X, check the **leading** corner: if the surface there is higher than the feet by more than `MAX_STEP_UP`, treat it as a wall; otherwise snap up (step assist).
```js
const MAX_STEP_UP = 6;
function resolveSlopeWall(ent, prevX, prevBottom) {
  const leadX = ent.vx > 0 ? ent.x + ent.w - MARGIN : ent.x + MARGIN;
  const sy = tilemap.surfaceYAt(leadX, prevBottom + ent.vy);
  if (sy == null) return;
  const climb = (prevBottom + ent.vy) - sy;          // >0 ⇒ surface is above feet
  if (climb > MAX_STEP_UP) { ent.x = prevX; ent.vx = 0; }  // wall
  else if (climb > 0) ent.y = sy - ent.h;                       // gentle step‑up
}
```

### 3e. One‑way platforms (semi‑solids) + drop‑through
Collide **only** when falling **and** the previous feet were at/above the platform top. Upward motion passes through. `Down + Jump` on one starts a short ignore window.
```js
function resolveOneWay(ent, prevBottom) {
  if (ent.vy < 0 || ent.dropTimer > 0) return;            // jump-through / dropping
  const bottom = prevBottom + ent.vy;
  const l = Math.floor((ent.x + MARGIN) / TILE), r = Math.floor((ent.x + ent.w - MARGIN) / TILE);
  const ty = Math.floor(bottom / TILE);
  for (let tx = l; tx <= r; tx++) {
    if (tilemap.isOneWay(tx, ty) && prevBottom <= ty * TILE + 0.01) {
      ent.y = ty * TILE - ent.h; ent.vy = 0; ent.onGround = true; ent.onOneWay = true;
      return;
    }
  }
}
// input hook: if (downHeld && jumpPressed && player.onOneWay) player.dropTimer = 14;
```

### 3f. Slope feel tuning (SMW behaviour)
- **Slope friction:** on‑ground on a downhill surface → small extra decel + downhill nudge (coast but can brake).
- **Slope slowdown:** scale horizontal accel by `cos(θ)` of the local slope.
- **Enemies:** reuse `resolveGroundFall`/`resolveSlopeWall` so Goombas patrol slopes and drop off ledges (keep ledge‑turnaround).
- **Order per tick:** `integrate → resolveSlopeWall(X) → resolveGroundFall(Y) → resolveOneWay(Y) → step‑down settle`.
- **Acceptance:** player runs up/down 45° + 22.5° slopes without jitter, lands on one‑way platforms, jumps up through them, drops through with `Down+Jump`; Goombas ride the same terrain.
### 3g. Regression fix — pipe/stair walls must block short entities (player + Goombas)
*Status: ✅ fixed + regression-tested (`test/harness.mjs` → `[bug fix · pipes block small mario + goombas]`).*

**Symptom:** small Mario and Goombas walked straight *through* solid 2‑tile pipes (and stair sides). Big Mario was unaffected.

**Root cause:** the Phase 3 height‑field rewrite's X‑axis "entirely above me → skip" test compared the tile's **top surface** (`surfY = ty·TILE + hL`) against the entity's head:
```js
if (surfY <= ent.y || surfY >= ent.y + ent.h) continue;   // BUG: top surface
```
A pipe body tile's top sits *above* a short entity's head, so `surfY <= ent.y` was true and the tile was skipped — the wall was invisible to a 14‑px‑tall body. Big Mario (h=28) reached up into the tile *above* the pipe body, making the test false, which is why only short entities (small Mario, Goombas) were affected.

**Fix:** test the tile **bottom** for the "above" bound, so a wall whose bottom is at/above the head is still skipped, but a wall the body actually overlaps is not:
```js
if ((ty * TILE + TILE) <= ent.y || surfY >= ent.y + ent.h) continue;   // FIXED: tile bottom
```
Applied to **both** X‑axis branches (`vx>0` and `vx<0`) in `move()`, `js/game.js` (~L211 / L231). One‑line‑per‑branch change; no structural refactor.

**Regression test:** a 30×15 level with a 2‑tile pipe; small Mario walks right into it (must stop, `vx→0`, right edge ≤ pipe left) and a Goomba walks left into it (must turn around, `vx` flips `+`). The position/velocity assertions fail on the pre‑fix build.

---

## Phase 4 — Asset Pipeline: Sprite Sheets + Animation Controller  ★ ✅ DELIVERED
Replace ASCII sprites with **PNG sheets** + a **state machine** picking frames from velocity + ground state + power‑up.

### 4a. `spritesheet.js` — atlas loader + slicer
```js
class SpriteSheet {
  constructor(src, cellW, cellH) {
    this.img = new Image(); this.cellW = cellW; this.cellH = cellH; this.frames = [];
  }
  load() {                                   // async, browser, no build step
    if (!this._p) this._p = new Promise((res, rej) => {
      this.img.onload = () => {
        const rows = Math.floor(this.img.naturalHeight / this.cellH);
        const cols = Math.floor(this.img.naturalWidth / this.cellW);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
          this.frames.push({ sx: c * this.cellW, sy: r * this.cellH });
        res(this);
      };
      this.img.onerror = rej; this.img.src = src;
    });
    return this._p;
  }
  draw(ctx, index, x, y, { flipX = false } = {}) {
    const f = this.frames[index % this.frames.length], px = Math.round(x), py = Math.round(y);
    if (!flipX) ctx.drawImage(this.img, f.sx, f.sy, this.cellW, this.cellH, px, py, this.cellW, this.cellH);
    else { ctx.save(); ctx.translate(px + this.cellW, py); ctx.scale(-1, 1);
           ctx.drawImage(this.img, f.sx, f.sy, this.cellW, this.cellH, 0, 0, this.cellW, this.cellH); ctx.restore(); }
  }
}
```
- Optional **manifest mode** (JSON list of named, non‑uniform rects) for mixed‑size sheets.
- A top‑level `AssetLoader` pre‑loads all sheets in parallel and gates `startGame()` on `Promise.all`.

### 4b. `animation.js` — state‑based controller
State chosen every tick from `onGround`, `vx` (speed + sign), `vy` (rise/fall), input direction (skid), and `power` (small/big/fire).
```js
function pickPlayerState(p, inputDir) {
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
  const speed = Math.abs(p.vx);
  if (inputDir !== 0 && Math.sign(inputDir) !== Math.sign(p.vx) && speed > 1.2) return 'skid';
  if (speed < 0.15) return 'idle';
  return speed > 2.4 ? 'run_fast' : 'run';
}
```

| State | Trigger | Frames / feel |
|---|---|---|
| `idle` | onGround, `|vx|<0.15` | 1–2 frame breathe |
| `run` / `run_fast` | onGround, moving; `|vx|` tier | frame **rate scales with speed** (sprint = fast legs) |
| `skid` | onGround, input opposite `vx`, `|vx|>1.2` | 2‑frame brace + **dust** (Phase 6) |
| `jump` / `fall` | airborne, `vy<0` / `vy≥0` | apex vs tuck |
| `land` | ground after a big fall | 1‑frame squash + **dust burst** |
| `hurt`/`grow`/`shrink` | power transitions | short scripted sequences |
| *(power‑up variants)* | `power ∈ {small, big, fire}` | separate sheet per power |

- **Migration (done):** player/Goomba/item rendering switched from `Sprites.*` canvases to `SpriteSheet.draw(…)`. Real art landed, so the ASCII `sprites.js` fallback was **removed** and the file **deleted** — rendering is PNG-only.
- **Acceptance:** player cycles idle→run→skid→jump→fall; skid triggers dust; run frame rate speeds up on sprint; power‑up swaps the active sheet.

---

## Phase 5 — Parallax Scrolling  ★ ✅ DELIVERED
Replace hardcoded `drawBackground()` with a **data‑driven multi‑layer** scroller (the `parallax` array in the level JSON).
```js
class Parallax {
  constructor(layers) { this.layers = layers; }            // [{img, factor, y}]
  draw(ctx, camX, W, H) {
    for (const L of this.layers) {
      const w = L.img.naturalWidth;
      let ox = (-camX * L.factor) % w; if (ox > 0) ox -= w;   // seamless wrap
      for (let x = ox; x < W; x += w) ctx.drawImage(L.img, Math.round(x), L.y);
    }
  }
}
```
- **Layer stack (back→front):** static sky (`0`, tiled/gradient) → far mountains (`0.15`) → hills (`0.4`) → trees/bushes (`0.7`) → **gameplay tiles (`1.0`)** → **foreground layer (`1.0`, drawn *after* the player)**.
- Pre‑composite each layer to an offscreen canvas once; keep `imageSmoothingEnabled=false`.
- **Acceptance:** sky static, mountains slow, hills/trees faster; foreground tiles pass *in front of* Mario.

---

## Phase 6 — VFX / "Game Juice"  ★ ✅ DELIVERED
Generalize the existing `coinPops` / `shards` / `bounces` into one **pooled `ParticleSystem`** (object‑pool → no GC hitches).

| Effect | Trigger | Spec |
|---|---|---|
| **Skid dust** | `skid` state | continuous, small sprites at feet, low gravity, fast fade |
| **Landing dust** | `land` state | burst count ∝ fall speed |
| **Coin pop** | coin / `?` block | coin rises + spins + fades **+** a floating `+200` score popup |
| **Block‑bounce** | any block hit | draw‑Y offset `= -A·sin(π·age/T)` over `T` frames — generalize existing `bounceOff()` |
| **Item poof** | item appears | radial spark burst |
| **Screen shake** *(optional)* | big impacts | sub‑pixel camera offset, decaying |

```js
// block-bounce, generalized from the current bounceOff()
function blockBounceY(tx, ty, now) {
  const e = bounceMap.get(tx + ',' + ty);
  return e ? -Math.round(6 * Math.sin(Math.PI * (now - e.t0) / e.t)) : 0;
}
// pooled dust emitter
function emitDust(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    const p = pool.pop(); if (!p) return;
    p.x = x; p.y = y; p.vx = (Math.random() - 0.5) * spread; p.vy = -Math.random() * 1.5;
    p.life = p.max = 18 + (Math.random() * 10 | 0);
  }
}
// render: alpha = p.life / p.max  →  free fade-out
```
- **Acceptance:** skid leaves a dust trail, landings puff ∝ height, coins pop with a score float, hit blocks bounce smoothly, all at 60 fps.

---

## Phase 7 — SMW Polish & Power‑Ups *(stretch, after core)* — ✅ 7a/7b DELIVERED · 7c/7d pending
- **Fire Flower + fireballs** (SMW fire‑power analog), `fire` sheet + state.
- **Koopa Troopa** (drop shell / kick) + a flyer, using the new slope physics.
- **High‑score persistence** via `localStorage` (already on the `HANDOVER.md` roadmap).
- Optional **512‑wide** mode + a **world map** linking multiple `levels/*.json`.
- Audio: keep `chiptune.js` (SNES‑style layers later — out of scope now).

---

## Validation strategy (browser‑only, no node)
1. Serve the folder (`python3 -m http.server 8000`) and load `index.html`.
2. Run each phase's **Acceptance** check above.
3. Add temporary **dev toggles** (collision grid / slope height‑field overlay / particle count) — strip for release.
4. `level.js` performs a **JSON schema check** and logs a clear error on malformed maps (safe authoring without a linter).

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Slope/AABB jitter at tile seams | `MARGIN` inset sampling + `MAX_STEP_UP` step‑assist + dev overlay; verify in browser |
| PNG sheets not yet available | **Resolved** — real sheets baked from `js/sprite-data.js`; the ASCII `sprites.js` fallback was removed |
| ES‑module change vs "no build step" | native `<script type="module">`; IIFE fallback documented in Phase 0 |
| 256 vs 512 width churns parallax/level data | lock in Phase 0 `constants.js`; level JSON width is independent either way |
| 2 known bugs resurface after the physics rewrite | fixed in **Phase 0** before any slope work |

## Execution order & dependencies
`0 → 1 → 2 → 3` (core engine) · then `4, 5, 6` are **independent of each other** (any order once 0–3 land) · `7` last.
Phases 2 (visual) and 3 (physical) both touch `tilemap.js`/`collision.js`, so 2→3, but either can be partially deferred.