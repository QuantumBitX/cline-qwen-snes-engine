// ============================================================
//  sprite-data.js — pixel-art source data (palettes + ASCII rows)
//
//  This is the single source of truth for the sprite pixel art.
//  Plain data only (no DOM). It is the one consumer-facing source:
//    - tools/gen-sprites.mjs  (Node build)    -> baked PNG sheets
//  The game renders exclusively from those baked PNGs (no ASCII path).
//
//  Frames are authored as arrays of 16-wide ASCII strings. Each
//  character maps to a palette colour; '.', ' ', '_' (or a char
//  with no palette entry) is transparent. The rasterizer is
//  lenient: a short row is padded with transparency.
// ============================================================

// --- palettes ---
export const MARIO_PAL = { r: '#DC2A08', s: '#FAB878', h: '#5B3B1E', b: '#1B5FD6', w: '#FCFCFC', k: '#1A1A1A' };
// Fire recolour: swap the red (r) and white (w) entries of MARIO_PAL so the
// same big-mario rows read as the fire power-up. Same keys, two colours swapped.
export const FIRE_PAL = { r: '#FCFCFC', s: '#FAB878', h: '#5B3B1E', b: '#1B5FD6', w: '#DC2A08', k: '#1A1A1A' };
export const GOOMBA_PAL = { g: '#B15E1E', d: '#5B3B14', w: '#FCFCFC', k: '#1A1A1A' };
export const MUSH_PAL = { r: '#DC2A08', w: '#FCFCFC', s: '#FAB878', k: '#1A1A1A' };

// --- mario (small) frames, 16-wide ---
// player.png 4x2 grid order:
//   [0:idle][1:runA][2:runB][3:skid][4:jump][5:fall][6:land][7:reserved]

// idle — the canonical standing pose
export const marioSmall = [
  ".....rrrrr......",
  "....rrrrrrrrr...",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  ".....hhh.hhh....",
  "....hhhh.hhhh...",
];

// runA — two-step walk, feet together (mid-stride)
export const marioRunA = [
  ".....rrrrr......",
  "....rrrrrrrrr...",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "......hhhh......",
  ".....hhhhhh.....",
];

// runB — two-step walk, feet apart (wide stride)
export const marioRunB = [
  ".....rrrrr......",
  "....rrrrrrrrr...",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....hhh...hhh...",
  "...hhhh...hhhh..",
];

// skid — leaning back, arms out (bracing while stopping)
export const marioSkid = [
  ".....rrrrr......",
  "....rrrrrrrrr...",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  ".s..rrrrrrrrr.s.",
  ".s..rbrrrrrbr.s.",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  ".....hhh.hhh....",
  "....hhhh.hhhh...",
];

// jump — arms raised, feet tucked
export const marioSmallJump = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  ".s..rrrrrrrrr.s.",
  ".s..bbbbbbbbb.s.",
  "....bbbbbbbbb...",
  "....bbwbbwbb....",
  "....bbbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhhhhhh...",
  "....hhhhhhhhhh..",
];

// fall — marioSmallJump with the arms lowered (descending)
export const marioFall = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....bbbbbbbbb...",
  ".s..bbbbbbbbb.s.",
  ".s..bbwbbwbb..s.",
  "....bbbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhhhhhh...",
  "....hhhhhhhhhh..",
];

// land — squash: one row shorter, slightly wider (15 rows; the
// PNG baker bottom-aligns it so the feet stay on the ground)
export const marioLand = [
  ".....rrrrr......",
  "...rrrrrrrrrr...",
  "...rrrrrrrrrrr..",
  "...rrrrrrrrrrrr.",
  "...rrrrrrrrrrrrr",
  "...hhssssssss...",
  "...hsssssksss...",
  "...hshhhhhhhs...",
  "...rrrrrrrrrr...",
  "...rbrrrrrbrb...",
  "..ssbbbbbbbbs...",
  "..bbbbbbbbbb....",
  "..bbwbbwbbbb....",
  "..hhh...hhh.....",
  ".hhhh...hhhh....",
];

// big mario — used only by the ASCII fallback (power-up form)
export const marioBig = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhh.hh....",
  "....hhhh..hhhh..",
];

