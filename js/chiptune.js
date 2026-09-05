// ============================================================
//  CHIPTUNE ENGINE  -  NES-style sequencer + 3 original tracks
//  Channels: pulse1 (lead), pulse2 (arpeggio), triangle (bass), noise (drums)
// ============================================================
  // --- note helpers: name -> midi number, midi -> Hz ---
  const NAMES = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };
  function midi(note) {
    if (note === 'R' || note == null) return 0;
    const m = note.match(/^([A-G])([#b]?)(\d)$/);
    if (!m) return 0;
    let n = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    n = n + 12 * (parseInt(m[3], 10) + 1);
    return n;
  }
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  // --- note value -> in 16th-note steps (4 steps = a quarter note) ---
  const DURS = { w:16, h:8, q:4, e:2, s:1 };
  function steps(str) {
    const m = String(str).match(/^(.+?)(\d+)$/);
    if (m) { const base = DURS[m[1]]; return base ? base * parseInt(m[2], 10) : null; }
    return DURS[str] || null;
  }

  // --- tempo -> seconds per 16th step ---
  function stepSec(tempo) { return 60 / tempo / 4; }

  // ============================================================
  //  TRACK DATA
  //  Each track: { tempo, name, lead, arp, bass, drum }
  //    lead/arp/bass : "<dur> <note> ..." tokens; dur in {w,h,q,e}, note=NAME#OCT
  //                    (e.g. "q E4", "h C5", "e B#4"). Each = 32 steps (4 bars).
  //    drum          : 32 chars = 2 bars x 16 sixteenth steps:
  //      '.' silent  | 'k' kick(triangle)  | 's' snare(noise)  | 'h' hat(noise)
  // ============================================================
  const TRACKS = {};

  // ---------- OPTION A : "Overworld March"  (128 BPM, C major, fast) ----------
  //  Each channel = 4 bars = 32 steps. Drums = 32 chars (2 bars x 16).
  TRACKS.A = {
    tempo: 128,
    name: 'Overworld March',
    lead:
      'q E4 q G4 q C5 q A4 ' + 'q E4 q G4 q C5 q A4 ' +
      'q D4 q F4 q B4 q G4 ' + 'q D4 q F4 q B4 q G4 ' +
      'h C5 h F5 h G5 h A5 ' + 'h C5 h A5 h F5 h C5 ' +
      'q G5 q E5 h C5 q G5 ' + 'q E5 q C5 q G4 q C5 ',
    arp:
      'q C3 q G3 q E4 q C4 ' + 'q C3 q G3 q E4 q C4 ' +
      'q D3 q A3 q F4 q D4 ' + 'q D3 q A3 q F4 q D4 ' +
      'q C3 q G3 q E4 q C4 ' + 'q E3 q C4 q G3 q C4 ' +
      'q G2 q D3 q B3 q G3 ' + 'q C3 q G3 q E4 q C4 ',
    bass:
      'h C2 h C2 ' + 'h C2 h C2 ' +
      'h D2 h D2 ' + 'h D2 h D2 ' +
      'h C2 h C2 ' + 'h E2 h C2 ' +
      'h G2 h G2 ' + 'h C2 h C2 ',
    drum:
      'k.h.sh.k.h.sh.h.' + 'k.h.sh.k.h.sh.h.' +
      'k.h.sh.k.h.sh.h.' + 'k.h.sh.k.h.sh.h.'
  };

  // ---------- OPTION B : "Sunny Meadow"  (112 BPM, G major, mellow 2/4) ----------
  TRACKS.B = {
    tempo: 112,
    name: 'Sunny Meadow',
    lead:
      'q G4 q B4 q D5 q B4 ' + 'q G4 q B4 q D5 q B4 ' +
      'q E4 q G4 q B4 q G4 ' + 'q A4 q C5 q B4 q A4 ' +
      'q G4 q B4 q D5 q B4 ' + 'q E4 q G4 q B4 q G4 ' +
      'q D5 q E5 q D5 q B4 ' + 'q G4 q B4 q D5 q G4 ',
    arp:
      'q G3 q D4 q B3 q D4 ' + 'q G3 q D4 q B3 q D4 ' +
      'q A3 q E4 q C4 q E4 ' + 'q D3 q A3 q F3 q A3 ' +
      'q G3 q D4 q B3 q D4 ' + 'q A3 q E4 q C4 q E4 ' +
      'q B3 q D4 q F4 q D4 ' + 'q G3 q D4 q B3 q G3 ',
    bass:
      'e G1 e G1 e G1 e G1 ' + 'e G1 e G1 e G1 e G1 ' +
      'e A1 e A1 e A1 e A1 ' + 'e D2 e D2 e D2 e D2 ' +
      'e G1 e G1 e G1 e G1 ' + 'e A1 e A1 e A1 e A1 ' +
      'e B2 e B2 e B2 e B2 ' + 'e G2 e G2 e G2 e G2 ',
    drum:
      'k...h...k...h..' + 'k...h...k...s..' +
      'k...h...k...h..' + 'k...h...k...s..'
  };

  // ---------- OPTION C : "Cloud Drift"  (92 BPM, C major, dreamlike) ----------
  TRACKS.C = {
    tempo: 92,
    name: 'Cloud Drift',
    lead:
      'q C5 q E5 q G5 q E5 ' + 'q F5 q E5 q D5 q C5 ' +
      'q D5 q F5 q G5 q A5 ' + 'q G5 q E5 q D5 q C5 ' +
      'q C5 q E5 q G5 q C6 ' + 'q A5 q G5 q F5 q E5 ' +
      'q D5 q E5 q D5 q C5 ' + 'q E5 q D5 q C5 q C5 ',
    arp:
      'q C4 q E4 q G4 q E4 ' + 'q C4 q E4 q G4 q E4 ' +
      'q F3 q A3 q C4 q A3 ' + 'q G3 q B3 q D4 q B3 ' +
      'q C4 q E4 q G4 q E4 ' + 'q A3 q C4 q E4 q C4 ' +
      'q F3 q A3 q C4 q A3 ' + 'q G3 q B3 q D4 q B3 ',
    bass:
      'q C3 q C3 q C3 q C3 ' + 'q C3 q C3 q C3 q C3 ' +
      'q F3 q F3 q F3 q F3 ' + 'q G3 q G3 q G3 q G3 ' +
      'q C3 q C3 q C3 q C3 ' + 'q A2 q A2 q A2 q A2 ' +
      'q F3 q F3 q F3 q F3 ' + 'q G3 q G3 q G3 q G3 ',
    drum:
      'k.......h.......k.......h.......'
  };

  // ============================================================
  //  SYNTHESIS  -  low-passed voices for a soft 8-bit timbre
  // ============================================================
  let ac = null, master = null, masterVol = 0.5;
  function ensureCtx() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = masterVol;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 14000; lp.Q.value = 0.4;
    master.connect(lp); lp.connect(ac.destination);
  }
  function blip(freq, when, durSec, opt) {
    opt = opt || {};
    const o = ac.createOscillator();
    o.type = opt.type || 'square';
    o.frequency.setValueAtTime(freq, when);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide, when + durSec);
    const g = ac.createGain();
    g.gain.setValueAtTime(opt.vol || 0.14, when);
    g.gain.setValueAtTime(opt.vol || 0.14, when + durSec * 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, when + durSec);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + durSec + 0.02);
  }
  function noiseHit(when, durSec, vol, hp) {
    const len = Math.max(1, Math.floor(ac.sampleRate * durSec));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 1800;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + durSec);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(when); src.stop(when + durSec);
  }

  // --- parse a "<dur> <note> ..." string into { midi, steps } events ---
  //  dur letter precedes the note: w|h|q|e (or a rest "R" alone).
  function parseMidi(str) {
    const out = [];
    let pos = 0;
    let i = 0;
    const n = str.length;
    while (i < n) {
      const c = str.charAt(i);
      if (c === ' ' || c === '\n') { i++; continue; }
      // token: optional duration, then "R" or a note
      let dur = null;
      if (c in DURS) { dur = DURS[c]; i++; }
      const c2 = str.charAt(i);
      if (c2 === 'R') {
        out.push({ midi: 0, steps: dur || 4, pos: pos }); pos += dur || 4; i++; continue;
      }
      if (c2 >= 'A' && c2 <= 'G') {
        let j = i + 1;
        if (str.charAt(j) === '#' || str.charAt(j) === 'b') j++;
        if (j >= n || !/[0-9]/.test(str.charAt(j))) { i++; continue; } // malformed
        j++;
        const name = str.slice(i, j);
        const st = dur || 4;
        out.push({ midi: midi(name), steps: st, pos: pos });
        pos += st;
        i = j;
        continue;
      }
      i++;
    }
    return out;
  }


  // --- voice config: type + base volume per channel ---
  const VOICE = {
    lead: { type: 'square', vol: 0.16 },
    arp:  { type: 'square', vol: 0.085 },
    bass: { type: 'triangle', vol: 0.30 }
  };

  function scheduleVoice(events, stepDur, t0, when0) {
    const v = VOICE;
    events.forEach(function (e) {
      const when = when0 + e.pos * stepDur;
      const dur = Math.max(0.02, (e.steps - 0.5) * stepDur);
      if (e.midi > 0) blip(hz(e.midi), when, dur, { type: v.type, vol: v.vol });
    });
  }

  function scheduleDrum(str, stepDur, when0) {
    for (let i = 0; i < 16; i++) {
      const c = str.charAt(i);
      if (!c || c === '.') continue;
      const when = when0 + i * stepDur;
      if (c === 'k') blip(150, when, 0.10, { type: 'triangle', vol: 0.42, slide: 48 });
      else if (c === 's') noiseHit(when, 0.14, 0.16, 1400);
      else if (c === 'h') noiseHit(when, 0.05, 0.07, 6500);
    }
  }

  function buildBar(track, stepDur, when0) {
    // each track's lead/arp/bass is a 32-step phrase; schedule it whole at once.
    const lead = parseMidi(track.lead), arp = parseMidi(track.arp), bass = parseMidi(track.bass);
    scheduleVoice(lead, stepDur, 0, when0);
    scheduleVoice(arp, stepDur, 0, when0);
    scheduleVoice(bass, stepDur, 0, when0);
    scheduleDrum(track.drum.slice(0, 16), stepDur, when0);
    scheduleDrum(track.drum.slice(16, 32), stepDur, when0 + 16 * stepDur);
  }

  // ============================================================
  const player = { track: null, timer: null, nextBarTime: 0, bar: 0 };

  function stopAllVoices() {
    // best-effort quick fade of master so tails don't linger
    if (master && ac) {
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      setTimeout(function () { if (master && ac) master.gain.setValueAtTime(masterVol, ac.currentTime); }, 120);
    }
  }

  function tick() {
    const track = TRACKS[player.track];
    const stepDur = stepSec(track.tempo);
    const barDur = 32 * stepDur; // one 2-bar unit
    const ahead = ac.currentTime + 0.3;
    while (player.nextBarTime < ahead) {
      buildBar(track, stepDur, player.nextBarTime);
      player.nextBarTime += barDur;
      player.bar++;
    }
  }

  function start(trackName) {
    const name = trackName || 'A';
    if (!TRACKS[name]) return;
    ensureCtx();
    if (!ac) return;
    // stop previous
    if (player.timer) { clearInterval(player.timer); player.timer = null; }
    stopAllVoices();
    player.track = name;
    player.bar = 0;
    player.nextBarTime = ac.currentTime + 0.08;
    tick();
    player.timer = setInterval(tick, 100);
  }

  function stop() {
    if (player.timer) { clearInterval(player.timer); player.timer = null; }
    player.track = null;
    stopAllVoices();
  }

  function setVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    if (master && ac) master.gain.value = masterVol;
  }

export const Chiptune = {
  start, stop, tracks: TRACKS, ensure: ensureCtx, setVolume,
};



