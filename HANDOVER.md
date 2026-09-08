# Project Handover — Super Plumber Bros.

> **Read this first if you're picking up the session fresh.**
> Last updated: 2026-09-08. Branch: `master`. **Phases 0 through 7b of the SNES upgrade are complete and committed.**
> Phase 0: ES-module refactor + both §5 bugs fixed + headless Node test harness. Phase 1: 3-layer JSON level
> format + loader + tilemap query API, World 1-1 migrated to `assets/levels/w1-1.json`, and the game switched
> to the JSON path (verified 1:1 by grid-diff + harness). Phase 2: decorative autotiling — `#`/`=` ground now
> renders as organic terrain (grass cap, dirt body, lit/dark cliff edges, rounded corners) via a Moore-neighbour
> mask baked once at load (render-only; collision untouched). Phase 3: per-tile slope physics (45° `/` `\` with
> step-up + downhill slide) and one-way platforms (`-` with drop-through) — collision rewritten as a height-field
> in `game.js`, 22 new harness checks, test level `w1-1-slopes.json`. Phase 4: PNG sprite sheet loader + frame
> grid slicer (`spritesheet.js`), state-based animation controller (`animation.js` — idle/run/run_fast/skid/
> jump/fall/land), real-art PNG sheets in `assets/sprites/` (placeholders resolved, verified in browser), integrated into `game.js` — ASCII fallback removed.
> 45 new harness checks (115 total). Node 22 is now installed.
> Phase 5: multi-layer parallax scrolling (`engine/parallax.js`) — a data-driven stack of horizontally
> tileable layers (sky 0 → mountains 0.15 → clouds 0.3 → hills 0.4 → trees 0.7) pre-composited to offscreen
> canvases at boot; `drawBackground()` in `game.js` now blits the stack before the tiles. Placeholder art is
> procedural (seamless integer-period silhouettes anchored to the ground line y=208); the level JSON `parallax`
> field is the future hook for real PNG layers. 18 new harness checks (133 total). Phase 6: pooled particle
> system (`engine/particles.js`) — a fixed object pool + free-list reuse (zero per-frame allocation); folds in the
> old coinPops/shards/bounces (coin → rising+spin+fade **+ a floating `+200` popup**, shards → brick debris,
> block bounce → `bounceOffset` tile draw-Y) and adds skid dust, landing dust ∝ fall speed, item poof, and a
> decaying screen shake. 20 new harness checks (153 total). Phase 7a: high-score persistence via `localStorage`
> (feature-detected for headless; `loadHighScore`/`saveHighScore` in `game.js`, tracks best across lives, 5 new
> harness checks, 158 total). Phase 7b: Fire Flower + fireballs — `F` tile char in level JSON, fireflower entity
> (emerge animation, collect → fire power, small→fire also grows), fireball spawn (Z key, fire power only, max 1),
> fireball physics (gravity, ground bounce ×3, wall bounce, off-screen cull), fireball kills enemies (100 pts + squish),
> side damage degrades fire→big (not straight to small). 15 new harness checks (173 total). Also fixed a `levelData`
> leak: `loadTestLevel` replaced the module-level `levelData`, so `startGame` now restores `bootLevelData` to
> prevent cross-phase corruption in the test harness.
> Phase 7 art polish: the **placeholder** PNG sheets were replaced with **real pixel-art sheets** baked from `js/sprite-data.js` (the single source of truth) via `tools/gen-sprites.mjs`, verified in the browser. The ASCII `js/sprites.js` fallback was **removed** and the file **deleted** — rendering is PNG-only. Added dedicated `player-big.png` + `player-fire.png` sheets (64×64, 4×2 of 16×32) and fixed `drawPlayer` to pick the sheet by `player.power`, so big/fire fill the 28px hitbox with feet flush to the ground. 9 new harness checks (182 total).
> The one thing we're working on right now: **executing the SNES engine upgrade — see `ROADMAP_SNES_UPGRADE.md` (next: Phase 7c — Koopa Troopa + shell mechanics).**

---

## 1. What this project is

A **Super-Mario-Bros.-style (NES-era) platformer** written from scratch in **pure HTML / CSS / Canvas / JavaScript**. No libraries, no build step, no npm. One fully playable level (**World 1-1**).

- Serve it over HTTP (`python3 -m http.server 8000`) and open `index.html` in a browser — the game is now **ES modules**, which need HTTP (not `file://`).
- Renders at true NES resolution (**256×240**) and scales up with `image-rendering: pixelated`.
- Fixed **60 fps logic timestep** inside `requestAnimationFrame` (identical feel on 60Hz/144Hz).
- Axis-separated AABB collision vs a tile grid (move X → resolve → move Y → resolve).

### Controls
| Key | Action |
|---|---|
| `← →` / `A D` | Move |
| `Space` / `W` / `↑` | Jump (hold = higher) |
| `Shift` / `X` | Run |
| `Z` | Fire (fireball, fire power only) |
| `P` | Pause |
| `Enter` | Start / restart |

---

## 2. File map

| File | What it is | Status |
|---|---|---|
| `index.html` | Canvas + control hints + **script order** | ✅ done (tracked) |
| `style.css` | Layout + pixelated scaling | ✅ done (tracked) |
| `js/sprite-data.js` | **Single source of truth** for sprite pixel art (palettes + ASCII rows) — feeds the PNG baker `tools/gen-sprites.mjs` (the game renders PNG-only) | ✅ tracked |
| `js/level.js` (85 ln) | World 1-1 as feature placements — **now only the source for the Phase 1 generator + harness baseline**; the running game no longer imports it | ✅ legacy (Phase 1) |
| `js/game.js` | **Entry module** — physics, collision, entities, HUD, **SFX**; imports `engine/`; **loads the level from `assets/levels/w1-1.json`**; **renders autotiled ground**; **height-field collision (Phase 3)**; **sprite sheet rendering + animation controller (Phase 4)**; **parallax background (Phase 5)** | ✅ Phase 0 + **Phase 1** + **Phase 2** + **Phase 3** + **Phase 4** + **Phase 5** |
| `js/engine/constants.js` | **NEW** all tunables (view/physics/camera/**collision**) in one place | ✅ Phase 0 + **Phase 3** |
| `js/engine/input.js` | **NEW** keyboard state + jump edge detection | ✅ Phase 0 |
| `js/engine/loop.js` | **NEW** fixed 60fps timestep | ✅ Phase 0 |
| `js/engine/camera.js` | **NEW** smooth look-ahead follow + safety clamp | ✅ Phase 0 (bug #2) |
| `js/engine/level.js` | **NEW** 3-layer JSON parser (`parseLevel`) + injectable transport (`setLevelTransport`) + `loadLevelData` | ✅ Phase 1 |
| `js/engine/tilemap.js` | **NEW** `createTilemap` — typed-array collision grid with `tileAt`/`solidAt`/`isGround`/`set`/`rows` + **`bakeAutotile` + `ATLAS` (Phase 2)** + **`slope`/`isOneWay`/`surfaceYAt` (Phase 3)** | ✅ Phase 1 + Phase 2 + **Phase 3** |
| `js/engine/spritesheet.js` | **NEW** PNG atlas loader — `computeFrames()` pure function + `SpriteSheet` class (`load()` browser / `init()` headless, `draw()` with flipX) | ✅ Phase 4 |
| `js/engine/animation.js` | **NEW** state-based frame controller — `pickPlayerState()` + `AnimController` (idle/run/run_fast/skid/jump/fall/land, speed-dependent rate, land squash) | ✅ Phase 4 |
| `js/engine/parallax.js` | **NEW** multi-layer parallax background — pure `layerOffset()` + `ParallaxLayer` + `createParallax(specs, makeCanvas)` (pre-composited offscreen strips, seamless modulo tiling, DI canvas factory for headless) | ✅ Phase 5 |
| `js/chiptune.js` (284 ln) | NES-style sequencer + 3 original tracks (now an ES-module export) | ✅ done |
| `test/harness.mjs` + `test/browser-stub.mjs` | **NEW** headless Node behaviour tests + browser stubs (**182 checks**, incl. Phase 1 loader/tilemap + Phase 2 autotile + Phase 3 slope/one-way + Phase 4 spritesheet/animation + Phase 5 parallax + Phase 6 particles + Phase 7 high-score/fire flower) | ✅ Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + **Phase 6** + **Phase 7** |
| `package.json` | **NEW** `{"type":"module"}` + `npm test` (no deps/build) | ✅ Phase 0 |
| `assets/levels/README.md` | **NEW** 3-layer JSON level format spec (background/collision/foreground) | ✅ Phase 1 |
| `assets/levels/w1-1.json` | **NEW** World 1-1 as JSON (migrated 1:1 from `buildLevel`) | ✅ Phase 1 |
| `assets/levels/w1-1-slopes.json` | **NEW** test level with `/` `\` slopes + `-` one-way platforms (Phase 3 physics) | ✅ Phase 3 |
| `tools/generate-w1-1.mjs` | **NEW** dev tool: regenerate `w1-1.json` from `buildLevel()` | ✅ Phase 1 |
| `tools/grid-diff.mjs` | **NEW** dev tool: assert the JSON-derived grid == `buildLevel()` grid (byte-identical) | ✅ Phase 1 |
| `tools/browser-smoke.mjs` | **NEW** dev tool: force the browser fetch branch, boot the game, verify the player moves | ✅ Phase 1 |
| `tools/gen-sprites.mjs` | **NEW** dev tool: bakes real-art PNG sprite sheets from `js/sprite-data.js` (minimal PNG encoder, no deps) | ✅ Phase 4 |
| `assets/sprites/player.png` | **NEW** player sheet (64×32, 4×2 grid of 16×16 — one cell per anim state) — real art | ✅ Phase 4 |
| `assets/sprites/goomba.png` | **NEW** goomba sheet (32×16, 2×1 grid — two walk frames) — real art | ✅ Phase 4 |
| `assets/sprites/mushroom.png` | **NEW** mushroom sheet (16×16, single frame) — real art | ✅ Phase 4 |
| `music_options.html` (138 ln) | **NEW** standalone page to listen to & pick a track | ✅ done (tracked) |
| `ROADMAP_SNES_UPGRADE.md` | **NEW** full SNES‑engine upgrade roadmap (Phase 0–7) | 📋 plan — see §3 |
| `README.md` | Project overview / run instructions | ✅ done |
| `generate_mario_summary.py` | Python (`python-docx`) status-doc generator | ✅ done (tracked) |
| `Mario_Project_Summary.docx` | Generated status doc (v0 + 2 bugs) | ⚠️ generated artifact (tracked) |
| `test.py` | Dev-container smoke test | ✅ done (tracked) |
| `.DS_Store`, `~$rio_Project_Summary.docx` | macOS + Word temp junk | 🗑️ safe to delete |

> **Git:** Phase 0 is committed (`d633189`), Phase 1 in three commits (`4578a46` format+loader+tilemap, `b099b59` w1-1.json migration, `7a8a3de` game switched to the JSON path), Phase 2 in four commits (`9bc477d` autotile core, `76c7542` harness checks, `52231d5` autotile render, + this docs commit), Phase 3 in two commits (slope height-field + one-way platforms, test level + harness + docs), and Phase 4 in three commits (`d5a6d5d` spritesheet.js + animation.js, `d149c35` placeholder PNGs + generator, `d4e543f` game.js integration + 45 harness checks). `music_options.html`, `generate_mario_summary.py`, `Mario_Project_Summary.docx`, and `test.py` are all **tracked** (music-preview page + status-doc tooling + dev smoke test).

---

## 3. The current task — SNES Engine Upgrade (where we left off)

The focus is a **major engine upgrade**: bringing *Super Plumber Bros.* up to a **16-bit SNES / Super Mario World** standard. A complete, phased plan is in **`ROADMAP_SNES_UPGRADE.md`** (Phase 0–7).

**Status: Phases 0 through 7b are complete and committed.** The codebase is pure **ES modules** (no build step), with `game.js` split into `js/engine/` (constants / input / loop / camera / **level** / **tilemap** / **spritesheet** / **animation** / **parallax**), both §5 bugs fixed, and a **headless Node test harness** (`test/harness.mjs`, **182 checks**) that runs the real game module and validates behaviour. Phase 1 added the **3-layer JSON level format** + loader + tilemap query API, migrated World 1-1 to `assets/levels/w1-1.json`, and switched the running game to load from JSON (verified 1:1 by `tools/grid-diff.mjs` + the harness). **Phase 2 (decorative autotiling)** added `bakeAutotile` + `ATLAS` to `tilemap.js` and made `#`/`=` ground render as organic terrain — a **render-only** change verified by 9 new harness checks, with `tools/grid-diff.mjs` still reporting GRID 1:1 OK. **Phase 3 (slope physics & semi-solids)** rewrote the collision in `game.js` as a per-tile height-field: 45° `/` `\` slopes with step-up (≤ 8px auto-climb) + downhill slide, and `-` one-way platforms with drop-through (Down+Jump). Verified by 22 new harness checks (tilemap unit + integration) and a dedicated test level `w1-1-slopes.json`. **Phase 4 (sprite sheets + animation controller)** added `spritesheet.js` (PNG atlas loader + `computeFrames()` slicer) and `animation.js` (state machine: idle/run/run_fast/skid/jump/fall/land with speed-dependent frame rate + land squash), real-art PNG sheets in `assets/sprites/` (placeholders resolved), and integrated them into `game.js` with the ASCII `sprites.js` fallback now removed. 45 new harness checks validate the slicing math, state picker, and controller transitions. **Phase 5 (parallax scrolling)** added `engine/parallax.js` — a data-driven stack of horizontally-tileable layers (sky 0 → mountains 0.15 → clouds 0.3 → hills 0.4 → trees 0.7) pre-composited to offscreen canvases at boot, each blitted per frame at offset `-(camX·factor) % layerWidth`; `drawBackground()` now draws the stack before the tiles. Placeholder art is procedural (seamless integer-period silhouettes anchored to the ground line y=208), and the level JSON `parallax` field is the future hook for real PNG layers. 18 new harness checks validate the offset math, tiling coverage, and layer wiring. **Phase 6 (VFX / "Game Juice")** added `engine/particles.js` — a fixed-size **pooled** `ParticleSystem` (pre-allocated slots + free-list reuse, zero per-frame allocation) with `emit`/`update`/`clear`/`bounceOffset`/`draw(ctx, camX)` and per-kind renderers (coin, shard, text, dot/dust/poof, bounce). It folds in the old `coinPops`/`shards`/`bounces` arrays (coin → rising + spinning + fading coin **plus a floating `+200` popup**, shards → brick debris, block bounce → `bounceOffset` tile draw-Y) and adds new juice: **skid dust**, **landing dust ∝ fall speed**, **item poof** (mushroom spawn), and a decaying **screen shake** (sub-pixel camera translate in `render()`, HUD kept stable). 20 new harness checks validate pool bounds, the `alpha = life/max` fade, the preserved bounce sine math, and live game wiring (153 total).

**Scope of the roadmap:**
- **Engine & physics** — data-driven multi-layer JSON tilemaps (`background`/`collision`/`foreground`), decorative autotiling (grass/dirt/corners), and a new **slope + one-way-platform physics** core (45° & 22.5° slopes via a per-tile height field).
- **Asset pipeline** — PNG sprite-sheet atlas loader + a state-based animation controller (idle/run/skid/jump/fall by velocity + ground state + power-up).
- **Rendering & juice** — data-driven multi-layer **parallax** scrolling (sky → mountains → hills → foreground-over-player) and a pooled **VFX** system (skid/land dust, coin-pop + score float, block-bounce sine displacement).
### Phase 3 — slope physics & semi-solids ✅ DONE
Implemented: `/` `\` (45° solid slopes) + `-` (one-way platform) in the collision height-field. Key design decisions:
- Collision logic kept in `game.js` (smaller change than extracting `collision.js`)
- `surfaceYAt(x, probeY)` interpolates between `hL`/`hR` per tile for smooth slope landing
- One-way detection uses `prevBottom <= ty*TILE` (feet were above platform top last frame)
- Slope slide skips friction when active (so velocity accumulates downhill)
- Y-resolution tolerance uses `MAX_STEP_UP` (8px) to handle step-up + slope interaction
- `w1-1.json` left pristine to preserve grid-diff baseline; test level `w1-1-slopes.json` exercises new physics
- 22 new harness checks (13 tilemap unit + 9 integration)

### Known issues / limitations (carry-forward)
| # | Issue | Impact | Suggested fix |
|---|---|---|---|
| 1 | **Adjacent `\` tile boundary discontinuity** — two adjacent `\` tiles create a Y-jump at the shared edge (right edge of tile N = tile bottom, left edge of tile N+1 = tile top). The two-corner probe sees `gyL > gyR` on the left tile but `gyL < gyR` on the right, causing the slide to reverse. | Multi-tile slopes (3+ consecutive `\` or `/`) don't slide smoothly; single-tile slopes work fine. | Use the tile's own gradient (`hR - hL` from the *current* tile) rather than comparing absolute surface heights across the boundary. Or clamp the probe to the current tile's column. |
| 2 | **One-way jump-through lands back on platform** — after jumping up through a `-` platform, the player falls back onto it (correct one-way behaviour). Not a bug, but may feel unintuitive in some level designs. | None (by design). | N/A — document in level design guide if needed. |

### Phase 4 — sprite sheets + animation controller (✅ done)
* **`js/engine/spritesheet.js`:** `computeFrames(imgW, imgH, cellW, cellH)` pure function returns a row-major array of `{sx, sy}` source-rect origins. `SpriteSheet` class: `constructor(src, cellW, cellH)`, `load()` (browser: `new Image()` → onload → populate frames), `init(imgW, imgH)` (headless: set frames from known dims without an Image), `draw(ctx, index, x, y, {flipX, offsetX, offsetY})`. Frame index wraps via modulo.
* **`js/engine/animation.js`:** `pickPlayerState(p, inputDir)` pure function → `'idle' | 'run' | 'run_fast' | 'skid' | 'jump' | 'fall'`. `AnimController` class: `update(p, inputDir)` advances one tick, returns the frame index to draw. States map to frame indices 0-6 in a 4×2 grid. Run alternates frames every 8 ticks (walk) or 4 ticks (sprint). Land squash: 6-tick timer after falling → ground.
* **Real-art PNGs** (placeholders resolved) in `assets/sprites/`: `player.png` (64×32, 4×2 grid of 16×16 frames), `player-big.png` + `player-fire.png` (64×64, 4×2 of 16×32), `goomba.png` (32×16, 2×1), `mushroom.png` + `fireflower.png` (16×16). Baked by `tools/gen-sprites.mjs` from `js/sprite-data.js` (minimal PNG encoder using Node's built-in `zlib`). Real art verified in browser.
* **Integration in `game.js`:** sheets created at module top, initialized at boot (`init()` in Node, `load()` in browser). `playerAnim.update()` called in `updatePlayer()`. `drawPlayer()`/`drawEnemies()`/`drawMushrooms()` render **exclusively from the PNG sheets** — the ASCII `Sprites.*` fallback was removed once real art was verified in browser.
* **45 new harness checks** validate: `computeFrames()` slicing math, `SpriteSheet.init()` headless setup, `SpriteSheet.draw()` no-throw, game sheet initialization, `pickPlayerState()` for all states + edge cases, `AnimController` transitions, frame advancement timing, land timer countdown, reset.
* **`js/sprites.js`** (the ASCII canvas fallback) is **deleted** — real art is verified in the browser, so the render path is PNG-only. `js/sprite-data.js` remains the single source of truth for `tools/gen-sprites.mjs`.

### Phase 5 — parallax scrolling (✅ done)
* **`js/engine/parallax.js`:** pure `layerOffset(camX, factor, layerWidth)` (returns an offset in `[-w, 0]`, periodic with period `w/f`), a `ParallaxLayer` (holds a pre-composited offscreen canvas + factor + `y`), and a `createParallax(specs, makeCanvas)` factory. Each spec is `{ name, factor, y, width, height, paint(ctx, w, h) }`; `paint` runs **once** at build time to composite the strip, then per-frame `draw(ctx, camX, viewW)` blits it seamlessly tiled (`for x = offset; x < viewW; x += width`). `makeCanvas` is injectable (DI, mirroring the level transport) so the headless harness gets a stub; it defaults to `document.createElement('canvas')`. `imageSmoothingEnabled` is forced off for crisp pixel art.
* **Layer stack (back → front), per ROADMAP Phase 5:** sky (0) → mountains (0.15) → clouds (0.3) → hills (0.4) → trees (0.7). Gameplay tiles stay at factor 1.0.
* **Placeholder art (procedural, defined in `game.js`):** each silhouette is a per-column fill from a height function down to the bottom of the strip, anchored to the ground line (row 13, y=208). Height functions use **integer-period** triangle/sine waves whose periods divide the strip width, so `topFn(0) === topFn(width)` and the strips tile with no seam (verified headlessly). Palette is depth-ramped (hazy-blue mountains → light-green hills → dark-green trees) so the layers read *behind* the bright foreground grass. Clouds are discrete puffs kept fully inside the strip (no edge contact → seamless).
* **Integration in `game.js`:** `BG_LAYERS` + paint functions at module top; `const parallax = createParallax(BG_LAYERS)` at boot. `drawBackground()` now calls `parallax.draw(ctx, camX, VIEW_W)` (replacing the old solid `#5c94fc` fill + hand-drawn clouds/hills), drawn **before** `drawTiles()`. The old `hill()` helper was removed; `cloud()` is kept (still used by `drawTitle()`).
* **18 new harness checks** validate: `layerOffset` range / periodicity / monotonic drift / seamless-wrap / invalid-width guard; game wiring (5 layers, factors `[0, 0.15, 0.3, 0.4, 0.7]`, monotonic back→front, every layer has a canvas + positive size); and tiling coverage (a counting ctx confirms the draw loop tiles each layer enough times to cover the view). All **133** checks pass; grid-diff still reports GRID 1:1 OK.
* **Future hook:** the level JSON already has a `"parallax": []` field (documented as "bg image paths"). To swap in real art later, load each path into a canvas and pass it as the layer's `canvas` (skip the procedural `paint`); nothing else changes.

### Phase 6 — VFX / "Game Juice" (✅ done)
* **`js/engine/particles.js`:** a **pooled** `ParticleSystem` — a fixed-size object pool (pre-allocated slots + LIFO free-list, **zero per-frame allocation**, no GC hitches). `emit(x, y, opts)` reuses a dead slot or **drops** the spawn when the pool is full (returns `null`); `update()` advances physics (`vy += gravity; x += vx; y += vy`) and decays `life`; `clear()` resets on level restart; `bounceOffset(tx, ty)` returns the block-bounce draw-Y offset; `draw(ctx, camX)` renders alive particles with `alpha = life / max` (free fade-out). `ctx` is injected (DI, mirroring the parallax pattern) so the headless harness gets a stub. Per-kind renderers: `coin` (rising + spinning + fading), `shard` (4×4 brick debris), `text` (floating score popup), `dot`/`dust`/`poof` (soft squares), and `bounce` (not drawn — queried via `bounceOffset`).
* **Folded in the old ad-hoc arrays:** `game.js`'s three separate arrays/loops (`coinPops`, `shards`, `bounces`) are gone. Coin → a `coin` particle **plus a floating `+200` `text` popup**; shards → brick-break debris; block bounce → `bounceOffset()` drives the tile draw-Y (the old `bounceOff()` sine math, `-Math.round(6·sin(π·age/10))`, is preserved exactly and covered by the harness).
* **New juice (the point of the phase):** **skid dust** (emitted at the trailing feet while `playerAnim.state === 'skid'`, throttled to every other frame), **landing dust** (burst count ∝ fall speed when the player transitions air → ground, with a small shake on hard landings), **item poof** (radial spark burst on mushroom spawn), and a decaying **screen shake** (`shakeMag`, ×0.85/frame, applied as a sub-pixel camera `translate` in `render()`; the HUD is drawn after `ctx.restore()` so it stays stable). Shake also triggers on brick break + stomp.
* **Integration in `game.js`:** `const particles = new ParticleSystem(128)` at module top; `particles.update()` in `update()` (replacing the three array loops); `particles.draw(ctx, camX)` in `render()` after `drawCoins()`; `particles.clear()` in `loadLevel()`; `particles` + `shakeMag` exposed via `__internals`.
* **20 new harness checks** validate: pool bounds (capacity, fill, overflow-drops-returns-null, never-grows), the `alpha = life/max` fade math, the preserved block-bounce sine math (ages 0..10 + expiry + unrelated tile), `emit`/`update`/`draw` no-throw across all kinds under the stub ctx, and live game wiring (pool exposed, capacity 128, landing actually emits into the pool, and the pool drains). All **153** checks pass; grid-diff still reports GRID 1:1 OK.

### Phase 7 kickoff — SMW Polish & Power-Ups (NEXT)
Full spec: `ROADMAP_SNES_UPGRADE.md` §"Phase 7". This is the final (stretch) phase and a **bundle of smaller features** — deliver **incrementally** (one feature → harness checks → both gates green → commit → next) in this priority order:

1. **7a — High-score persistence (easiest, do first).** `score` is module-level (`addScore`, `game.js` ~line 267). Add a `highScore` loaded from `localStorage` at boot, written when beaten (gameover / flag). **Gotcha:** the harness stub (`test/browser-stub.mjs`) has **no `localStorage`** — either add a tiny in-memory one to the stub, or feature-detect in the game (`typeof localStorage !== 'undefined'` + try/catch) so it's a safe headless no-op. Draw it in the HUD.
2. **7b — Fire Flower + fireballs (headline).** New power tier `small → big → fire` (damage: fire → big → small). `player.big` is currently a **boolean** (`collectMush` ~407, `damagePlayer` ~414) — refactor to `player.power` ∈ {`small`,`big`,`fire`} and update every reference (collect / damage / `handleBump` / `drawPlayer`). Add tile char `'F'` to `handleBump` (~292) next to `'M'` (mushroom). Reuse the mushroom spawn/update/draw pattern (~275-283, 396-409) for a `fireflowers` item. New `assets/sprites/fireflower.png` via `tools/gen-sprites.mjs` (see `genMushroom`) + a `SpriteSheet` (`game.js` ~81-83). **Fireballs:** a `fireballs` array; on a new fire key (extend `engine/input.js` with a `firePressed` edge like `jumpPressed`, ~33-41, e.g. `KeyZ`/`KeyJ`), spawn a fireball at the feet moving in `player.facing`, small gravity, bounces off walls + ground a few times, then pops. A fireball that `aabb`s a live enemy kills it (squish + score) and pops on solid blocks.
3. **7c — Koopa Troopa + shell (+ optional flyer).** New enemy `type` (the enemy map is `game.js` ~156; add a `type` field). Walks like a goomba (`updateEnemies` ~383-393). Stomp → **shell** (stops, `e.shell = true`); touching a shell while moving **kicks** it (launches in player facing, high vx); a moving shell kills other enemies; re-stomp stops it. New `assets/sprites/koopa.png` (2×1: koopa + shell) via gen-sprites; branch in `drawEnemies` (~612). Optional **flyer**: hovers on a sine wave (no gravity).
4. **7d — World map + 512-wide (optional stretch).** Link multiple `levels/*.json` via a map/select screen (the loader `engine/level.js` already takes a path; add a second level JSON; on flag, advance to the next). 512-wide: bump `VIEW_W` in `constants.js` and re-verify parallax + grid-diff.

**Level authoring (grid-diff gotcha):** `js/level.js` `buildLevel()` is the **source of truth** for the tile grid; `assets/levels/w1-1.json` is generated from it by `tools/generate-w1-1.mjs`, and `tools/grid-diff.mjs` proves they match. So to place a new **tile** (e.g. an `'F'` fire block), edit `buildLevel()` and re-run `node tools/generate-w1-1.mjs` — never hand-edit the JSON collision layer or grid-diff breaks. New **entities** (e.g. Koopa spawns) only live in the JSON `entities` array (grid-diff ignores entities), so those can be added straight into `w1-1.json`.

**Acceptance (whole phase):** all **153** existing checks still pass **plus** new checks per sub-feature; `node tools/grid-diff.mjs` still GRID 1:1 OK; in a browser (`python3 -m http.server 8000`): fire flower → fireballs shoot/bounce/kill, Koopa → shell → kick, and the high score survives a reload. Commit per sub-feature (`Phase 7a: ...`, `Phase 7b: ...`, ...).

**Open decisions — RESOLVED in Phase 0:**
1. Module system → **ES modules** (native `<script type="module">`, no build step).
2. Logical resolution → **256×240** (kept; zero disruption, matches current CSS scaling).
3. Art → **keep the procedural canvas pixel-art as placeholder** (Phase 4 swaps in PNG sprite sheets).

> Music: track **C (Cloud Drift)** is the in-game default. Integration is **done** (see §6 — start on `Enter`/title, pause `P`, mute `M`; compare A/B/C in `music_options.html`).

---

## 4. How the music engine works (`js/chiptune.js`)

ES module exporting `Chiptune = { start(track), stop(), tracks, ensure(), setVolume(v) }`. **No dependencies**; uses `globalThis` so it also runs headless (the `test/` harness loads it without a browser).

**Soundfont (NES-style):**
- `pulse1` → **lead** (square, vol 0.16)
- `pulse2` → **arp** (square, vol 0.085)
- **bass** (triangle, vol 0.30)
- **drums** (noise: `s`=snare, `h`=hat; `k`=kick via triangle slide 150→48 Hz)
- All voices run through a **low-pass filter (~14 kHz)** + master gain 0.5 for a soft 8-bit timbre.

**Note format** (in the track data — `<dur> <note>` tokens, duration comes *first*):
- Durations: `w`=16, `h`=8, `q`=4, `e`=2 sixteenth-steps.
- Notes: `A`–`G` + optional `#`/`b` + octave digit, e.g. `q E4`, `h C5`, `e B#4`.
- Each of `lead`/`arp`/`bass` is a **32-step phrase = 4 bars**. `drum` is **32 chars = 2 bars × 16 sixteenths** (looped as needed).

**Sequencer:** lookahead scheduler (`setInterval` tick every 100 ms, schedules ~0.3 s ahead). One 32-step unit = one loop iteration; loops seamlessly. `start()` tears down the previous track and quickly fades the master to avoid audio tails.

---

## 5. Known bugs in the game (pre-existing, not music-related)

**Both fixed in Phase 0** (verified by `test/harness.mjs`):

| # | Bug | Fix (Phase 0) |
|---|---|---|
| 1 | **Enemy stomp collision fails** — late-registered stomps fell through / dealt damage | `checkEnemies()` now registers the stomp from the player's **previous-frame feet line** (`prevBottom <= enemy.top + STOMP_TOL`) while falling, instead of a shallow current-frame overlap. Side hits still deal damage. |
| 2 | **Camera leaves player behind** while running — no smoothing/look-ahead | `updateCamera()` now uses `engine/camera.js`: smooth, bounded follow (≤ `CAM_MAX_STEP` px/frame) + look-ahead, plus a **hard safety clamp** that guarantees the player is always on screen. |

Original descriptions (for reference):
1. Stomp branch required `vy > 0` + a shallow current-frame overlap.
2. `updateCamera()` was a hard snap to `player.x - VIEW_W * 0.35`.

---

## 6. Music integration (✅ done in Phase 0)

Music is **wired in and working**: `js/game.js` wraps `Chiptune` in a `Music` IIFE and drives it from the state machine. **Default track `C` (Cloud Drift)** — starts on `Enter`/title, pause with `P`, mute with `M` (`Music.toggleMute`), stops on death/game-over/win. `Chiptune.setVolume(v)` was added, and the music master is held at **0.35** (below SFX) so jump/coin/stomp blips stay audible. Compare A/B/C standalone in `music_options.html`.

The "plan" below was executed in Phase 0. ⚠️ The **line numbers it cites are now stale** (the file was restructured into ES modules) — refer to the `Music`, `SFX`, and `input.onKey` sections of `js/game.js` directly.

- **Game states** (the `state` variable):
  - `'title'` — set at boot, `js/game.js:393`
  - `'playing'` — `startGame()`, `js/game.js:74`
  - `'dying'` — `killPlayer()`, `js/game.js:195`
  - `'gameover'` — `js/game.js:198`
  - `'win'` — `js/game.js:220`
- **Pause**: `paused` flag (`js/game.js:49`), toggled by `KeyP` (`js/game.js:58`). `update()` already early-returns when paused (`js/game.js:224`).
- **Enter** handler (`js/game.js:57`) already calls `SFX.ensure()` — the natural place to unlock the audio context on first user gesture.
- **SFX module** lives at `js/game.js:20–43` (own `AudioContext` + `ensure()` pattern) — model the `Music` wrapper on it.

### Recommended approach
1. **Load the script** in `index.html` — add `<script src="js/chiptune.js"></script>` **before** `<script src="js/game.js"></script>` (mirrors `music_options.html`).
2. **Add a tiny `Music` wrapper** in `js/game.js` (mirror the `SFX` IIFE) that calls `global.Chiptune`, with its **own lower volume** so it doesn't fight SFX (note below).
3. **State wiring** — drive music from the state machine:
   - `title` → start (loop the chosen track) so the user hears it immediately.
   - `playing` → keep playing.
   - `dying` → stop (let the death SFX play).
   - `gameover` / `win` → stop (optional: soft title loop after).
4. **Pause** (`KeyP`) → `Music.stop()` / `Music.start()` (or suspend/resume the context).
5. **Mute toggle** — add a **`M` key** in the `keydown` handler to mute/unmute without stopping.
6. **Guarantee audio unlock**: call `global.Chiptune.ensure()` in the `Enter` handler (`js/game.js:57`) and/or on the first `title` render — browsers need a user gesture before audio plays.

### Audio-coexistence note (important)
`SFX` and `Chiptune` each create their **own `AudioContext`** — fine in modern browsers, but to keep the music from drowning out jump/coin/stomp blips:
- Keep the **music master gain low** (engine default is `0.5`; consider a `setVolume` on `Chiptune` set to ~0.35 in-game), **or**
- Route both through a **single shared `AudioContext`** for full control (least invasive path = own contexts + lower music gain).

### Suggested `Chiptune` enhancement (optional, small)
Add `setVolume(v)` (clamp 0..1 → `master.gain.value`) and/or `pause()`/`resume()` (suspend/resume the context) to the API — makes pause + mute trivial. `stop()` currently just fades the master; a real suspend is cleaner for pause.

---

## 7. Immediate next steps (in order)
1. [x] **Confirm the 3 open decisions** — chose: **ES modules**, **256×240** (no disruption), **keep existing canvas pixel-art as placeholder art** (Phase 4 swaps in PNG sheets).
2. [x] **Phase 0** — split `game.js` into `js/engine/` modules, centralised constants in `engine/constants.js`, **fixed both §5 bugs**, added the headless `test/harness.mjs`.
3. [x] **Phase 1** — add the JSON level format + `level.js` loader + `tilemap.js`; migrate 1-1 to `assets/levels/w1-1.json` (1:1 behaviour, verified by grid-diff + harness). ✅ done (commits `4578a46`, `b099b59`, `7a8a3de`).
4. [x] **Phase 2** — decorative autotiling: `bakeAutotile` + `ATLAS` in `tilemap.js`, `#`/`=` ground renders as organic terrain (grass cap / dirt / lit+dark cliff edges / rounded corners); render-only, collision unchanged (9 new harness checks + grid-diff still 1:1). ✅ done (commits `9bc477d`, `76c7542`, `52231d5`).
5. [x] **Phase 3** — slope / one-way physics core (per-tile height field + semi-solids). ✅ done — 45° `/` `\` slopes with step-up + slide, `-` one-way platforms with drop-through, 22 new harness checks, test level `w1-1-slopes.json`.
6. [x] **Phase 4** — sprite sheets + animation controller. ✅ done — `spritesheet.js` (PNG loader + frame slicer), `animation.js` (state machine: idle/run/run_fast/skid/jump/fall/land), real-art PNGs (placeholders resolved), integrated into `game.js` (ASCII fallback removed), 45 new harness checks (115 total). Commits `d5a6d5d`, `d149c35`, `d4e543f`.
7. [x] **Phase 5** — parallax scrolling. ✅ done — `engine/parallax.js` (pure `layerOffset` + `ParallaxLayer` + `createParallax`), 5-layer placeholder stack (sky 0 → mountains 0.15 → clouds 0.3 → hills 0.4 → trees 0.7), procedural seamless silhouettes, `drawBackground()` blits the stack before the tiles, 18 new harness checks (133 total).
8. [x] **Phase 6** — VFX / "Game Juice". ✅ done — `engine/particles.js` (pooled `ParticleSystem`: fixed pool + free-list reuse, zero per-frame allocation; `emit`/`update`/`clear`/`bounceOffset`/`draw(ctx,camX)`), folded in the old coinPops/shards/bounces (coin → rising+spin+fade **+ `+200` popup**, shards → brick debris, block bounce → `bounceOffset` tile draw-Y), new juice (skid dust, landing dust ∝ fall speed, item poof, decaying screen shake), 20 new harness checks (153 total); grid-diff still 1:1.
9. [x] **Phase 7a** — high-score persistence via `localStorage`. ✅ done — `loadHighScore`/`saveHighScore` in `game.js` (feature-detected for headless), tracks best score across lives, 5 new harness checks (158 total).
10. [x] **Phase 7b** — Fire Flower + fireballs. ✅ done — `F` tile char + fireflower block at (46,8) in level JSON, fireflower entity (emerge → collect → fire power; small→fire also grows to h=28), fireball spawn (Z key, fire power only, max 1 active), fireball physics (gravity, ground bounce ×3, wall bounce, off-screen cull), fireball kills enemies on contact (100 pts + squish), side damage degrades fire→big (not straight to small). 15 new harness checks (173 total). Fixed `levelData` leak: `startGame` now restores `bootLevelData` to prevent cross-phase test corruption.
11. [ ] **Phase 7c** — Koopa Troopa (stomp → shell → kick) + optional flyer, reusing the slope physics.
12. [ ] **Phase 7d** *(optional stretch)* — world map linking multiple `levels/*.json` + 512-wide mode.
13. [ ] Validate each phase with the **headless harness** (`node test/harness.mjs`) **and** in a browser (`python3 -m http.server 8000`).
14. [ ] Music track choice (A/B/C) + integration — low priority until the engine core is in place (see §4–§6).
15. [ ] Commit incrementally after each phase lands.

---

## 8. Roadmap

The full upgrade plan now lives in **`ROADMAP_SNES_UPGRADE.md`** (Phase 0–7: foundations, data-driven tilemaps, autotiling, slope/one-way physics, sprite sheets + animation, parallax, VFX, SMW polish). The items below are the original long-tail ideas, now folded into Phase 7:
- More enemy types (Koopa Troopa, flyers) + a second power-up (fire).
- More levels / a world map, moving platforms, 1-2-style interiors.
- A proper pixel font for the HUD + a chiptune music loop.
- High-score persistence via `localStorage`.

---

## 9. Environment / gotchas
- **Dev container is VS Code Linux**; `python3` is available and **Node 22 (arm64) is now installed** (`node`/`npm` via `apt-get`), so you can `node --check` files and run the headless harness (`node test/harness.mjs`). Node is only for dev/validation — the game still runs in a browser with no build step.
- **Web fetch is available** (the `fetch_web_content` tool) — **use it proactively for creative and design challenges** (sprite art style, animation timing, parallax layer composition, particle effects, SMW aesthetics, etc.). It's your design reference library. **What works:** direct URLs (Wikipedia, documentation sites, game-dev blogs, Nintendo/SNES technical docs, Tuts+ tutorials, GDC talk pages). **What doesn't:** Google/Bing SERPs (JS-rendered, returns a redirect stub). If you need to "search", pick a likely direct URL and fetch that. Good sources for **Phase 5 (parallax)**: `https://en.wikipedia.org/wiki/Parallax_scrolling`, `https://gamedevelopment.tutsplus.com/tutorials/how-to-create-a-parallax-scrolling-background--gamedev-9809`, NES/SNES background layer mode docs. For **Phase 6 (VFX)**: particle system design articles, Johannes Vögele's "Game Feel" concepts, game juice references. For **Phase 7 (polish)**: SMW art style references, power-up animation timing.
- The workspace path **contains a space** — always quote it in shell: `"/workspaces/Cline Mario World Test"`.
- Browser autoplay: WebAudio won't start until a user gesture — that's why we tie `ensure()` to the Enter/title interaction (§6).
- `~$rio_Project_Summary.docx` is a Word lock file (appears when the `.docx` is open); safe to remove. `.DS_Store` is macOS noise.

