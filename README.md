# Super Plumber Bros.

A Super-Mario-Bros-style platformer, built from scratch with **pure HTML / CSS /
Canvas / JavaScript** — no libraries, no build step, no dependencies.

It ships with **one fully playable level (1-1)**: movement, variable jump,
running, Goombas, ? blocks, coins, a **mushroom** and a **fire flower**
power-up with fireballs, pipes, pits, a staircase and a flagpole.

## Run it

Serve it over local HTTP and open it in a browser. The game is built from
**ES modules**, which most browsers refuse to load from `file://` — a tiny
static server is the only requirement to *play* (still no build step, no npm):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Works in Chrome / Edge / Firefox / Safari.

> **Note:** double-clicking `index.html` (opening it via `file://`) shows a
> blank page — the browser blocks the ES-module script and the level/sprite
> `fetch`/`Image` loads. That's not a bug; always open the `http://localhost`
> address.

## Controls

| Key                 | Action                                     |
| ------------------- | ------------------------------------------ |
| `←` `→` / `A` `D`   | Move left / right                          |
| `Space` / `W` / `↑` | Jump — **hold** for a higher jump, tap for a short hop |
| `Shift` / `X`       | Run (faster)                               |
| `Z` / `J`           | Fire a fireball (only in fire power)       |
| `P`                 | Pause                                      |
| `M`                 | Mute / unmute                              |
| `Enter`             | Start / restart                            |

## Gameplay

- Stomp Goombas (hold jump to bounce higher). Touch one from the side and you
  take a hit.
- **Power-ups:** collect the **mushroom** to grow big; collect the **fire
  flower** to gain fire power. Taking a hit degrades you one tier
  (fire → big → small).
- In fire power, press `Z` / `J` to shoot a **fireball** that bounces along the
  ground and pops Goombas.
- Hit `?` blocks from below for coins; hit bricks from below while big to break
  them.
- 100 coins = 1-UP. Watch the **timer** — if it hits 0, you die.
- Fall in a pit = death. Reach the **flagpole** to clear the course.
- Your best score is saved between sessions (via `localStorage`).

## Project structure

Pure **ES modules** (no build step). `js/game.js` is the single entry point and
imports everything else.

| File                       | Responsibility                                             |
| -------------------------- | ---------------------------------------------------------- |
| `index.html`               | Canvas + control hints + single `<script type="module">`   |
| `style.css`                | Layout + crisp `image-rendering: pixelated` scaling        |
| `js/game.js`               | Physics, collision, entities, HUD, orchestration           |
| `js/sprites.js`            | Pixel-art sprite data → offscreen canvases                 |
| `js/level.js`              | Level 1-1 authoring source (`buildLevel`) — JSON is generated from it |
| `js/chiptune.js`           | WebAudio note engine + track definitions                   |
| `js/engine/constants.js`   | Every tunable (view, physics, camera, fireballs) in one place |
| `js/engine/input.js`       | Keyboard state + jump/fire edge detection                  |
| `js/engine/loop.js`        | Fixed 60fps timestep loop                                  |
| `js/engine/camera.js`      | Smooth follow + look-ahead (bounded, never loses player)   |
| `js/engine/level.js`       | JSON level loader (schema-checked)                         |
| `js/engine/tilemap.js`     | Tile-grid query API + decorative autotiling                |
| `js/engine/spritesheet.js` | PNG atlas loader + frame-grid slicer                       |
| `js/engine/animation.js`   | State-based sprite animation controller                    |
| `js/engine/parallax.js`    | Multi-layer parallax background                            |
| `js/engine/particles.js`   | Pooled particle system (dust, coin, poof) + screen shake   |
| `assets/levels/w1-1.json`  | Level 1-1 data (generated from `js/level.js`)              |
| `assets/sprites/*.png`     | Sprite sheets (player, goomba, mushroom, fireflower)       |

### Level authoring

Level tiles are authored in `js/level.js` (`buildLevel`) — the **source of
truth**. `assets/levels/w1-1.json` is generated from it, so the game always
runs from data:

```bash
node tools/generate-w1-1.mjs   # regenerate the JSON from buildLevel()
node tools/grid-diff.mjs       # prove the JSON grid is byte-identical to buildLevel()
```

- To place a new **tile** (e.g. a fire-flower block `'F'`), edit `buildLevel()`
  and re-run `generate-w1-1.mjs` — never hand-edit the JSON collision layer.
- New **entities** (coin/enemy spawns) live only in the JSON `entities` array
  and can be edited directly.

### Key implementation notes

- **Fixed timestep** (60 fps logic) inside `requestAnimationFrame` — identical
  feel on 60Hz and 144Hz displays.
- **Axis-separated AABB vs. tile-grid collision** (move X, resolve, move Y,
  resolve) — robust, no tunneling.
- **Variable jump** via asymmetric gravity: low gravity while ascending with the
  button held, high gravity the instant you release.
- **Slope height-field + one-way platforms** (drop-through) for classic SMW
  terrain.
- Enemies **activate** when the camera nears them (classic NES behaviour).
- Rendering targets a **256×240** canvas (true NES resolution) scaled up with
  `image-rendering: pixelated`.

## Testing

Headless behaviour tests run the **real game module** under Node with a small
browser stub (no browser required):

```bash
node test/harness.mjs     # or: npm test
```

**173 checks** covering: timing, boot, start, movement, jump, stomp vs.
side-hit discrimination, flag completion, camera follow/bounds, level loader +
tilemap, autotiling, slopes + one-way platforms, spritesheets + animation,
parallax, particles, high-score persistence, and fire flower + fireballs.

### Dev tools (`tools/`)

| Tool                      | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `tools/generate-w1-1.mjs` | Regenerate `assets/levels/w1-1.json` from `buildLevel()`       |
| `tools/grid-diff.mjs`     | Prove the JSON tilemap is byte-identical to `buildLevel()`     |
| `tools/gen-sprites.mjs`   | Generate the placeholder PNG sprite sheets                     |
| `tools/browser-smoke.mjs` | Exercise the browser-only path (stubbed `fetch`/`Image`) with no real browser |

## Roadmap

**Done:** fixed timestep + camera foundations, data-driven tilemaps,
autotiling, slope physics + one-way platforms, sprite sheets + animation,
parallax, particles / game juice, high-score persistence, fire flower +
fireballs.

**Next:**

- **Koopa Troopa** — stomp → shell → kick (+ optional flyer).
- **World map / multiple levels** — link several `levels/*.json` via a select
  screen.
- More enemy types and a proper pixel font for the HUD.
