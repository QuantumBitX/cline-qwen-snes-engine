// ============================================================
//  Headless browser stubs — run the engine under Node (no DOM,
//  no canvas, no audio). Lets us execute real game logic in CI.
//
//  Install via:  const browser = installBrowser();
//  Then load the game (classic eval or module import), then:
//     browser.press('ArrowRight'); browser.advance(30);
//  No AudioContext is installed on purpose: SFX/Music become safe
//  no-ops (their ensure() paths tolerate a missing constructor).
// ============================================================

export function installBrowser() {
  const g = globalThis;
  let clock = 0;
  const listeners = Object.create(null);
  let raf = [];

  // --- 2D context stub: every method is a no-op, props are stored ---
  function makeCtx() {
    const store = {};
    return new Proxy(store, {
      get(t, p) {
        if (p in t) return t[p];
        if (p === 'canvas') return undefined;
        return () => undefined; // draw ops are no-ops
      },
      set(t, p, v) { t[p] = v; return true; },
    });
  }
  function makeCanvas(w, h) {
    const ctx = makeCtx();
    return {
      width: w, height: h, style: {}, _ctx: ctx,
      getContext: () => ctx,
      addEventListener() {}, removeEventListener() {},
    };
  }

  const canvases = { game: makeCanvas(256, 240) };

  g.window = g;
  g.global = g;
  g.performance = { now: () => clock };
  g.requestAnimationFrame = (fn) => { raf.push(fn); return raf.length; };
  g.cancelAnimationFrame = () => {};
  g.addEventListener = (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); };
  g.removeEventListener = (type, fn) => {
    const a = listeners[type]; if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
  };
  g.document = {
    getElementById: (id) => canvases[id] || null,
    createElement: (tag) => (tag === 'canvas' ? makeCanvas(0, 0) : {}),
    addEventListener() {}, removeEventListener() {},
    body: {}, documentElement: {},
  };

  // --- in-memory localStorage (Phase 7a: high-score persistence) ---
  // The stub previously had NO localStorage; game.js feature-detects it, so a
  // missing object is a safe no-op. We provide a real in-memory store here so
  // the harness can prove a beaten high score round-trips (write -> re-read).
  const _store = Object.create(null);
  g.localStorage = {
    getItem: (k) => (k in _store ? _store[k] : null),
    setItem: (k, v) => { _store[k] = String(v); },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
    key: (i) => Object.keys(_store)[i] ?? null,
    get length() { return Object.keys(_store).length; },
  };

  function dispatch(type, code) {
    const ev = { code, key: code, type, repeat: false, preventDefault() {} };
    for (const fn of (listeners[type] || []).slice()) fn(ev);
  }
  const press = (code) => dispatch('keydown', code);
  const release = (code) => dispatch('keyup', code);
  const tap = (code) => { dispatch('keydown', code); dispatch('keyup', code); };

  // Drive the real requestAnimationFrame loop. One call to advance(1)
  // should produce exactly one 60fps logic update (STEP = 1000/60).
  function advance(frames, perFrame = 1000 / 60) {
    for (let i = 0; i < frames; i++) {
      clock += perFrame;
      const q = raf; raf = [];
      for (const fn of q) fn(clock);
    }
  }

  return {
    canvases, listeners,
    canvas: canvases.game,
    press, release, tap, dispatch,
    advance,
    getClock: () => clock,
    pendingRaf: () => raf.length,
  };
}
