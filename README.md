# Super Plumber Bros.

A Super-Mario-Bros-style (NES era) platformer, built from scratch with
**pure HTML / CSS / Canvas / JavaScript** — no libraries, no build step.

It ships with **one fully playable level (1-1)**: movement, variable jump,
running, Goombas, ? blocks, coins, a mushroom power-up, pipes, pits, a
staircase and a flagpole.

## Run it

Just open `index.html` in any modern browser (Chrome / Edge / Firefox / Safari).
That's it.

If you prefer a local server (not required):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

| Key                  | Action                          |
| -------------------- | ------------------------------- |
| `←` `→` / `A` `D`    | Move left / right               |
| `Space` / `W` / `↑`  | Jump — **hold** for a higher jump, tap for a short hop |
| `Shift` / `X`        | Run (faster)                    |
| `P`                  | Pause                           |
| `Enter`              | Start / restart                 |

## Gameplay

- Stomp Goombas (hold jump to bounce higher). Touch one from the side and you
  take a hit.
- Small plumber = one hit and you're done. Collect the **mushroom** from the
  marked block to grow big (one hit just shrinks you).
- Hit `?` blocks from below for coins; hit bricks from below — big breaks them.
- 100 coins = 1-UP. Watch the **timer**; if it hits 0, you die.
- Fall in a pit = death. Reach the **flagpole** to clear the course.

## Design / architecture

| File            | Responsibility                                        |
| --------------- | ----------------------------------------------------- |
| `index.html`    | Canvas + control hints + script order                 |
| `style.css`     | Layout + crisp `image-rendering: pixelated` scaling   |
| `js/sprites.js` | Pixel-art sprite data → offscreen canvases            |
| `js/level.js`   | Level 1-1 as clean feature placements                 |
| `js/game.js`    | Physics, collision, entities, camera, HUD, game loop  |

Key implementation notes:

- **Fixed timestep** (60 fps logic) inside `requestAnimationFrame`, so the game
  feels identical on 60Hz and 144Hz displays.
- **Axis-separated AABB vs. tile-grid collision** (move X, resolve, move Y,
  resolve) — robust, no tunneling.
- **Variable jump** via asymmetric gravity: low gravity while ascending with
  the button held, high gravity the instant you release.
- Enemies **activate** when the camera nears them (classic NES behaviour).
- Rendering targets a **256×240** canvas (true NES resolution) and is scaled up
  with `image-rendering: pixelated` for the authentic look.

## Ideas for next

- More enemy types (Koopa Troopa, flying enemies) and a second power-up (fire).
- More levels / a world map, moving platforms, and level-1-2 style interiors.
- A proper pixel font for the HUD and a chiptune music loop.
- High-score persistence via `localStorage`.
