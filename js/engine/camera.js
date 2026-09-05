// ============================================================
//  camera.js — follow + clamp + look-ahead (Phase 0 extraction)
//
//  BUG #2 FIX (from HANDOVER §5): the old camera was a hard snap to
//  `player.x - VIEW_W * 0.35` with no look-ahead, so it felt abrupt while
//  running. This version:
//    1. Targets the player's centre offset by CAM_LEAD, plus CAM_LOOKAHEAD
//       px of extra view in the facing direction.
//    2. Smooths the actual position toward the target (at most CAM_MAX_STEP
//       px/frame, kept >= run speed so it can never lag the player).
//    3. Applies a HARD safety clamp so the player can never leave the
//       visible band even if the smoothing math ever falls behind.
// ============================================================

import { VIEW_W, CAM_LEAD, CAM_LOOKAHEAD, CAM_MAX_STEP, CAM_MARGIN } from './constants.js';

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

export function createCamera() {
  let x = 0;
  return {
    get x() { return x; },
    reset(v = 0) { x = v; },
    update(player, levelW) {
      const maxCam = levelW - VIEW_W;
      if (maxCam <= 0) { x = 0; return; }
      const center = player.x + player.w / 2;
      const target = clamp(center - VIEW_W * CAM_LEAD + CAM_LOOKAHEAD * player.facing, 0, maxCam);
      // smoothed follow (bounded so it never outruns/lags the player)
      x += clamp(target - x, -CAM_MAX_STEP, CAM_MAX_STEP);
      // hard safety: keep the player's centre inside the visible band
      const onScreen = center - x;
      if (onScreen < CAM_MARGIN) x = center - CAM_MARGIN;
      else if (onScreen > VIEW_W - CAM_MARGIN) x = center - (VIEW_W - CAM_MARGIN);
      x = clamp(x, 0, maxCam);
    },
  };
}
