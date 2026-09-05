// Self-test for the browser stubs (key dispatch, 2d no-ops, rAF timing).
// Full engine behaviour is covered by test/harness.mjs.
import { installBrowser } from './browser-stub.mjs';

let failures = 0;
function check(name, cond) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name);
  if (!cond) failures++;
}

// ---- Part 1: stub primitives ----
console.log('[stub primitives]');
{
  const b = installBrowser();
  let fired = 0, gotCode = null;
  globalThis.addEventListener('keydown', (e) => { fired++; gotCode = e.code; });
  b.press('Space');
  check('keydown listener fires', fired === 1);
  check('event.code delivered', gotCode === 'Space');

  const c = globalThis.document.createElement('canvas');
  const x = c.getContext('2d');
  let threw = false;
  try {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4);
    x.save(); x.translate(1, 1); x.scale(-1, 1); x.restore();
    x.beginPath(); x.ellipse(1, 1, 2, 3, 0, 0, 7); x.fill(); x.fillText('a', 0, 0);
  } catch (e) { threw = true; }
  check('2d context ops are safe no-ops', !threw);

  // rAF timing: each advance(1) should add exactly one frame-callback run
  let runs = 0;
  function loop() { runs++; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  b.advance(5);
  check('rAF self-requeues (5 runs after 5 advances)', runs === 5);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll stub self-tests passed.');
process.exit(failures ? 1 : 0);
