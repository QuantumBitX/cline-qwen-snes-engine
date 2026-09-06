// ============================================================
//  generate-w1-1.mjs — dev tool: regenerate assets/levels/w1-1.json
//
//  Derives the Phase 1 JSON level from the legacy hardcoded level
//  (js/level.js buildLevel()) so the migration is exact by construction.
//  Run:  node tools/generate-w1-1.mjs
//
//  It is also the source of the 1:1 proof: the collision layer is the
//  final buildLevel() grid (coins already cleared to '.'), and the
//  entities are the exact coins / goombas / flag it produces.
// ============================================================
import { buildLevel } from '../js/level.js';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TILE = 16;
const L = buildLevel();

// collision layer = the final grid (coins already cleared to '.')
const collision = L.grid.map((row) => row.join(''));

// player stands on the top of the ground in the spawn column (x = 2 tiles)
let groundTopRow = L.h - 1;
for (let y = 0; y < L.h; y++) { if (L.grid[y][2] !== '.') { groundTopRow = y; break; } }
const spawn = { x: 2 * TILE, y: groundTopRow * TILE - 14 };

// entities (pixel-anchored), preserving the exact order buildLevel() uses
const entities = [];
for (const c of L.coins) entities.push({ type: 'coin', x: c.x, y: c.y });
for (const e of L.enemies) entities.push({ type: 'goomba', x: e.col * TILE, y: e.row * TILE - 14, speed: 0.5 });
entities.push({ type: 'flag', x: L.flagCol * TILE + 8, baseRow: L.flagBaseRow, topRow: L.flagTopRow });

const level = {
  id: 'w1-1',
  tileSize: TILE,
  width: L.w,
  height: L.h,
  camera: { mode: 'follow', lead: 0.40 },
  spawn,
  parallax: [],
  layers: { collision },
  entities,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../assets/levels/w1-1.json');
await writeFile(out, JSON.stringify(level, null, 2) + '\n', 'utf8');
console.log('wrote', out, `(${collision.length} rows x ${L.w} cols, ${entities.length} entities, spawn ${spawn.x},${spawn.y})`);