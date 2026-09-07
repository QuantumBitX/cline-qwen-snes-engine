// ============================================================
//  input.js — keyboard state + edge detection (Phase 0 extraction)
//
//  - `held`    : live map of currently-down keys (for held-state polling).
//  - `tickJump()` : call once per 60fps tick BEFORE physics; computes the
//                   jump "pressed" edge from the held state (matches the
//                   original per-tick behaviour).
//  - `onKey(fn)`  : register a handler for discrete keydown events (Enter /
//                   P / M live here because they drive game-state transitions
//                   + audio unlock, which are better kept event-driven).
// ============================================================

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter']);

export function createInput(target) {
  const held = Object.create(null);
  let jumpDown = false, jumpPressed = false;
  let fireDown = false, firePressed = false;   // Phase 7b: fire-ball edge
  let onKey = null;

  target.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    held[e.code] = true;
    if (onKey) onKey(e);
  });
  target.addEventListener('keyup', (e) => { held[e.code] = false; });

  const jumpHeld = () => !!(held['Space'] || held['ArrowUp'] || held['KeyW']);
  const fireHeld = () => !!(held['KeyZ'] || held['KeyJ']);   // Phase 7b: fire key

  return {
    held,
    onKey(fn) { onKey = fn; },
    jumpHeld,
    jumpPressed: () => jumpPressed,
    // Advance the jump edge one logic tick. Returns true on the tick the jump
    // button transitions not-held -> held, false otherwise.
    tickJump() {
      const h = jumpHeld();
      jumpPressed = h && !jumpDown;
      jumpDown = h;
      return jumpPressed;
    },
    fireHeld,
    firePressed: () => firePressed,
    // Phase 7b: advance the fire edge one logic tick (same not-held->held
    // semantics as tickJump). Call once per 60fps tick before physics.
    tickFire() {
      const h = fireHeld();
      firePressed = h && !fireDown;
      fireDown = h;
      return firePressed;
    },
  };
}
