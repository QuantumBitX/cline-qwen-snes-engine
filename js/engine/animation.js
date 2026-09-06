// ============================================================
//  animation.js — state-based frame controller (Phase 4)
//
//  Picks an animation state from player physics (onGround, vx, vy)
//  + input direction, then advances frames at a speed-dependent rate.
//
//  Frame layout (4×2 grid in the player sheet, 16×16 cells):
//    Row 0: [0:idle] [1:runA] [2:runB] [3:skid]
//    Row 1: [4:jump] [5:fall] [6:land] [7:reserved]
// ============================================================

/**
 * Pure function: determine the animation state from player physics + input.
 * @param {object} p         - player entity {onGround, vx, vy, ...}
 * @param {number} inputDir  - -1 (left), 0 (none), 1 (right)
 * @returns {string} state name
 */
export function pickPlayerState(p, inputDir) {
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
  const speed = Math.abs(p.vx);
  if (inputDir !== 0 && Math.sign(inputDir) !== Math.sign(p.vx) && speed > 1.2) return 'skid';
  if (speed < 0.15) return 'idle';
  return speed > 2.4 ? 'run_fast' : 'run';
}

// Frame indices for each state (maps to the 4×2 grid layout)
const F = {
  idle: 0,
  runA: 1,
  runB: 2,
  skid: 3,
  jump: 4,
  fall: 5,
  land: 6,
};

export class AnimController {
  constructor() {
    this.state = 'idle';
    this.frame = F.idle;   // current frame index to draw
    this.timer = 0;        // tick counter for multi-frame states
    this.landTimer = 0;    // remaining ticks of the land squash
    this.prevState = 'idle';
  }

  /**
   * Advance the animation by one tick.
   * @param {object} p         - player entity
   * @param {number} inputDir  - -1, 0, or 1
   * @returns {number} the frame index to draw this tick
   */
  update(p, inputDir) {
    this.prevState = this.state;

    // Detect landing: was in 'fall' (or 'jump') and now on ground
    if ((this.prevState === 'fall' || this.prevState === 'jump') && p.onGround && this.landTimer <= 0) {
      this.landTimer = 6; // show land squash for 6 ticks
    }

    // Land squash overrides everything while active
    if (this.landTimer > 0) {
      this.landTimer--;
      this.state = 'land';
      this.frame = F.land;
      return this.frame;
    }

    this.state = pickPlayerState(p, inputDir);

    // On state change, reset the multi-frame timer and set the initial frame
    if (this.state !== this.prevState) this.timer = 0;

    switch (this.state) {
      case 'idle':
        this.frame = F.idle;
        break;
      case 'run':
      case 'run_fast': {
        const interval = this.state === 'run_fast' ? 4 : 8;
        // On first tick of a run state, show runA immediately
        if (this.timer === 0 && (this.frame !== F.runA && this.frame !== F.runB)) {
          this.frame = F.runA;
        }
        this.timer++;
        if (this.timer >= interval) {
          this.timer = 0;
          this.frame = this.frame === F.runA ? F.runB : F.runA;
        }
        break;
      }
      case 'skid':
        this.frame = F.skid;
        break;
      case 'jump':
        this.frame = F.jump;
        break;
      case 'fall':
        this.frame = F.fall;
        break;
      default:
        this.frame = F.idle;
    }

    return this.frame;
  }

  /** Reset to initial state (e.g. on level restart). */
  reset() {
    this.state = 'idle';
    this.frame = F.idle;
    this.timer = 0;
    this.landTimer = 0;
    this.prevState = 'idle';
  }
}