// ============================================================
//  loop.js — fixed 60fps logic timestep (Phase 0 extraction)
//  Accumulates real time and steps the sim in fixed STEP chunks so the
//  game feels identical on 60Hz / 144Hz displays.
// ============================================================

import { STEP } from './constants.js';

export function runLoop(update, render) {
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last; last = now;
    if (dt > 100) dt = 100;         // avoid a huge catch-up after a stall
    acc += dt;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
  }
  requestAnimationFrame(frame);
}
