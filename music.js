// music.js — pitch/key/chord theory, SVG notation + keyboard rendering, Web Audio playback.
(function (root) {
  'use strict';

  // ---------- Pitches ----------
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SEMI = [0, 2, 4, 5, 7, 9, 11];
  const SYM = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const ACC_CODE = { '-2': 'bb', '-1': 'b', '0': 'n', '1': '#', '2': 'x' };

  const pitch = (l, o, a = 0) => ({ l, o, a });
  function parse(str) {
    const m = /^([A-G])(##|bb|#|b)?(-?\d)$/.exec(str);
    if (!m) throw new Error('bad pitch ' + str);
    return pitch(m[1], +m[3], { '##': 2, '#': 1, b: -1, bb: -2 }[m[2]] || 0);
  }
  const dia = p => p.o * 7 + LETTERS.indexOf(p.l);
  function fromDia(d, a = 0) {
    const o = Math.floor(d / 7);
    return pitch(LETTERS[d - o * 7], o, a);
  }
  const midi = p => 12 * (p.o + 1) + SEMI[LETTERS.indexOf(p.l)] + p.a;
  const name = p => p.l + SYM[p.a];
  const nameOct = p => name(p) + p.o;
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);
  const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const MIDI_NAMES = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const midiName = m => MIDI_NAMES[((m % 12) + 12) % 12];

  // Staff position: 0 = bottom line, 1 = first space, ... 8 = top line.
  const CLEF_BASE = { treble: 30, bass: 18 }; // E4, G2
  const posOf = (p, clef) => dia(p) - CLEF_BASE[clef];
  const atPos = (pos, clef, a = 0) => fromDia(pos + CLEF_BASE[clef], a);

  // ---------- Keys ----------
  const SHARP_ORDER = 'FCGDAEB';
  const FLAT_ORDER = 'BEADGCF';
  const KEY_TONIC = { 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F', 7: 'C',
    '-1': 'F', '-2': 'B', '-3': 'E', '-4': 'A', '-5': 'D', '-6': 'G', '-7': 'C' };
  function keyAlter(letter, k) {
    if (k > 0) return SHARP_ORDER.slice(0, k).includes(letter) ? 1 : 0;
    if (k < 0) return FLAT_ORDER.slice(0, -k).includes(letter) ? -1 : 0;
    return 0;
  }
  const keyTonic = k => pitch(KEY_TONIC[k], 4, keyAlter(KEY_TONIC[k], k));
  const keyName = k => name(keyTonic(k));
  const keyAccLetters = k => (k > 0 ? SHARP_ORDER.slice(0, k) : k < 0 ? FLAT_ORDER.slice(0, -k) : '').split('');
  const KEYSIG_POS = {
    sharp: { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 },
    flat: { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 1 },
  };
  function keySigPositions(k, clef) {
    const table = k > 0 ? KEYSIG_POS.sharp : KEYSIG_POS.flat;
    return keyAccLetters(k).map(l => table[l] - (clef === 'bass' ? 2 : 0));
  }
  function scale(k, octave = 4) {
    const t = KEY_TONIC[k], ti = LETTERS.indexOf(t);
    return Array.from({ length: 8 }, (_, i) => {
      const p = fromDia(octave * 7 + ti + i);
      p.a = keyAlter(p.l, k);
      return p;
    });
  }

  // ---------- Chords ----------
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const QUAL_INT = { M: [4, 7], m: [3, 7], dim: [3, 6], aug: [4, 8] };
  const QUAL_SUFFIX = { M: '', m: 'm', dim: '°', aug: '+' };
  const QUAL_WORD = { M: 'major', m: 'minor', dim: 'diminished', aug: 'augmented' };
  const mod12 = n => ((n % 12) + 12) % 12;

  // Triad on scale degree `deg` (0 = I) of major key k. `q` forces a quality (e.g. 'M').
  function triad(k, deg, q = null, rootDia = null) {
    const ti = LETTERS.indexOf(KEY_TONIC[k]);
    const rl = (ti + deg) % 7;
    const rd = rootDia != null ? rootDia : 4 * 7 + rl;
    const notes = [0, 2, 4].map(i => {
      const p = fromDia(rd + i);
      p.a = keyAlter(p.l, k);
      return p;
    });
    if (q) {
      const want = QUAL_INT[q];
      notes[1].a += want[0] - mod12(midi(notes[1]) - midi(notes[0]));
      notes[2].a += want[1] - mod12(midi(notes[2]) - midi(notes[0]));
    }
    const i3 = mod12(midi(notes[1]) - midi(notes[0]));
    const i5 = mod12(midi(notes[2]) - midi(notes[0]));
    const quality = i3 === 4 ? (i5 === 8 ? 'aug' : 'M') : (i5 === 6 ? 'dim' : 'm');
    let numeral = ROMAN[deg];
    if (quality === 'm' || quality === 'dim') numeral = numeral.toLowerCase();
    if (quality === 'dim') numeral += '°';
    if (quality === 'aug') numeral += '+';
    return { notes, deg, quality, numeral, i3, name: name(notes[0]) + QUAL_SUFFIX[quality] };
  }

  // Stack chord tones (in the given order) upward from octave o.
  function stackUp(order, o) {
    let d = o * 7 + LETTERS.indexOf(order[0].l);
    const out = [fromDia(d, order[0].a)];
    for (let i = 1; i < order.length; i++) {
      let nd = Math.floor(d / 7) * 7 + LETTERS.indexOf(order[i].l);
      while (nd <= d) nd += 7;
      d = nd;
      out.push(fromDia(nd, order[i].a));
    }
    return out;
  }
  // Right-hand triad voicings with the lowest note between C4 and B4.
  function rhCandidates(notes) {
    const out = [];
    for (let inv = 0; inv < 3; inv++) {
      for (let o = 3; o <= 5; o++) {
        const v = stackUp([0, 1, 2].map(i => notes[(i + inv) % 3]), o);
        const lo = midi(v[0]);
        if (lo >= 60 && lo <= 71) out.push({ inv, v });
      }
    }
    return out;
  }
  // Pick the inversion closest to the previous chord (smooth voice leading).
  function voiceRH(notes, prevMidis) {
    const c = rhCandidates(notes).map(x => {
      const ms = x.v.map(midi);
      const cost = prevMidis
        ? ms.reduce((s, m, i) => s + Math.abs(m - prevMidis[i]), 0)
        : Math.abs(ms[0] - 64) + x.inv * 4;
      return { v: x.v, cost };
    });
    c.sort((a, b) => a.cost - b.cost);
    return c[0].v;
  }
  function voiceInversion(notes, inv) {
    return rhCandidates(notes).find(x => x.inv === inv).v;
  }
  // Left-hand root between E2 and D3.
  function lhRoot(p) {
    let d = 2 * 7 + LETTERS.indexOf(p.l);
    if (d < 16) d += 7;
    return fromDia(d, p.a);
  }

  // ---------- Durations ----------
  const BEATS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
  const beats = (dur, dots = 0) => BEATS[dur] * (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1);
  function fmtBeats(b) {
    const whole = Math.floor(b + 1e-9), frac = b - whole;
    const f = Math.abs(frac - 0.5) < 1e-9 ? '½' : Math.abs(frac - 0.25) < 1e-9 ? '¼' : Math.abs(frac - 0.75) < 1e-9 ? '¾' : '';
    return (whole ? String(whole) : f ? '' : '0') + f;
  }

  // ---------- SVG notation ----------
  const S = 10; // one staff space, in SVG units
  const r1 = n => Math.round(n * 10) / 10;
  const INK = 'currentColor';

  function ellipsePath(cx, cy, rx, ry, rot) {
    const t = rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const x1 = cx - rx * c, y1 = cy - rx * s, x2 = cx + rx * c, y2 = cy + rx * s;
    return `M${r1(x1)} ${r1(y1)}A${r1(rx)} ${r1(ry)} ${rot} 1 0 ${r1(x2)} ${r1(y2)}A${r1(rx)} ${r1(ry)} ${rot} 1 0 ${r1(x1)} ${r1(y1)}Z`;
  }
  const line = (x1, y1, x2, y2, w, extra = '') =>
    `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${INK}" stroke-width="${w}"${extra}/>`;

  function noteHead(x, y, dur) {
    if (dur === 'w') return `<path fill="${INK}" fill-rule="evenodd" d="${ellipsePath(x, y, 0.8 * S, 0.52 * S, 0)}${ellipsePath(x, y, 0.4 * S, 0.26 * S, 55)}"/>`;
    if (dur === 'h') return `<path fill="${INK}" fill-rule="evenodd" d="${ellipsePath(x, y, 0.64 * S, 0.45 * S, -20)}${ellipsePath(x, y, 0.5 * S, 0.2 * S, -25)}"/>`;
    return `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${0.64 * S}" ry="${0.45 * S}" transform="rotate(-20 ${r1(x)} ${r1(y)})" fill="${INK}"/>`;
  }

  function flag(sx, ye, up, offset = 0) {
    const k = up ? 1 : -1, y = ye + k * offset;
    const P = (dx, dy) => `${r1(sx + dx * S)} ${r1(y + k * dy * S)}`;
    return `<path fill="${INK}" d="M${P(0, 0)}C${P(0.15, 1.1)} ${P(1.35, 1.3)} ${P(0.95, 2.9)}C${P(1.05, 1.9)} ${P(0.45, 1.55)} ${P(0, 1.45)}Z"/>`;
  }

  function accidental(code, x, y) {
    const P = (dx, dy) => [x + dx * S, y + dy * S];
    const L = (a, b, w) => line(a[0], a[1], b[0], b[1], w);
    if (code === '#') {
      return L(P(-0.22, -1.1), P(-0.22, 1.35), 1.2) + L(P(0.22, -1.35), P(0.22, 1.1), 1.2) +
        L(P(-0.5, -0.22), P(0.5, -0.55), 3.2) + L(P(-0.5, 0.55), P(0.5, 0.22), 3.2);
    }
    if (code === 'b') {
      const [ax, ay] = P(-0.3, 0.55);
      return L(P(-0.3, -2.0), P(-0.3, 0.55), 1.3) +
        `<path fill="none" stroke="${INK}" stroke-width="2" d="M${r1(ax)} ${r1(ay)}C${r1(x + 0.25 * S)} ${r1(y + 0.15 * S)} ${r1(x + 0.75 * S)} ${r1(y - 0.45 * S)} ${r1(x + 0.25 * S)} ${r1(y - 0.55 * S)}C${r1(x - 0.05 * S)} ${r1(y - 0.6 * S)} ${r1(x - 0.3 * S)} ${r1(y - 0.3 * S)} ${r1(x - 0.3 * S)} ${r1(y - 0.2 * S)}"/>`;
    }
    if (code === 'n') {
      return L(P(-0.25, -1.35), P(-0.25, 0.48), 1.2) + L(P(0.25, -0.48), P(0.25, 1.35), 1.2) +
        L(P(-0.25, -0.3), P(0.25, -0.48), 3) + L(P(-0.25, 0.48), P(0.25, 0.3), 3);
    }
    return '';
  }

  function trebleClef(cx, gy) {
    const P = (dx, dy) => `${r1(cx + dx * S)} ${r1(gy + dy * S)}`;
    const d = `M${P(-0.05, 0.1)}C${P(-0.1, -0.6)} ${P(0.75, -0.9)} ${P(0.85, -0.2)}` +
      `C${P(0.95, 0.6)} ${P(0.1, 1.15)} ${P(-0.35, 1.05)}` +
      `C${P(-1.1, 0.85)} ${P(-1.05, -0.4)} ${P(-0.45, -1.1)}` +
      `C${P(0.2, -1.8)} ${P(0.75, -2.6)} ${P(0.7, -3.6)}` +
      `C${P(0.65, -4.4)} ${P(0.05, -4.6)} ${P(-0.05, -3.8)}` +
      `C${P(-0.15, -3.0)} ${P(0.25, 0.5)} ${P(0.3, 1.6)}` +
      `L${P(0.33, 2.0)}C${P(0.36, 2.6)} ${P(-0.3, 2.7)} ${P(-0.45, 2.25)}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${0.2 * S}" stroke-linecap="round"/>` +
      `<circle cx="${r1(cx - 0.33 * S)}" cy="${r1(gy + 2.2 * S)}" r="${0.3 * S}" fill="${INK}"/>`;
  }
  function bassClef(cx, fy) {
    const P = (dx, dy) => `${r1(cx + dx * S)} ${r1(fy + dy * S)}`;
    const d = `M${P(-0.62, 0)}C${P(-0.62, -1.15)} ${P(1.35, -1.35)} ${P(1.3, 0.15)}C${P(1.25, 1.45)} ${P(0.15, 2.35)} ${P(-0.8, 2.85)}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${0.26 * S}" stroke-linecap="round"/>` +
      `<circle cx="${r1(cx - 0.55 * S)}" cy="${r1(fy + 0.05 * S)}" r="${0.34 * S}" fill="${INK}"/>` +
      `<circle cx="${r1(cx + 1.95 * S)}" cy="${r1(fy - 0.5 * S)}" r="${0.16 * S}" fill="${INK}"/>` +
      `<circle cx="${r1(cx + 1.95 * S)}" cy="${r1(fy + 0.5 * S)}" r="${0.16 * S}" fill="${INK}"/>`;
  }

  function rest(dur, x, Y, dots) {
    const y0 = Y(4); // middle line
    const P = (dx, dy) => `${r1(x + dx * S)} ${r1(y0 + dy * S)}`;
    let out = '';
    if (dur === 'w') out = `<rect x="${r1(x - 0.6 * S)}" y="${r1(Y(6))}" width="${1.2 * S}" height="${0.5 * S}" fill="${INK}"/>`;
    else if (dur === 'h') out = `<rect x="${r1(x - 0.6 * S)}" y="${r1(Y(4) - 0.5 * S)}" width="${1.2 * S}" height="${0.5 * S}" fill="${INK}"/>`;
    else if (dur === 'q') out = `<path fill="none" stroke="${INK}" stroke-width="${0.28 * S}" stroke-linejoin="round" stroke-linecap="round" d="M${P(-0.35, -1.5)}L${P(0.4, -0.6)}L${P(-0.2, 0.1)}L${P(0.4, 0.8)}Q${P(-0.45, 0.55)} ${P(-0.05, 1.45)}"/>`;
    else if (dur === 'e') out = `<circle cx="${r1(x - 0.25 * S)}" cy="${r1(y0 - 0.55 * S)}" r="${0.24 * S}" fill="${INK}"/>` +
      `<path fill="none" stroke="${INK}" stroke-width="1.5" d="M${P(-0.4, -0.5)}Q${P(0.05, -0.15)} ${P(0.45, -0.75)}L${P(0, 1.0)}"/>`;
    else if (dur === 's') out = `<circle cx="${r1(x - 0.25 * S)}" cy="${r1(y0 - 0.55 * S)}" r="${0.24 * S}" fill="${INK}"/>` +
      `<circle cx="${r1(x - 0.5 * S)}" cy="${r1(y0 + 0.35 * S)}" r="${0.24 * S}" fill="${INK}"/>` +
      `<path fill="none" stroke="${INK}" stroke-width="1.5" d="M${P(-0.4, -0.5)}Q${P(0.05, -0.15)} ${P(0.45, -0.75)}L${P(-0.15, 1.9)}M${P(-0.65, 0.4)}Q${P(-0.2, 0.75)} ${P(0.2, 0.15)}"/>`;
    if (dots) out += `<circle cx="${r1(x + 0.95 * S)}" cy="${r1(Y(5))}" r="${0.18 * S}" fill="${INK}"/>`;
    return out;
  }

  // Accidental columns so stacked accidentals don't collide.
  function accLayout(notes) {
    const placed = [];
    const sorted = notes.filter(n => n._acc).sort((a, b) => b._pos - a._pos);
    for (const n of sorted) {
      let col = 0;
      while (placed.some(q => q.col === col && Math.abs(q.n._pos - n._pos) < 6)) col++;
      placed.push({ n, col });
      n._accCol = col;
    }
    return placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 0;
  }

  // Decide which accidentals to print: key signature + accidentals carried through the measure.
  function resolveAccidentals(cols, key, staves) {
    const state = {};
    staves.forEach(s => (state[s] = {}));
    for (const c of cols) {
      if (c.bar) { staves.forEach(s => (state[s] = {})); continue; }
      for (const st of staves) {
        const it = c[st];
        if (!it || it.rest) continue;
        for (const n of it.notes) {
          const id = n.p.l + n.p.o;
          const cur = id in state[st] ? state[st][id] : keyAlter(n.p.l, key);
          if (n.acc === undefined) n._acc = n.p.a === cur ? null : ACC_CODE[n.p.a];
          else n._acc = n.acc || null;
          state[st][id] = n.p.a;
        }
      }
    }
  }

  function renderScore(spec) {
    const sys = spec.system || 'treble';
    const staves = sys === 'grand' ? ['treble', 'bass'] : [sys];
    const key = spec.key || 0;
    const TOP = spec.top != null ? spec.top : 6, BOT = spec.bottom != null ? spec.bottom : 6, GAP = 6;
    const top = {};
    if (sys === 'grand') { top.treble = TOP; top.bass = TOP + 4 + GAP; } else top[sys] = TOP;
    const lastStaff = staves[staves.length - 1];
    const H = (top[lastStaff] + 4 + BOT) * S;
    const Y = (pos, clef) => (top[clef] + 4 - pos / 2) * S;
    const cols = spec.cols || [];

    resolveAccidentals(cols, key, staves);
    for (const c of cols) for (const st of staves) {
      const it = c[st];
      if (it && !it.rest) for (const n of it.notes) n._pos = posOf(n.p, st);
    }

    // Header: clef, key signature, time signature
    const x0 = sys === 'grand' ? 2.4 : 0.8;
    const nAcc = Math.abs(key);
    const ksX = x0 + 3.4;
    let hx = ksX + nAcc * 1.0 + (nAcc ? 0.5 : 0);
    const tsX = hx + 1.1;
    if (spec.time) hx += 2.6;
    const start = hx + 0.6;

    // Column widths (in staff spaces)
    for (const c of cols) {
      if (c.bar) { c._w = 1.6; continue; }
      if (c.blank) { c._w = 4.6; c._hx = 2.3; continue; }
      let minB = Infinity, acc = 0, dot = 0;
      for (const st of staves) {
        const it = c[st];
        if (!it) continue;
        minB = Math.min(minB, BEATS[it.dur]);
        if (it.dots) dot = 0.7;
        if (!it.rest) acc = Math.max(acc, accLayout(it.notes));
      }
      if (minB === Infinity) minB = 1;
      if (c.adv != null) minB = Math.min(minB, c.adv);
      const base = minB >= 4 ? 5.2 : minB >= 2 ? 4.2 : minB >= 1 ? 3.4 : minB >= 0.5 ? 2.8 : 2.4;
      const accW = acc ? 0.5 + acc * 1.15 : 0;
      c._hx = accW + 1.2;
      c._w = base + accW + dot + (c.pad || 0);
    }
    const contentW = cols.reduce((s, c) => s + c._w, 0);
    let total = start + contentW + 0.8;
    let offset = 0;
    const minW = spec.minWidth || 0;
    if (total < minW) { if (spec.center) offset = (minW - total) / 2; total = minW; }
    let cx = start + offset;
    for (const c of cols) { c._x = cx; cx += c._w; }
    const endX = total - 0.3;

    // Beams
    const beamDraw = [];
    for (const st of staves) {
      const groups = {};
      for (const c of cols) {
        const it = c[st];
        if (it && !it.rest && it.beam != null) (groups[it.beam] = groups[it.beam] || []).push({ it, x: (c._x + c._hx) * S });
      }
      for (const g of Object.values(groups)) {
        const all = g.flatMap(m => m.it.notes.map(n => n._pos));
        const mean = all.reduce((a, b) => a + b, 0) / all.length;
        const dir = g[0].it.stem || (mean >= 4 ? 'down' : 'up');
        const extra = g[0].it.dur === 's' ? 0.5 : 0;
        let endY;
        if (dir === 'up') endY = Math.min(Y(4, st), ...g.map(m => Y(Math.max(...m.it.notes.map(n => n._pos)), st) - (3.3 + extra) * S));
        else endY = Math.max(Y(4, st), ...g.map(m => Y(Math.min(...m.it.notes.map(n => n._pos)), st) + (3.3 + extra) * S));
        g.forEach(m => (m.it._stem = { dir, endY }));
        const off = dir === 'up' ? 0.58 * S : -0.58 * S;
        const xa = g[0].x + off, xb = g[g.length - 1].x + off;
        const th = 0.5 * S, k = dir === 'up' ? 1 : -1;
        let b = `<path fill="${INK}" d="M${r1(xa - 0.6)} ${r1(endY)}H${r1(xb + 0.6)}V${r1(endY + k * th)}H${r1(xa - 0.6)}Z"/>`;
        if (g[0].it.dur === 's') {
          const y2 = endY + k * 0.8 * S;
          b += `<path fill="${INK}" d="M${r1(xa - 0.6)} ${r1(y2)}H${r1(xb + 0.6)}V${r1(y2 + k * th)}H${r1(xa - 0.6)}Z"/>`;
        }
        beamDraw.push({ st, svg: b, color: g[0].it.color });
      }
    }

    let out = '';
    // Staff lines
    for (const st of staves) {
      for (let i = 0; i < 5; i++) {
        const y = (top[st] + i) * S;
        out += `<line x1="${x0 * S}" y1="${y}" x2="${r1(endX * S)}" y2="${y}" stroke="#7a7a7a" stroke-width="1"/>`;
      }
    }
    const sysTop = top[staves[0]] * S, sysBot = (top[lastStaff] + 4) * S;
    out += `<g color="#1d1d1f">`;
    out += line(x0 * S, sysTop, x0 * S, sysBot, 1.2);
    if (sys === 'grand') {
      const xb = (x0 - 0.7) * S, mid = (sysTop + sysBot) / 2, h = sysBot - sysTop;
      out += `<path fill="none" stroke="${INK}" stroke-width="${0.28 * S}" stroke-linecap="round" d="M${r1(xb)} ${r1(sysTop)}C${r1(xb - 1.2 * S)} ${r1(sysTop + h * 0.15)} ${r1(xb + 0.3 * S)} ${r1(mid - h * 0.25)} ${r1(xb - 0.8 * S)} ${r1(mid)}C${r1(xb + 0.3 * S)} ${r1(mid + h * 0.25)} ${r1(xb - 1.2 * S)} ${r1(sysBot - h * 0.15)} ${r1(xb)} ${r1(sysBot)}"/>`;
    }
    for (const st of staves) {
      if (st === 'treble') out += trebleClef((x0 + 1.4) * S, Y(2, st));
      else out += bassClef((x0 + 0.95) * S, Y(6, st));
      const kp = keySigPositions(key, st);
      kp.forEach((pos, i) => (out += accidental(key > 0 ? '#' : 'b', (ksX + 0.5 + i * 1.0) * S, Y(pos, st))));
      if (spec.time) {
        const font = `font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${2.3 * S}" text-anchor="middle" dominant-baseline="central" fill="${INK}"`;
        out += `<text x="${r1(tsX * S)}" y="${r1(Y(6, st))}" ${font}>${spec.time[0]}</text>`;
        out += `<text x="${r1(tsX * S)}" y="${r1(Y(2, st))}" ${font}>${spec.time[1]}</text>`;
      }
    }
    out += `</g>`;

    // Columns
    cols.forEach((c, i) => {
      out += `<g class="col" data-i="${i}"${c.m != null ? ` data-m="${c.m}"` : ''} color="#1d1d1f">`;
      if (c.bar) {
        const bx = (c._x + 0.6) * S;
        if (c.bar === 'end' || (i === cols.length - 1 && spec.endBar)) {
          out += line(bx - 4, sysTop, bx - 4, sysBot, 1.2) + `<rect x="${r1(bx)}" y="${sysTop}" width="4" height="${sysBot - sysTop}" fill="${INK}"/>`;
        } else out += line(bx, sysTop, bx, sysBot, 1.2);
      } else if (c.blank) {
        const st = staves[0];
        const bx = c._x * S + 0.5 * S;
        out += `<rect x="${r1(bx)}" y="${r1(Y(10, st))}" width="${3.6 * S}" height="${r1(Y(-2, st) - Y(10, st))}" rx="6" fill="rgba(59,91,219,0.07)" stroke="#3b5bdb" stroke-width="1.5" stroke-dasharray="5 4"/>`;
        out += `<text x="${r1(bx + 1.8 * S)}" y="${r1(Y(4, st))}" font-size="${2.4 * S}" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#3b5bdb">?</text>`;
      } else {
        const hx = (c._x + c._hx) * S;
        for (const st of staves) {
          const it = c[st];
          if (!it) continue;
          const y = pos => Y(pos, st);
          const body = it.rest ? rest(it.dur, hx, y, it.dots) : drawNotes(it, hx, y);
          out += it.color ? `<g color="${it.color}">${body}</g>` : body;
        }
        const font = `font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" fill="#444"`;
        if (c.above) out += `<text x="${r1(hx)}" y="${r1((top[staves[0]] - 3.6) * S)}" font-size="${1.5 * S}" font-weight="700" ${font}>${c.above}</text>`;
        if (c.below) out += `<text x="${r1(hx)}" y="${r1((top[lastStaff] + 4 + 3.8) * S)}" font-size="${1.45 * S}" font-weight="600" ${font}>${c.below}</text>`;
      }
      out += `</g>`;
    });
    for (const b of beamDraw) out += `<g color="${b.color || '#1d1d1f'}">${b.svg}</g>`;

    // Clickable staff positions (place-the-note questions, explore cards)
    if (spec.click) {
      const ck = spec.click;
      const targets = Array.isArray(ck) ? ck : [ck];
      const gx = ((start + total) / 2) * S;
      for (const t of targets) {
        for (let pos = t.pmin; pos <= t.pmax; pos++) {
          const y = Y(pos, t.staff);
          out += `<rect class="hit" data-staff="${t.staff}" data-pos="${pos}" data-y="${r1(y)}" x="${r1(start * S - S)}" y="${r1(y - S / 4)}" width="${r1((total - start) * S)}" height="${S / 2}" fill="transparent"/>`;
        }
      }
      out += `<g class="ghost" data-x="${r1(gx)}" color="#3b5bdb" opacity="0.45" style="display:none"></g>`;
    }

    const W = total * S;
    const scale = spec.scale || 1.6;
    return `<svg class="score" viewBox="0 0 ${r1(W)} ${H}" style="max-width:${Math.round(W * scale)}px" xmlns="http://www.w3.org/2000/svg" role="img">${out}</svg>`;
  }

  function drawNotes(it, x, Y) {
    const ns = it.notes.slice().sort((a, b) => a._pos - b._pos);
    const lo = ns[0]._pos, hi = ns[ns.length - 1]._pos;
    let out = '';
    const lw = (it.dur === 'w' ? 1.15 : 1.0) * S;
    for (let k = -2; k >= lo; k -= 2) out += `<line x1="${r1(x - lw)}" y1="${r1(Y(k))}" x2="${r1(x + lw)}" y2="${r1(Y(k))}" stroke="#1d1d1f" stroke-width="1.2"/>`;
    for (let k = 10; k <= hi; k += 2) out += `<line x1="${r1(x - lw)}" y1="${r1(Y(k))}" x2="${r1(x + lw)}" y2="${r1(Y(k))}" stroke="#1d1d1f" stroke-width="1.2"/>`;
    for (const n of ns) {
      let g = '';
      if (n._acc) g += accidental(n._acc, x - (1.55 + (n._accCol || 0) * 1.15) * S, Y(n._pos));
      g += noteHead(x, Y(n._pos), it.dur);
      if (it.dots) {
        const dy = n._pos % 2 === 0 ? -0.5 * S : 0;
        for (let d = 0; d < it.dots; d++) g += `<circle cx="${r1(x + (it.dur === 'w' ? 1.35 : 1.1) * S + d * 0.55 * S)}" cy="${r1(Y(n._pos) + dy)}" r="${0.18 * S}" fill="${INK}"/>`;
      }
      out += n.color ? `<g color="${n.color}">${g}</g>` : g;
    }
    if (it.dur !== 'w') {
      const st = it._stem;
      const dir = st ? st.dir : it.stem || ((lo + hi) / 2 >= 4 ? 'down' : 'up');
      const extra = it.dur === 's' ? 0.5 : 0;
      if (dir === 'up') {
        const sx = x + 0.58 * S;
        const ye = st ? st.endY : Math.min(Y(hi) - (3.5 + extra) * S, Y(4));
        out += line(sx, Y(lo), sx, ye, 1.3);
        if (!st && (it.dur === 'e' || it.dur === 's')) { out += flag(sx, ye, true); if (it.dur === 's') out += flag(sx, ye, true, 0.85 * S); }
      } else {
        const sx = x - 0.58 * S;
        const ye = st ? st.endY : Math.max(Y(lo) + (3.5 + extra) * S, Y(4));
        out += line(sx, Y(hi), sx, ye, 1.3);
        if (!st && (it.dur === 'e' || it.dur === 's')) { out += flag(sx, ye, false); if (it.dur === 's') out += flag(sx, ye, false, 0.85 * S); }
      }
    }
    return out;
  }

  // Draw a ghost note (with ledger lines) for hover previews.
  function ghostNote(x, pos, Y) {
    let out = '';
    for (let k = -2; k >= pos; k -= 2) out += `<line x1="${x - S}" y1="${Y(k)}" x2="${x + S}" y2="${Y(k)}" stroke="currentColor" stroke-width="1.2"/>`;
    for (let k = 10; k <= pos; k += 2) out += `<line x1="${x - S}" y1="${Y(k)}" x2="${x + S}" y2="${Y(k)}" stroke="currentColor" stroke-width="1.2"/>`;
    return out + noteHead(x, Y(pos), 'w');
  }

  // ---------- Keyboard ----------
  function renderKeyboard(o = {}) {
    let lo = o.lo != null ? o.lo : 48, hi = o.hi != null ? o.hi : 72;
    if (isBlack(lo)) lo--;
    if (isBlack(hi)) hi++;
    // shortKeys: shorter keys for short (landscape phone) screens. handH: how much of the hands to show.
    const WW = 24, WH = o.shortKeys ? 84 : 120, BW = 15, BH = o.shortKeys ? 52 : 76;
    const marks = o.marks || {}, labels = o.labels || {};
    const whites = [];
    for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
    const xOf = {};
    whites.forEach((m, i) => (xOf[m] = i * WW));
    let w = '', b = '';
    for (let m = lo; m <= hi; m++) {
      const mark = marks[m];
      const lab = labels[m] != null ? labels[m] : (o.cLabels !== false && m % 12 === 0 ? 'C' + (m / 12 - 1) : '');
      if (!isBlack(m)) {
        w += `<g class="key" data-midi="${m}"><rect x="${xOf[m] + 0.5}" y="0.5" width="${WW - 1}" height="${WH}" rx="3" fill="${mark || '#fff'}" stroke="#555" stroke-width="1"/>` +
          (lab ? `<text x="${xOf[m] + WW / 2}" y="${WH - 9}" font-size="${String(lab).length > 3 ? 7 : 9}" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle" fill="${mark ? '#fff' : '#666'}">${lab}</text>` : '') + `</g>`;
      } else {
        const x = xOf[m - 1] + WW - BW / 2;
        b += `<g class="key black" data-midi="${m}"><rect x="${x}" y="0.5" width="${BW}" height="${BH}" rx="2" fill="${mark || '#222'}" stroke="#111" stroke-width="1"/>` +
          (lab ? `<text x="${x + BW / 2}" y="${BH - 8}" font-size="7" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle" fill="#fff">${lab}</text>` : '') + `</g>`;
      }
    }
    const W = whites.length * WW + 1;
    const hands = o.hands || [];
    // Centre x of any key, even one just outside the drawn range.
    const WB = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
    const wb = m => Math.floor(m / 12) * 7 + WB[mod12(m)];
    const kx = m => (wb(m) - wb(lo)) * WW + (isBlack(m) ? 0 : WW / 2);
    let hs = '';
    hands.filter(h => h.side === 'left').concat(hands.filter(h => h.side !== 'left')).forEach(h => (hs += handSvg(h, kx, WH, BH)));
    const H = WH + 1 + (hands.length ? (o.handH || HAND_H) : 0);
    return `<svg class="keyboard${hands.length ? ' withhands' : ''}" viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W * 1.25)}px;--whites:${whites.length}" xmlns="http://www.w3.org/2000/svg">${w}${b}${hs}</svg>`;
  }

  // ---------- Hands (top-down silhouette, fingertips on the keys) ----------
  const HAND_H = 128;
  function handSvg(h, kx, WH, BH) {
    const R = h.side !== 'left', dir = R ? 1 : -1;
    const T = [null];
    for (let f = 1; f <= 5; f++) { const m = h.keys[f]; T.push([kx(m), isBlack(m) ? BH - 15 : WH - 22]); }
    const c = (T[2][0] + T[3][0] + T[4][0] + T[5][0]) / 4;
    const Y0 = WH + 46;
    const KY = { 2: 2, 3: -3, 4: 0, 5: 8 };
    const K = [null, [c - dir * 44, Y0 + 30]];
    for (let f = 2; f <= 5; f++) K.push([c + dir * (f - 3.5) * 19, Y0 + KY[f]]);
    const r = n => Math.round(n * 10) / 10;
    let body = `<rect x="${r(c - 45)}" y="${r(Y0 - 10)}" width="90" height="84" rx="30"/>` +
      `<rect x="${r(c - 33)}" y="${r(Y0 + 50)}" width="66" height="${HAND_H}" rx="14"/>`;
    for (let f = 1; f <= 5; f++) {
      body += `<line x1="${r(K[f][0])}" y1="${r(K[f][1])}" x2="${r(T[f][0])}" y2="${r(T[f][1])}" stroke-width="${f === 1 ? 19 : f === 5 ? 14 : 16}" stroke-linecap="round"/>`;
    }
    let tips = '';
    for (let f = 1; f <= 5; f++) {
      const col = h.active && h.active[f];
      tips += `<circle cx="${r(T[f][0])}" cy="${r(T[f][1])}" r="8.5" fill="${col || '#fff'}" stroke="${col ? '#fff' : '#9a9a9a'}" stroke-width="${col ? 2 : 1.2}" opacity="${col ? 1 : 0.85}"/>` +
        `<text x="${r(T[f][0])}" y="${r(T[f][1] + 3.6)}" font-size="10" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" fill="${col ? '#fff' : '#555'}">${f}</text>`;
    }
    return `<g class="hand ${R ? 'rh' : 'lh'}" pointer-events="none"><g opacity="0.3" fill="#1d1d1f" stroke="#1d1d1f">${body}</g>${tips}</g>`;
  }

  // ---------- Fingering ----------
  // groups: in time order, the pitches one hand starts at each moment ([] = nothing new).
  // The hand stays in a five-finger position until a note falls outside it, then moves.
  // Returns per group: { keys: {1..5: midi under each finger}, fingers: [{ m, f }] } (null before any note).
  function planHand(groups, side) {
    const R = side !== 'left';
    const segs = [], segOf = [];
    let cur = null;
    groups.forEach((g, i) => {
      if (g.length) {
        const ds = g.map(dia), lo = Math.min(...ds), hi = Math.max(...ds);
        if (cur && Math.max(cur.hi, hi) - Math.min(cur.lo, lo) <= 4) { cur.lo = Math.min(cur.lo, lo); cur.hi = Math.max(cur.hi, hi); cur.ps.push(...g); }
        else { cur = { lo, hi, ps: g.slice() }; segs.push(cur); }
      }
      segOf[i] = cur;
    });
    if (!segs.length) return groups.map(() => null);
    for (let i = 0; i < segOf.length && !segOf[i]; i++) segOf[i] = segs[0];
    segs.forEach(s => {
      const keyAt = d => { const p = s.ps.find(q => dia(q) === d); return p ? midi(p) : midi(fromDia(d)); };
      const fOf = {}, dOf = {};
      if (s.hi - s.lo <= 4) {
        for (let f = 1; f <= 5; f++) { const d = R ? s.lo + f - 1 : s.lo + 5 - f; dOf[f] = d; fOf[d] = f; }
      } else { // a single chord wider than five notes: spread the fingers across it
        const ds = [...new Set(s.ps.map(dia))].sort((a, b) => a - b);
        ds.forEach((d, k) => { const f0 = Math.round(1 + k * 4 / (ds.length - 1)); const f = R ? f0 : 6 - f0; dOf[f] = d; fOf[d] = f; });
        for (let f = 1; f <= 5; f++) {
          if (dOf[f] != null) continue;
          let a = f - 1, b = f + 1;
          while (dOf[a] == null) a--;
          while (dOf[b] == null) b++;
          dOf[f] = Math.round(dOf[a] + (dOf[b] - dOf[a]) * (f - a) / (b - a));
        }
      }
      s.keys = {};
      for (let f = 1; f <= 5; f++) s.keys[f] = keyAt(dOf[f]);
      s.fOf = fOf;
    });
    return groups.map((g, i) => {
      const s = segOf[i];
      return { seg: s, keys: s.keys, fingers: g.map(p => ({ m: midi(p), f: s.fOf[dia(p)] })) };
    });
  }

  // ---------- Timing + audio ----------
  function timeline(cols) {
    let t = 0;
    const ev = [];
    cols.forEach((c, i) => {
      if (c.bar) return;
      ev.push({ t, col: i, mark: true });
      if (c.blank) { t += c.blank; return; }
      let adv = null;
      for (const st of ['treble', 'bass']) {
        const it = c[st];
        if (!it) continue;
        const b = beats(it.dur, it.dots);
        if (!it.rest) ev.push({ t, b, midis: it.notes.map(n => midi(n.p)) });
        adv = adv == null ? b : Math.min(adv, b);
      }
      if (c.adv != null) adv = c.adv; // explicit gap to the next column (hands with different rhythms)
      t += adv || 0;
    });
    return { ev, total: t };
  }

  const Sound = {
    ctx: null, master: null,
    ac() {
      if (!this.ctx) {
        const C = root.AudioContext || root.webkitAudioContext;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    bus() {
      const c = this.ac(), g = c.createGain();
      g.connect(this.master);
      return g;
    },
    tone(m, t, dur, vel = 0.55, dest = null) {
      const c = this.ac();
      if (t == null) t = c.currentTime + 0.02;
      const f0 = freq(m);
      const g = c.createGain(), lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(9000, f0 * 8), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(400, f0 * 2), t + dur + 0.3);
      const o1 = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
      o1.type = 'triangle'; o1.frequency.value = f0;
      o2.type = 'sine'; o2.frequency.value = f0 * 2; g2.gain.value = 0.22;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest || this.master);
      const peak = vel * 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(peak * 0.35, t + Math.max(0.06, dur * 0.9));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.4); o2.stop(t + dur + 0.4);
    },
    click(t, accent, dest = null) {
      const c = this.ac(), o = c.createOscillator(), g = c.createGain();
      o.type = 'square';
      o.frequency.value = accent ? 1760 : 1320;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.connect(g); g.connect(dest || this.master);
      o.start(t); o.stop(t + 0.05);
    },
    chime(ok) {
      const c = this.ac(), t = c.currentTime + 0.01;
      (ok ? [76, 83] : [52, 51]).forEach((m, i) => this.tone(m, t + i * 0.09, 0.12, 0.3));
    },
  };

  // iOS Safari only starts audio from a tap/click (not from pointerdown), and mutes Web Audio
  // when the ring/silent switch is off unless the page asks for "playback" audio.
  if (typeof document !== 'undefined') {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    const unlock = () => {
      try {
        const c = Sound.ac(), b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
        src.buffer = b; src.connect(c.destination); src.start(0);
        if (c.state === 'running') ['touchend', 'click', 'keydown'].forEach(t => document.removeEventListener(t, unlock, true));
      } catch (e) { /* no audio */ }
    };
    ['touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlock, true));
  }

  function playCols(cols, opt = {}) {
    const bpm = opt.bpm || 100, spb = 60 / bpm;
    const c = Sound.ac(), bus = Sound.bus();
    const t0 = c.currentTime + 0.08;
    const { ev, total } = timeline(cols);
    const timers = [];
    for (const e of ev) {
      if (e.midis) e.midis.forEach(m => Sound.tone(m, t0 + e.t * spb, Math.max(0.15, e.b * spb * 0.95), opt.vel || 0.55, bus));
      if (e.mark && opt.onCol) timers.push(setTimeout(() => opt.onCol(e.col), (t0 - c.currentTime + e.t * spb) * 1000));
    }
    if (opt.clicks) {
      const bpb = opt.beatsPerBar || 4;
      for (let b = 0; b < total - 1e-6; b++) Sound.click(t0 + b * spb, b % bpb === 0, bus);
    }
    const endMs = (t0 - c.currentTime + total * spb) * 1000;
    if (opt.onEnd) timers.push(setTimeout(opt.onEnd, endMs + (opt.tail != null ? opt.tail : 250)));
    let stopped = false;
    return {
      duration: total * spb,
      stop() {
        if (stopped) return;
        stopped = true;
        timers.forEach(clearTimeout);
        const now = c.currentTime;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0, now + 0.05);
        setTimeout(() => bus.disconnect(), 200);
      },
    };
  }

  const MT = {
    LETTERS, SEMI, SYM, ACC_CODE, ROMAN, QUAL_WORD, pitch, parse, dia, fromDia, midi, name, nameOct, freq, isBlack, midiName,
    CLEF_BASE, posOf, atPos, SHARP_ORDER, FLAT_ORDER, KEY_TONIC, keyAlter, keyTonic, keyName, keyAccLetters, keySigPositions,
    scale, triad, voiceRH, voiceInversion, lhRoot, BEATS, beats, fmtBeats, mod12,
    S, renderScore, renderKeyboard, planHand, ghostNote, timeline, Sound, playCols,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MT;
  else root.MT = MT;
})(typeof window !== 'undefined' ? window : globalThis);
