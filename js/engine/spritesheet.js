// ============================================================
//  spritesheet.js — PNG atlas loader + frame grid slicer (Phase 4)
//
//  Splits a PNG image into a uniform grid of frames. In the browser,
//  load() fetches the image and populates the frame list. For headless
//  testing, init(imgW, imgH) sets up the same frame list without
//  requiring a real Image object.
// ============================================================

/**
 * Pure function: compute the frame grid from image dimensions.
 * Returns an array of {sx, sy} source-rect origins, row-major order.
 */
export function computeFrames(imgW, imgH, cellW, cellH) {
  const rows = Math.floor(imgH / cellH);
  const cols = Math.floor(imgW / cellW);
  const frames = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({ sx: c * cellW, sy: r * cellH });
    }
  }
  return frames;
}

export class SpriteSheet {
  /**
   * @param {string} src      - URL/path to the PNG (used by load() in browser)
   * @param {number} cellW    - width of each frame cell in pixels
   * @param {number} cellH    - height of each frame cell in pixels
   */
  constructor(src, cellW, cellH) {
    this.src = src;
    this.cellW = cellW;
    this.cellH = cellH;
    this.frames = [];
    this.loaded = false;
    this.img = null;
    this._p = null;
  }

  /**
   * Headless init: populate frames from known dimensions without loading
   * an image. Used by the Node test harness.
   */
  init(imgW, imgH) {
    this.frames = computeFrames(imgW, imgH, this.cellW, this.cellH);
    this.loaded = true;
    return this;
  }

  /**
   * Browser async load: fetches the PNG and populates the frame grid.
   * Returns a Promise that resolves to `this` when ready.
   */
  load() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.frames = computeFrames(
          img.naturalWidth, img.naturalHeight, this.cellW, this.cellH
        );
        this.loaded = true;
        res(this);
      };
      img.onerror = () => rej(new Error('sprite load failed: ' + this.src));
      img.src = this.src;
    });
    return this._p;
  }

  /**
   * Draw one frame from this sheet onto the given 2D context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} index   - frame index (wraps via modulo)
   * @param {number} x       - destination x (world/screen px)
   * @param {number} y       - destination y
   * @param {object} [opts]
   * @param {boolean} [opts.flipX=false] - mirror horizontally
   * @param {number}  [opts.offsetX=0]   - extra x offset
   * @param {number}  [opts.offsetY=0]   - extra y offset
   */
  draw(ctx, index, x, y, opts = {}) {
    if (!this.loaded || this.frames.length === 0) return;
    const { flipX = false, offsetX = 0, offsetY = 0 } = opts;
    const f = this.frames[index % this.frames.length];
    const px = Math.round(x) + offsetX;
    const py = Math.round(y) + offsetY;
    if (!flipX) {
      ctx.drawImage(this.img, f.sx, f.sy, this.cellW, this.cellH,
                    px, py, this.cellW, this.cellH);
    } else {
      ctx.save();
      ctx.translate(px + this.cellW, py);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, f.sx, f.sy, this.cellW, this.cellH,
                    0, 0, this.cellW, this.cellH);
      ctx.restore();
    }
  }
}