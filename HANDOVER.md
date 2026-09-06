# Project Handover — Super Plumber Bros.

> **Read this first if you're picking up the session fresh.**
> Last updated: 2026-09-06. Branch: `master`. **Phases 0, 1, 2, and 3 of the SNES upgrade are complete and committed.**
> Phase 0: ES-module refactor + both §5 bugs fixed + headless Node test harness. Phase 1: 3-layer JSON level
> format + loader + tilemap query API, World 1-1 migrated to `assets/levels/w1-1.json`, and the game switched
> to the JSON path (verified 1:1 by grid-diff + harness). Phase 2: decorative autotiling — `#`/`=` ground now
> renders as organic terrain (grass cap, dirt body, lit/dark cliff edges, rounded corners) via a Moore-neighbour
> mask baked once at load (render-only; collision untouched). Phase 3: per-tile slope physics (45° `/` `\` with
> step-up + downhill slide) and one-way platforms (`-` with drop-through) — collision rewritten as a height-field
> in `game.js`, 22 new harness checks, test level `w1-1-slopes.json`. Node 22 is now installed.
> The one thing we're working on right now: **executing the SNES engine upgrade — see `ROADMAP_SNES_UPGRADE.md` (next: Phase 4 — sprite sheets + animation controller).**

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
| `P` | Pause |
| `Enter` | Start / restart |

---

## 2. File map

| File | What it is | Status |
|---|---|---|
| `index.html` | Canvas + control hints + **script order** | ✅ done (tracked) |
| `style.css` | Layout + pixelated scaling | ✅ done (tracked) |
| `js/sprites.js` (144 ln) | Pixel-art sprite data → offscreen canvases | ✅ done (tracked) |
| `js/level.js` (85 ln) | World 1-1 as feature placements — **now only the source for the Phase 1 generator + harness baseline**; the running game no longer imports it | ✅ legacy (Phase 1) |
| `js/game.js` | **Entry module** — physics, collision, entities, HUD, **SFX**; imports `engine/`; **loads the level from `assets/levels/w1-1.json`**; **renders autotiled ground**; **height-field collision (Phase 3)** | ✅ Phase 0 + **Phase 1** + **Phase 2** + **Phase 3** |
| `js/engine/constants.js` | **NEW** all tunables (view/physics/camera/**collision**) in one place | ✅ Phase 0 + **Phase 3** |
| `js/engine/input.js` | **NEW** keyboard state + jump edge detection | ✅ Phase 0 |
| `js/engine/loop.js` | **NEW** fixed 60fps timestep | ✅ Phase 0 |
| `js/engine/camera.js` | **NEW** smooth look-ahead follow + safety clamp | ✅ Phase 0 (bug #2) |
| `js/engine/level.js` | **NEW** 3-layer JSON parser (`parseLevel`) + injectable transport (`setLevelTransport`) + `loadLevelData` | ✅ Phase 1 |
| `js/engine/tilemap.js` | **NEW** `createTilemap` — typed-array collision grid with `tileAt`/`solidAt`/`isGround`/`set`/`rows` + **`bakeAutotile` + `ATLAS` (Phase 2)** + **`slope`/`isOneWay`/`surfaceYAt` (Phase 3)** | ✅ Phase 1 + Phase 2 + **Phase 3** |
| `js/chiptune.js` (284 ln) | NES-style sequencer + 3 original tracks (now an ES-module export) | ✅ done |
| `test/harness.mjs` + `test/browser-stub.mjs` | **NEW** headless Node behaviour tests + browser stubs (**70 checks**, incl. Phase 1 loader/tilemap + Phase 2 autotile + Phase 3 slope/one-way) | ✅ Phase 0 + Phase 1 + Phase 2 + Phase 3 |
| `package.json` | **NEW** `{"type":"module"}` + `npm test` (no deps/build) | ✅ Phase 0 |
| `assets/levels/README.md` | **NEW** 3-layer JSON level format spec (background/collision/foreground) | ✅ Phase 1 |
| `assets/levels/w1-1.json` | **NEW** World 1-1 as JSON (migrated 1:1 from `buildLevel`) | ✅ Phase 1 |
| `assets/levels/w1-1-slopes.json` | **NEW** test level with `/` `\` slopes + `-` one-way platforms (Phase 3 physics) | ✅ Phase 3 |
| `tools/generate-w1-1.mjs` | **NEW** dev tool: regenerate `w1-1.json` from `buildLevel()` | ✅ Phase 1 |
| `tools/grid-diff.mjs` | **NEW** dev tool: assert the JSON-derived grid == `buildLevel()` grid (byte-identical) | ✅ Phase 1 |
| `tools/browser-smoke.mjs` | **NEW** dev tool: force the browser fetch branch, boot the game, verify the player moves | ✅ Phase 1 |
| `music_options.html` (138 ln) | **NEW** standalone page to listen to & pick a track | ✅ done (untracked) |
| `ROADMAP_SNES_UPGRADE.md` | **NEW** full SNES‑engine upgrade roadmap (Phase 0–7) | 📋 plan — see §3 |
| `README.md` | Project overview / run instructions | ✅ done |
| `generate_mario_summary.py` | Python (`python-docx`) status-doc generator | ✅ done (untracked) |
| `Mario_Project_Summary.docx` | Generated status doc (v0 + 2 bugs) | ⚠️ generated artifact |
| `test.py` | Dev-container smoke test | ✅ done |
| `.DS_Store`, `~$rio_Project_Summary.docx` | macOS + Word temp junk | 🗑️ safe to delete |

> **Git:** Phase 0 is committed (`d633189`), Phase 1 in three commits (`4578a46` format+loader+tilemap, `b099b59` w1-1.json migration, `7a8a3de` game switched to the JSON path), Phase 2 in four commits (`9bc477d` autotile core, `76c7542` harness checks, `52231d5` autotile render, + this docs commit), and Phase 3 in two commits (`Phase 3 (1/4): slope height-field collision + one-way platforms` + `Phase 3 (2/4): test level + harness tests + docs`). `music_options.html`, `generate_mario_summary.py`, and `Mario_Project_Summary.docx` remain **untracked** (music-preview page + status-doc tooling — not part of the game).

---

## 3. The current task — SNES Engine Upgrade (where we left off)

The focus is a **major engine upgrade**: bringing *Super Plumber Bros.* up to a **16-bit SNES / Super Mario World** standard. A complete, phased plan is in **`ROADMAP_SNES_UPGRADE.md`** (Phase 0–7).

**Status: Phases 0, 1, 2, and 3 are complete and committed.** The codebase is pure **ES modules** (no build step), with `game.js` split into `js/engine/` (constants / input / loop / camera / **level** / **tilemap**), both §5 bugs fixed, and a **headless Node test harness** (`test/harness.mjs`, **70 checks**) that runs the real game module and validates behaviour. Phase 1 added the **3-layer JSON level format** + loader + tilemap query API, migrated World 1-1 to `assets/levels/w1-1.json`, and switched the running game to load from JSON (verified 1:1 by `tools/grid-diff.mjs` + the harness). **Phase 2 (decorative autotiling)** added `bakeAutotile` + `ATLAS` to `tilemap.js` and made `#`/`=` ground render as organic terrain — a **render-only** change verified by 9 new harness checks, with `tools/grid-diff.mjs` still reporting GRID 1:1 OK. **Phase 3 (slope physics & semi-solids)** rewrote the collision in `game.js` as a per-tile height-field: 45° `/` `\` slopes with step-up (≤ 8px auto-climb) + downhill slide, and `-` one-way platforms with drop-through (Down+Jump). Verified by 22 new harness checks (tilemap unit + integration) and a dedicated test level `w1-1-slopes.json`. **Phase 4 (sprite sheets + animation controller) is next.**

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

### Phase 4 kickoff — sprite sheets + animation controller
Full spec: `ROADMAP_SNES_UPGRADE.md` §"Phase 4". Concrete starting points for this codebase:
1. **New module** — `js/engine/spritesheet.js`: PNG loader (`new Image()` + onload), frame slicing from a grid (cols×rows), and a `draw(ctx, frame, x, y, w, h, flip)` method. Keep `imageSmoothingEnabled = false`.
2. **New module** — `js/engine/animation.js`: state-based frame controller. API: `setAnim(name)`, `tick()`, `currentFrame()`, `isFlipped()`. States: `idle`, `run`, `jump`, `skid`, `die`. Frame durations in frames (not seconds) to match the 60fps timestep.
3. **Placeholder PNGs** — generate simple colored-rectangle sprite sheets in code (or as small base64 data URIs) so the engine works before final art is supplied. Store in `assets/sprites/`.
4. **Replace `js/sprites.js`** — the current ASCII pixel-art data will be superseded. Keep the file until the PNG path is verified, then delete.
5. **Integration in `game.js`** — replace the `drawMario`/`drawGoomba`/etc. calls with `sheet.draw(...)` + `anim.currentFrame()`. The animation state is derived from existing player state (`player.vx`, `player.vy`, `player.onGround`, `player.skid`).
6. **Acceptance** — all existing harness tests still pass (70 checks), grid-diff still 1:1, and the game renders with the new sprite path in a browser. Add a harness check that the spritesheet module loads and slices correctly (headless: mock `Image` or just validate the slicing math).


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
6. [ ] **Phase 4–6** (any order) — sprite sheets + animation controller, parallax, VFX.
7. [ ] Validate each phase with the **headless harness** (`node test/harness.mjs`) **and** in a browser (`python3 -m http.server 8000`).
8. [ ] Music track choice (A/B/C) + integration — low priority until the engine core is in place (see §4–§6).
9. [ ] Commit incrementally after each phase lands.

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
- The workspace path **contains a space** — always quote it in shell: `"/workspaces/Cline Mario World Test"`.
- Browser autoplay: WebAudio won't start until a user gesture — that's why we tie `ensure()` to the Enter/title interaction (§6).
- `~$rio_Project_Summary.docx` is a Word lock file (appears when the `.docx` is open); safe to remove. `.DS_Store` is macOS noise.

