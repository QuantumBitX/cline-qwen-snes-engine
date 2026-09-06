# Level format — 3-layer JSON tilemaps (Phase 1)

Levels are data, not code. Each level is one JSON file in this directory
(e.g. `w1-1.json`). The game loads it through `js/engine/level.js`
(`parseLevel` → typed arrays), and queries it through `js/engine/tilemap.js`.

A level is a **three-layer tilemap** plus a **pixel-anchored entity list**.
Each layer is an array of equal-length strings; **one character = one tile**,
resolved through the shared legend below. Row 0 is the top, the last row is
the floor.

```jsonc
{
  "id": "w1-1",
  "tileSize": 16,
  "width": 176,               // tiles wide
  "height": 15,               // tiles tall
  "camera": { "mode": "follow", "lead": 0.40 },
  "spawn":  { "x": 32, "y": 194 },          // player start (pixels)
  "parallax": [],                                  // bg image list (Phase 5)

  "layers": {
    "background": [ "…", "…" ],   // decorative, NO collision (optional)
    "collision":  [ "…", "…" ],   // the gameplay surface (required)
    "foreground": [ "…", "…" ]    // drawn OVER the player (optional)
  },

  "entities": [
    { "type": "coin",   "x": 322, "y": 98 },
    { "type": "goomba", "x": 352, "y": 194, "speed": 0.5 },
    { "type": "flag",   "x": 2600, "baseRow": 13, "topRow": 5 }
  ]
}
```

## Top-level fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | level identifier |
| `tileSize` | number | pixels per tile (16) |
| `width` / `height` | number | level size in tiles |
| `camera` | object | `{ mode, lead }` — metadata for the follow camera |
| `spawn` | object | `{ x, y }` player start in pixels |
| `parallax` | string[] | background image paths (Phase 5; empty for now) |
| `layers` | object | the three tile layers (see below) |
| `entities` | object[] | pixel-anchored entities (see below) |

## Layers

| Layer | Collision | Purpose |
|---|---|---|
| `background` | none | decorative, drawn behind (superseded by `parallax` images in Phase 5) |
| `collision` | **yes** | the gameplay surface — required, `height` rows |
| `foreground` | none | drawn **over** the player (Phase 5) |

`background` and `foreground` are optional and absent for 1-1 (the current
procedural clouds/hills stay in `game.js` until Phase 5 swaps in parallax
images). Only `collision` is required.

## Collision legend — one char → tile

| Char | Meaning | Collision |
|---|---|---|
| `.` / ` ` | empty | none |
| `#` | ground | solid |
| `X` | hard block | solid |
| `B` | brick | solid, breakable when big |
| `?` | coin block | solid, bumpable |
| `M` | item (mushroom) block | solid, bumpable |
| `U` | used block | solid |
| `Q` / `W` | pipe cap, left / right | solid |
| `E` / `R` | pipe body, left / right | solid |

Reserved for later phases (ignored by the 1-1 collision rules, kept for the
shared legend): `=` ground filler (Phase 2 autotile), `/` `\` `~` `^` slopes
and `_` one-way platforms (Phase 3 physics), `o` hard-block alias.

## Entities (pixel-anchored)

| `type` | Fields | Resolved to |
|---|---|---|
| `coin` | `x`, `y` | `{ x, y, w:12, h:12 }` — collectible |
| `goomba` | `x`, `y`, `speed?` | `{ x, y, w:14, h:14, vx:-speed }` — walker (speed default 0.5) |
| `flag` | `x`, `baseRow`, `topRow` | `{ col, topRow, baseRow }` — the pole; `col = round((x-8)/tileSize)` |

`x`/`y` are pixels (tile origin `t * tileSize`). The loader resolves each
entity into the exact structure the game consumes, so a level needs no code.

## Loading

- **Browser:** `fetch('assets/levels/w1-1.json')` → `parseLevel`.
- **Node (harness):** read the file from disk → `parseLevel`.

The transport is injected via `setLevelTransport(fn)`; the level is loaded
**once before boot**, so `loadLevel()` stays synchronous and the game loop is
never async. `parseLevel` runs a schema check and throws a clear error on a
malformed map (safe authoring without a linter).