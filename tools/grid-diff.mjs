// Grid-diff: prove the JSON-derived tilemap (via the live game) is byte-identical
// to the legacy buildLevel() grid. Run from the repo root:  node tools/grid-diff.mjs
//
// Uses the same browser stub as test/harness.mjs. The tilemap is created at boot
// (loadLevel(true) in game.js), so after import __internals.grid is already the
// JSON-derived collision grid — no need to drive the loop.
import { installBrowser } from '../test/browser-stub.mjs';
installBrowser();

const { buildLevel } = await import('../js/level.js');
const mod = await import('../js/game.js');
const G = mod.__internals;

const ref = buildLevel().grid;
const got = G.grid; // tilemap.rows() — the live game's collision grid
let diffs = 0;
for (let y = 0; y < ref.length; y++) {
  for (let x = 0; x < ref[y].length; x++) {
    if (got[y][x] !== ref[y][x]) {
      diffs++;
      if (diffs <= 5) console.log(`DIFF at (${x},${y}): ${JSON.stringify(ref[y][x])} -> ${JSON.stringify(got[y][x])}`);
    }
  }
}
console.log(`ref ${ref.length}x${ref[0].length}  got ${got.length}x${got[0].length}  diffs: ${diffs}`);
console.log(`player spawn: (${G.player.x}, ${G.player.y})  [expect 32,194]`);
console.log(`enemies: ${G.enemies.length}  coins: ${G.coins.length}`);
console.log(diffs === 0 ? 'GRID 1:1 OK' : 'GRID MISMATCH');
process.exit(diffs === 0 ? 0 : 1);