// --- mario (big) variants, 16-wide x 28 tall (= BIG_H) ---
// player-big.png / player-fire.png 4x2 grid order (same as player.png):
//   [0:idle][1:runA][2:runB][3:skid][4:jump][5:fall][6:land][7:reserved]
// The idle frame is marioBig itself; the rest are pose variants of the same
// 28-row body so the PNG branch can animate the power-up form.

// big runA — mid-stride, feet together
export const marioBigRunA = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  "......hhhh......",
  ".....hhhhhh.....",
];

// big runB — wide stride, feet apart
export const marioBigRunB = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  "....hhh...hhh...",
  "...hhhh...hhhh..",
];

// big skid — bracing, arms out
export const marioBigSkid = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  ".s..rrrrrrrrr.s.",
  ".s..rbrrrrrbr.s.",
  "....sbbbbbbbs...",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbwbbwbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhh.hh....",
  "....hhhh..hhhh..",
];

// big jump — arms raised, feet tucked
export const marioBigJump = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  ".s..rrrrrrrrr.s.",
  ".s..bbbbbbbbb.s.",
  "....bbbbbbbbb...",
  "....bbwbbwbb....",
  "....bbbbbbbbb...",
  "....bbbbbbbbb...",
  "....bbwbbwbb....",
  "....bbbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhhhhhh...",
  "....hhhhhhhhhh..",
];

// big fall — descending, arms lowered
export const marioBigFall = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....bbbbbbbbb...",
  ".s..bbbbbbbbb.s.",
  ".s..bbwbbwbb..s.",
  "....bbbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....bbbbbbbb...",
  ".....hhhhhhhh...",
  "....hhhhhhhhhh..",
];

// big land — squash: wider overalls, feet planted
export const marioBigLand = [
  "......rrrr......",
  "....rrrrrrrr....",
  "....rrrrrrrrrr..",
  "....rrrrrrrrrrr.",
  "....rrrrrrrrrrrr",
  "....hhsssssss...",
  "....hssssskss...",
  "....hshhhhhhs...",
  "....rrrrrrrrr...",
  "....rbrrrrrbr...",
  "..ssbbbbbbbbs...",
  "..bbbbbbbbbb....",
  "..bbwbbwbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbwbbwbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..bbbbbbbbbb....",
  "..hhhh...hhhh...",
  ".hhhhh...hhhhh..",
];

// --- goomba frames, 16-wide ---
// goomba.png 2x1 grid order: [0:goomba A][1:goomba B]

// goomba A — standing / one foot forward
export const goomba = [
  ".....gggggg.....",
  "....gggggggg....",
  "...gggggggggg...",
  "..gggggggggggg..",
  "..gwwggggggwwg..",
  "..gkkggggggkkg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  ".gggggggggggggg.",
  ".gggggggggggggg.",
  ".gggggggggggggg.",
  ".gggddddddddggg.",
  ".ggg.dddddd.ggg.",
];

// goomba B — feet swapped (dark foot band shifted, mid-step)
export const goombaB = [
  ".....gggggg.....",
  "....gggggggg....",
  "...gggggggggg...",
  "..gggggggggggg..",
  "..gwwggggggwwg..",
  "..gkkggggggkkg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  "..gggggggggggg..",
  ".gggggggggggggg.",
  ".gggggggggggggg.",
  ".gggggggggggggg.",
  ".ggggddddddddgg.",
  ".gggg.dddddd.gg.",
];

// --- mushroom, 16-wide (13 rows, PNG baker bottom-aligns it) ---
export const mushroom = [
  ".....rrrrrr.....",
  "....rrrrrrrrr...",
  "...rrwrrrrwrr...",
  "..rrwrrrrrrwrr..",
  ".rrrrwrrrrwrrrr.",
  ".rrrrrrrrrrrrrr.",
  "rrrrrrrrrrrrrrrr",
  ".ssssssssssssss.",
  ".ssssssssssssss.",
  ".ssssksssskssss.",
  ".ssssssssssssss.",
  "..sssskkssssss..",
  "...ssssssssss...",
];

