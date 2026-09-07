// ============================================================
//  parallax.js — multi-layer parallax scrolling background (Phase 5)
//
//  Replaces the old solid-fill + hand-drawn clouds/hills with a
//  data-driven stack of horizontally-tileable layers, each scrolling at a
//  per-layer factor relative to the camera. Far layers (sky, mountains)
//  move slowly, near layers (hills, trees) move faster — the classic
//  "layer method" parallax that fakes depth in a 2D side-scroller.
//
//  Performance model (ROADMAP Phase 5):
//    * Each layer's art is pre-composited ONCE to an offscreen canvas at
//      build time (createParallax calls spec.paint). Per frame we only blit
//      that canvas with drawImage — no re-drawing of every shape.
//    * `imageSmoothingEnabled` is forced off so pixel art stays crisp.
//
//  Seamlessness: a layer is a strip of width `layerWidth`. Its starting
//  x-offset is a pure function of camX (layerOffset), normalised to
//  [-layerWidth, 0] so the strip always begins at or before the left edge
//  and tiles forward to cover the whole view with no seam.
//
//  This module is a pure engine: it knows nothing about the specific
//  placeholder art. The game (js/game.js) supplies the layer specs
//  (factors, widths, paint functions). The offset math is a pure function
//  so it is unit-testable headlessly (see test/harness.mjs).
// ============================================================

/**
 * Pure: the starting x-offset for one parallax layer.
 *
 * Returns a value in [-layerWidth, 0]. With camX >= 0 and factor >= 0 the
 * raw `-(camX * factor) % layerWidth` is already in that range; the `> 0`
 * guard only protects against a hypothetical negative camX (JS `%` keeps
 * the dividend's sign).
 *
 * @param {number} camX        - camera x in world pixels (>= 0)
 * @param {number} factor      - scroll factor (0 = static, 1 = locked to world)
 * @param {number} layerWidth  - tile width of the layer strip in px (its period)
 * @returns {number} offset in [-layerWidth, 0]
 */
export function layerOffset(camX, factor, layerWidth) {
  if (!layerWidth || layerWidth <= 0) return 0;
  let ox = (-(camX * factor)) % layerWidth;
  if (ox > 0) ox -= layerWidth;
  return ox;
}

export class ParallaxLayer {
  /**
   * @param {object} spec - { name, factor, y, width, height, canvas }
   */
  constructor(spec) {
    this.name = spec.name || 'layer';
    this.factor = spec.factor || 0;
    this.y = spec.y || 0;
    this.width = spec.width || 1;
    this.height = spec.height || 1;
    this.canvas = spec.canvas || null;   // pre-composited offscreen strip
  }

  /**
   * Blit this layer across the visible width, seamlessly tiled.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX   - camera x (world px)
   * @param {number} viewW  - visible width in px (VIEW_W)
   */
  draw(ctx, camX, viewW) {
    if (!this.canvas) return;
    const w = this.width;
    const ox = layerOffset(camX, this.factor, w);
    for (let x = ox; x < viewW; x += w) {
      ctx.drawImage(this.canvas, Math.round(x), this.y);
    }
  }
}

/**
 * Build a parallax stack from an ordered list of layer specs (back -> front).
 *
 * Each spec: `{ name, factor, y, width, height, paint(ctx, w, h) }`.
 *   - `paint` is invoked ONCE at build time to draw the layer's art onto a
 *     fresh offscreen canvas of size (width x height). It must produce
 *     horizontally-tileable art (left and right edges match).
 *
 * `makeCanvas(w, h)` is injectable (dependency injection, mirroring the
 * level transport) so the headless harness can supply a stub; it defaults to
 * `document.createElement('canvas')` for the browser.
 *
 * @returns {{ layers: ParallaxLayer[], draw: Function }}
 */
export function createParallax(specs, makeCanvas) {
  const factory = makeCanvas || defaultMakeCanvas;
  const layers = (specs || []).map((s) => {
    const canvas = factory(s.width, s.height);
    const lctx = canvas.getContext('2d');
    if (lctx) lctx.imageSmoothingEnabled = false;   // crisp pixel art
    if (typeof s.paint === 'function') s.paint(lctx, s.width, s.height);
    return new ParallaxLayer({ ...s, canvas });
  });
  return {
    layers,
    draw(ctx, camX, viewW) {
      for (const L of layers) L.draw(ctx, camX, viewW);
    },
  };
}

function defaultMakeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
