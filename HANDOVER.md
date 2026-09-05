# Project Handover — Super Plumber Bros.

> **Read this first if you're picking up the session fresh.**
> Last updated: 2026-09-05. Branch: `master` (single commit: `cfacfda` — v0 scaffold).
> The one thing we're working on right now: **executing the SNES engine upgrade — see `ROADMAP_SNES_UPGRADE.md`.**

---

## 1. What this project is

A **Super-Mario-Bros.-style (NES-era) platformer** written from scratch in **pure HTML / CSS / Canvas / JavaScript**. No libraries, no build step, no npm. One fully playable level (**World 1-1**).

- Open `index.html` in any modern browser and it just runs. (Optionally: `python3 -m http.server 8000`.)
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
| `js/level.js` (85 ln) | Level 1-1 as feature placements | ✅ done (tracked) |
| `js/game.js` (398 ln) | Physics, collision, entities, camera, HUD, loop, **SFX** | ✅ done (tracked) — **2 known bugs, see §5** |
| `js/chiptune.js` (284 ln) | **NEW** NES-style sequencer + 3 original tracks + `window.Chiptune` API | ✅ done (untracked) |
| `music_options.html` (138 ln) | **NEW** standalone page to listen to & pick a track | ✅ done (untracked) |
| `ROADMAP_SNES_UPGRADE.md` | **NEW** full SNES‑engine upgrade roadmap (Phase 0–7) | 📋 plan — see §3 |
| `README.md` | Project overview / run instructions | ✅ done |
| `generate_mario_summary.py` | Python (`python-docx`) status-doc generator | ✅ done (untracked) |
| `Mario_Project_Summary.docx` | Generated status doc (v0 + 2 bugs) | ⚠️ generated artifact |
| `test.py` | Dev-container smoke test | ✅ done |
| `.DS_Store`, `~$rio_Project_Summary.docx` | macOS + Word temp junk | 🗑️ safe to delete |

> Only the initial v0 scaffold is committed. The two music files (`js/chiptune.js`, `music_options.html`) are **new and untracked** — commit them once the track is picked.

---

## 3. The current task — SNES Engine Upgrade (where we left off)

The focus has moved from music to a **major engine upgrade**: bringing *Super Plumber Bros.* up to a **16-bit SNES / Super Mario World** standard. A complete, phased plan is now in **`ROADMAP_SNES_UPGRADE.md`** (Phase 0–7). No game code has been changed yet — it is plan-only so far.

**Scope of the roadmap:**
- **Engine & physics** — data-driven multi-layer JSON tilemaps (`background`/`collision`/`foreground`), decorative autotiling (grass/dirt/corners), and a new **slope + one-way-platform physics** core (45° & 22.5° slopes via a per-tile height field).
- **Asset pipeline** — PNG sprite-sheet atlas loader + a state-based animation controller (idle/run/skid/jump/fall by velocity + ground state + power-up).
- **Rendering & juice** — data-driven multi-layer **parallax** scrolling (sky → mountains → hills → foreground-over-player) and a pooled **VFX** system (skid/land dust, coin-pop + score float, block-bounce sine displacement).

**First things to confirm with the user (before any code):**
1. Module system — ES modules (recommended) vs keep IIFEs.
2. Logical resolution — 256×240 (recommended) vs 512×240 wide.
3. Art — generate placeholder PNG sheets now vs wait for user-supplied art.

> **Minor still-pending item:** the chiptune **track choice (A/B/C)** from §4 is no longer the active task but is a quick follow-up whenever music integration is wanted. Details remain in §4–§6.

---

## 4. How the music engine works (`js/chiptune.js`)

Self-contained IIFE exposing `window.Chiptune = { start(track), stop(), tracks, ensure() }`. **No dependencies**, only `window` (so it can also run headless). Built to drop straight into the game.

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

Tracked in `Mario_Project_Summary.docx`. Neither is fixed yet.

| # | Bug | Where | Severity |
|---|---|---|---|
| 1 | **Enemy stomp collision fails** — landing on a Goomba often deals damage instead of a stomp (stomp branch requires `vy > 0` + shallow overlap; late-registered stomps fall through) | `js/game.js` player-vs-enemy overlap (~line 156) | High |
| 2 | **Camera leaves player behind** while running — no smoothing/look-ahead | `js/game.js` `updateCamera()` (~line 202) | Medium |

Suggested fixes:
1. Register the stomp from the player's **previous-frame position** relative to the enemy's top edge, rather than requiring a shallow current-frame overlap.
2. Add clamped look-ahead or smoothing to `camX` in `updateCamera()` so the player stays in view while running.

---

## 6. Integration plan — wiring the chosen track into the game

`js/chiptune.js` already exposes a ready API. Integration is a small, contained edit to `js/game.js`. **Exact hook points** (line numbers from the current file):

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
1. [ ] **Confirm the 3 open decisions** in `ROADMAP_SNES_UPGRADE.md` (module system, resolution, art source).
2. [ ] **Phase 0** — split `game.js` into `engine/` modules, centralise constants, and **fix the 2 known bugs from §5** (stomp + camera) so physics work is built on a clean base.
3. [ ] **Phase 1** — add the JSON level format + `level.js` loader + `tilemap.js`; migrate 1-1 to `assets/levels/w1-1.json` (1:1 behaviour).
4. [ ] **Phase 2 → 3** — autotiling, then the slope / one-way physics core.
5. [ ] **Phase 4–6** (any order) — sprite sheets + animation controller, parallax, VFX.
6. [ ] Validate **each phase in a browser** (`python3 -m http.server 8000`); the dev-container has no node.
7. [ ] Music track choice (A/B/C) + integration — low priority until the engine core is in place (see §4–§6).
8. [ ] Commit incrementally after each phase lands.

---

## 8. Roadmap

The full upgrade plan now lives in **`ROADMAP_SNES_UPGRADE.md`** (Phase 0–7: foundations, data-driven tilemaps, autotiling, slope/one-way physics, sprite sheets + animation, parallax, VFX, SMW polish). The items below are the original long-tail ideas, now folded into Phase 7:
- More enemy types (Koopa Troopa, flyers) + a second power-up (fire).
- More levels / a world map, moving platforms, 1-2-style interiors.
- A proper pixel font for the HUD + a chiptune music loop.
- High-score persistence via `localStorage`.

---

## 9. Environment / gotchas
- **Dev container is VS Code Linux**; `python3` is available, but there is **no JS runtime** (`node`/`deno`/`bun` not installed) — you can't `node --check` JS here; validate by loading it in a browser.
- The workspace path **contains a space** — always quote it in shell: `"/workspaces/Cline Mario World Test"`.
- Browser autoplay: WebAudio won't start until a user gesture — that's why we tie `ensure()` to the Enter/title interaction (§6).
- `~$rio_Project_Summary.docx` is a Word lock file (appears when the `.docx` is open); safe to remove. `.DS_Store` is macOS noise.

