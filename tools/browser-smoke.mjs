// Browser smoke test. No real browser / headless-browser tooling is available
// in this environment, so this exercises the browser-specific code path as
// closely as possible:
//   - stub global `fetch` to serve assets/levels/w1-1.json (simulates the
//     browser fetching the static file over HTTP),
//   - force the browser branch (isNode=false) so game.js installs the fetch
//     transport and NOT the node disk transport,
//   - boot the full game, then "click play" (Enter) and advance frames to
//     verify the player moves on the fetch-loaded level,
//   - verify the live grid is byte-identical to the legacy buildLevel() grid.
//
// Run from the repo root:  node tools/browser-smoke.mjs
import { installBrowser } from '../test/browser-stub.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LEVEL_JSON = readFileSync(resolve('assets/levels/w1-1.json'), 'utf8');

// Stub fetch to serve the level (simulates the browser fetching the static file).
globalThis.fetch = (url) => {
  if (String(url).endsWith('w1-1.json')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(LEVEL_JSON)) });
  }
  return Promise.reject(new Error('unexpected fetch: ' + url));
};

// Force the browser branch: make isNode falsy for game.js's module body.
const savedNode = process.versions.node;
delete process.versions.node;

let r;
try {
  const b = installBrowser();
  const { buildLevel } = await import('../js/level.js');
  const mod = await import('../js/game.js');
  const G = mod.__internals;

  // grid: JSON-derived (via fetch) vs legacy buildLevel — must be byte-identical
  const ref = buildLevel().grid;
  const got = G.grid;
  let diffs = 0;
  for (let y = 0; y < ref.length; y++) for (let x = 0; x < ref[y].length; x++) {
    if (got[y][x] !== ref[y][x]) { diffs++; if (diffs <= 5) console.log(`DIFF at (${x},${y}): ${JSON.stringify(ref[y][x])} -> ${JSON.stringify(got[y][x])}`); }
  }

  const bootState = G.state;
  const spawnX = G.player.x, spawnY = G.player.y;

  // "click play": Enter starts the game
  b.press('Enter'); b.advance(1);
  const playing = G.state === 'playing';

  // "advance frames": hold right, verify the player moves
  b.press('ArrowRight'); b.advance(20);
  const moved = G.player.x > spawnX + 5;
  b.release('ArrowRight');

  r = { diffs, bootState, spawnX, spawnY, playing, moved, enemies: G.enemies.length, coins: G.coins.length };
} finally {
  process.versions.node = savedNode;
}

console.log(JSON.stringify(r, null, 2));
const ok = r.diffs === 0 && r.bootState === 'title' && r.playing && r.moved && r.spawnX === 32 && r.spawnY === 194;
console.log(ok ? 'BROWSER SMOKE OK' : 'BROWSER SMOKE MISMATCH');
process.exit(ok ? 0 : 1);