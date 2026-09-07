// ============================================================
//  constants.js — every tunable in one place.
//  Moving these out of game.js (Phase 0) so later phases can
//  tweak physics / view / camera without hunting the monolith.
// ============================================================

// --- view (logical NES resolution; CSS scales it up pixelated) ---
export const VIEW_W = 256;
export const VIEW_H = 240;
export const TILE = 16;

// --- physics (pixels @ 60fps) ---
export const GRAV_UP_HELD = 0.50;    // low gravity while rising + jump held
export const GRAV_UP_RELEAS = 0.90;  // hard drop the instant jump is released
export const GRAV_DOWN = 0.65;       // falling gravity
export const JUMP_VEL = -9.2;
export const TERM_VY = 12;           // terminal fall speed
export const MAX_WALK = 2.0;
export const MAX_RUN = 3.0;
export const ACCEL_WALK = 0.40;
export const ACCEL_RUN = 0.55;
export const FRIC_GROUND = 0.5;
export const FRIC_AIR = 0.06;
export const STOMP = -5.0;           // bounce after a stomp
export const STOMP_HOLD = -7.5;      // higher bounce if jump held on stomp
export const STOMP_TOL = 12;         // px: feet must have been this close above an
                                     // enemy's top (previous frame) to count a stomp

// --- player ---
export const PLAYER_W = 12;
export const SMALL_H = 14;
export const BIG_H = 28;
export const INVULN = 120;           // i-frames after shrinking

// --- Phase 7b: fire power + fireballs (SMW fire-analog timing) ---
export const FIREBALL_SPEED = 6.0;   // horizontal launch speed (px/frame)
export const FIREBALL_GRAV = 0.22;   // gentle arc gravity (px/frame²)
export const FIREBALL_BOUNCE = 3.0;  // upward kick off the ground (px/frame)
export const FIREBALL_MAX_BOUNCES = 3; // pops after this many bounces
export const FIREBALL_MAX = 2;       // max live fireballs (SMB parity)
export const FIREBALL_SIZE = 8;      // fireball hitbox (px)
export const KICK_SPEED = 7.0;       // Phase 7c: kicked-shell launch speed

// --- timer ---
export const START_TIME = 300;
export const TIME_TICK = 24;         // frames per second of level-time

// --- camera (bug #2 fix: look-ahead + smoothing + hard safety clamp) ---
// The player sits CAM_LEAD of the way across the screen, with CAM_LOOKAHEAD px
// of extra view in the facing direction. The camera moves at most CAM_MAX_STEP
// px/frame (kept >= run speed so it can never lag the player behind).
export const CAM_LEAD = 0.40;
export const CAM_LOOKAHEAD = 24;
export const CAM_MAX_STEP = 5;
export const CAM_MARGIN = 8;         // hard safety band so the player is always visible

// --- collision (Phase 3: slope + one-way) ---
export const MAX_STEP_UP = 8;        // px: auto-climb threshold (half a tile)
export const SLOPE_ACCEL = 0.15;     // px/frame² downhill nudge on slopes
export const DROP_TIMER = 10;        // frames to ignore one-ways after Down+Jump

// --- loop ---
export const STEP = 1000 / 60;       // fixed 60fps logic timestep (ms)
