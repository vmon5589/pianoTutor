// levels.js — the ten levels: lesson cards and question generators.
(function (root) {
  'use strict';
  const MT = root.MT || (typeof require !== 'undefined' ? require('./music.js') : null);
  const { LETTERS, atPos, posOf, midi, name, keyName, keyAlter, keyAccLetters, triad, fromDia, dia, SYM, fmtBeats, beats } = MT;

  const HL = '#3b5bdb', OK = '#2b8a3e', BAD = '#e03131';

  // ---------- helpers ----------
  const rnd = () => Math.random();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const uniq = a => [...new Set(a)];
  function choicesFrom(correct, pool, n = 4, keepOrder = false) {
    const others = shuffle(uniq(pool).filter(x => x !== correct)).slice(0, n - 1);
    const all = [correct, ...others];
    return keepOrder ? pool.filter(x => all.includes(x)) : shuffle(all);
  }
  let beamId = 0;
  const N = (p, acc, color) => { const n = { p }; if (acc !== undefined) n.acc = acc; if (color) n.color = color; return n; };
  const item = (notes, dur = 'w', extra = {}) => Object.assign({ notes, dur }, extra);
  const restItem = (dur, dots = 0) => ({ notes: [], dur, dots, rest: true });
  const col = (clef, it, extra = {}) => Object.assign({ [clef]: it }, extra);
  const single = (clef, p, opts = {}) => col(clef, item([N(p, opts.acc, opts.noteColor)], opts.dur || 'w', opts.color ? { color: opts.color } : {}));
  const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const accVal = { '#': 1, b: -1, n: 0 };
  const HAND = { treble: 'right hand', bass: 'left hand' };

  // ---------- staff explanations ----------
  const LINE_NAMES = { treble: 'E G B D F', bass: 'G B D F A' };
  const SPACE_NAMES = { treble: 'F A C E', bass: 'A C E G' };
  const LINE_MNEMO = { treble: '<i>Every Good Boy Does Fine</i>', bass: '<i>Good Boys Do Fine Always</i>' };
  const SPACE_MNEMO = { treble: 'they spell <i>FACE</i>', bass: '<i>All Cows Eat Grass</i>' };

  function describePos(pos) {
    if (pos >= 0 && pos <= 8) return pos % 2 === 0 ? `line ${pos / 2 + 1}` : `space ${(pos + 1) / 2}`;
    if (pos < 0) {
      if (pos === -1) return 'just below the staff';
      return pos % 2 === 0 ? `the ${ord(-pos / 2)} ledger line below the staff` : `below the ${ord((-pos - 1) / 2)} ledger line`;
    }
    if (pos === 9) return 'just above the staff';
    return pos % 2 === 0 ? `the ${ord((pos - 8) / 2)} ledger line above the staff` : `above the ${ord((pos - 9) / 2)} ledger line`;
  }

  function explainPos(clef, pos) {
    const p = atPos(pos, clef);
    let s;
    if (pos >= 0 && pos <= 8) {
      s = pos % 2 === 0
        ? `It sits on line ${pos / 2 + 1}, counting up from the bottom. The ${clef} lines are ${LINE_NAMES[clef]}: ${LINE_MNEMO[clef]}.`
        : `It sits in space ${(pos + 1) / 2}, counting up from the bottom. The ${clef} spaces are ${SPACE_NAMES[clef]}: ${SPACE_MNEMO[clef]}.`;
    } else if (pos < 0) {
      const steps = [];
      for (let k = 0; k >= pos; k--) steps.push(atPos(k, clef).l);
      s = `It's ${describePos(pos)}. Count down from the bottom line: ${steps.join(' → ')}.`;
    } else {
      const steps = [];
      for (let k = 8; k <= pos; k++) steps.push(atPos(k, clef).l);
      s = `It's ${describePos(pos)}. Count up from the top line: ${steps.join(' → ')}.`;
    }
    if (midi(p) === 60) s += ' This is <b>middle C</b>, the C in the middle of the piano, shared by both hands.';
    return `<b>${p.l}</b>. ${s}`;
  }

  // ---------- question builders ----------
  function nameQ(clef, pos, opts = {}) {
    const p = atPos(pos, clef);
    const cols = [single(clef, p)];
    return {
      type: 'letters', prompt: opts.prompt || 'Name this note',
      score: { system: clef, cols, minWidth: 18, center: true },
      answer: p.l, explain: explainPos(clef, pos), sig: `n${clef}${pos}`,
    };
  }

  function placeQ(clef, letter, pmin, pmax) {
    const positions = [];
    for (let pos = pmin; pos <= pmax; pos++) if (atPos(pos, clef).l === letter) positions.push(pos);
    return {
      type: 'place', prompt: `Tap the ${clef} staff where <b>${letter}</b> goes`,
      score: { system: clef, cols: [], minWidth: 18, center: true, click: { staff: clef, pmin, pmax } },
      place: { clef, positions },
      check: a => atPos(a.pos, clef).l === letter,
      answerText: letter,
      explain: `${letter} is on ${positions.map(describePos).join(', or ')}.`,
      sig: `p${clef}${letter}`,
    };
  }

  function placeExactQ(clef, pos, label, pmin, pmax) {
    return {
      type: 'place', prompt: `Tap the ${clef} staff where <b>${label}</b> goes`,
      score: { system: clef, cols: [], minWidth: 18, center: true, click: { staff: clef, pmin, pmax } },
      place: { clef, positions: [pos] },
      check: a => a.pos === pos,
      answerText: label,
      explain: `${label[0].toUpperCase() + label.slice(1)} is on ${describePos(pos)} of the ${clef} staff.`,
      sig: `px${clef}${pos}`,
    };
  }

  function pianoQ(system, clef, p, opts = {}) {
    const m = midi(p);
    const it = item([N(p, undefined, system === 'grand' ? HL : undefined)], 'w');
    return {
      type: 'piano', prompt: opts.prompt || 'Find this note on the keyboard',
      score: { system, cols: [col(clef, it)], minWidth: 18, center: true },
      keyboard: { lo: opts.lo || 48, hi: opts.hi || 84 },
      answer: m, check: a => a === m, answerText: name(p),
      explain: opts.explain || `${explainPos(clef, posOf(p, clef))} The ${HAND[clef]} plays it.`,
      sig: `k${clef}${m}`,
    };
  }

  // ---------- rhythm ----------
  const NOTE_VALUES = [
    { dur: 'w', name: 'whole note', b: 4, look: 'hollow, with no stem' },
    { dur: 'h', name: 'half note', b: 2, look: 'hollow, with a stem' },
    { dur: 'q', name: 'quarter note', b: 1, look: 'filled in, with a stem' },
    { dur: 'e', name: 'eighth note', b: 0.5, look: 'filled in, with a stem and one flag' },
    { dur: 's', name: 'sixteenth note', b: 0.25, look: 'filled in, with two flags' },
  ];
  const REST_VALUES = [
    { dur: 'w', name: 'whole rest', b: 4, look: 'a block hanging down from the 4th line' },
    { dur: 'h', name: 'half rest', b: 2, look: 'a block sitting on the middle line, like a hat' },
    { dur: 'q', name: 'quarter rest', b: 1, look: 'a zig-zag squiggle' },
    { dur: 'e', name: 'eighth rest', b: 0.5, look: 'a slanted stroke with one dot, like a 7' },
  ];
  const BEAT_CHOICES = ['6', '4', '3', '2', '1½', '1', '¾', '½', '¼'];

  const PIECES = [
    { b: 4, make: () => [{ dur: 'w' }] },
    { b: 3, make: () => [{ dur: 'h', dots: 1 }] },
    { b: 2, make: () => [{ dur: 'h' }] },
    { b: 2, make: () => [{ dur: 'q', dots: 1 }, { dur: 'e' }] },
    { b: 1, make: () => [{ dur: 'q' }] },
    { b: 1, make: () => [{ dur: 'q' }] },
    { b: 1, make: () => { const id = ++beamId; return [{ dur: 'e', beam: id }, { dur: 'e', beam: id }]; } },
    { b: 1, rest: true, make: () => [{ dur: 'q', rest: true }] },
    { b: 2, rest: true, make: () => [{ dur: 'h', rest: true }] },
  ];
  function fillBeats(total, { rests = true, maxPiece = 4 } = {}) {
    const out = [];
    let left = total;
    while (left > 0) {
      const opts = PIECES.filter(p => p.b <= left && p.b <= maxPiece && (rests || !p.rest));
      const pc = pick(opts);
      out.push(...pc.make());
      left -= pc.b;
    }
    return out.map(it => (it.rest ? restItem(it.dur, it.dots) : item([N(atPos(rint(1, 6), 'treble'))], it.dur, { dots: it.dots || 0, beam: it.beam })));
  }
  const sumStr = items => items.map(it => fmtBeats(beats(it.dur, it.dots))).join(' + ');
  const itemBeats = items => items.reduce((s, it) => s + beats(it.dur, it.dots), 0);
  const rhythmNote = (dur, dots = 0) => item([N(atPos(3, 'treble'))], dur, { dots });

  // ---------- chords & progressions ----------
  const PROGRESSIONS = [
    { id: 'cadence', name: 'I – IV – V – I', nick: 'The three-chord cadence', chords: [0, 3, 4, 0], songs: 'folk songs, hymns and early rock ’n’ roll' },
    { id: 'pop', name: 'I – V – vi – IV', nick: 'The pop progression', chords: [0, 4, 5, 3], songs: '“Let It Be” and “Don’t Stop Believin’”' },
    { id: 'fifties', name: 'I – vi – IV – V', nick: 'The ’50s progression', chords: [0, 5, 3, 4], songs: '“Stand by Me” and “Earth Angel”' },
    { id: 'minorpop', name: 'vi – IV – I – V', nick: 'The pop progression starting on vi', chords: [5, 3, 0, 4], songs: '“Zombie” by The Cranberries' },
    { id: 'jazz', name: 'ii – V – I', nick: 'The jazz ii–V–I', chords: [1, 4, 0, 0], songs: '“Autumn Leaves” and countless jazz standards' },
    { id: 'royal', name: 'IV – V – iii – vi', nick: 'The “royal road”', chords: [3, 4, 2, 5], songs: 'a staple of J-pop and anime themes' },
    { id: 'andalusian', name: 'i – VII – VI – V', nick: 'The Andalusian cadence (minor)', chords: [5, 4, 3, { deg: 2, q: 'M' }], labels: ['i', 'VII', 'VI', 'V'], minor: true, songs: '“Hit the Road Jack” and flamenco' },
    { id: 'canon', name: 'I – V – vi – iii – IV – I – IV – V', nick: 'Pachelbel’s Canon', chords: [0, 4, 5, 2, 3, 0, 3, 4], songs: 'Pachelbel’s Canon in D and many pop songs', long: true },
    { id: 'blues', name: 'I I I I – IV IV I I – V IV I I', nick: 'The 12-bar blues', chords: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 0], songs: '“Johnny B. Goode” and the whole blues tradition', long: true },
  ];
  const chordSpec = c => (typeof c === 'number' ? { deg: c } : c);
  const progChord = (k, c) => { const s = chordSpec(c); return triad(k, s.deg, s.q || null); };
  const progLabels = (k, prog) => prog.labels ? prog.chords.map((_, i) => prog.labels[i % prog.labels.length]) : prog.chords.map(c => progChord(k, c).numeral);
  const progNames = (k, prog) => prog.chords.map(c => progChord(k, c).name);

  const PATTERNS = {
    block: { label: 'Block chords', desc: 'all three chord notes together' },
    root: { label: 'Root notes', desc: 'just the root of each chord' },
    arpeggio: { label: 'Broken chord (arpeggio)', desc: 'the chord notes one at a time, up and back down' },
    alberti: { label: 'Alberti bass', desc: 'low – high – middle – high, over and over (Mozart loved it)' },
    oompah: { label: 'Oom-pah', desc: 'a bass note on beats 1 and 3 and the chord on beats 2 and 4' },
  };

  function lhPattern(tri, pattern) {
    const r = MT.lhRoot(tri.notes[0]);
    const d = dia(r);
    const t = fromDia(d + 2, tri.notes[1].a), f = fromDia(d + 4, tri.notes[2].a), r8 = fromDia(d + 7, r.a);
    const eighths = seq => {
      const a = ++beamId, b = ++beamId;
      return seq.map((p, i) => item([N(p)], 'e', { beam: i < 4 ? a : b }));
    };
    switch (pattern) {
      case 'block': return [item([N(r), N(t), N(f)], 'w')];
      case 'arpeggio': return eighths([r, t, f, r8, f, t, r, t]);
      case 'alberti': return eighths([r, f, t, f, r, f, t, f]);
      case 'oompah': return [item([N(r)], 'q'), item([N(t), N(f)], 'q'), item([N(r)], 'q'), item([N(t), N(f)], 'q')];
      default: return [item([N(r)], 'w')];
    }
  }

  // Grand-staff columns for a chord progression. Each measure gets m = index for highlighting.
  function progressionCols(k, chords, pattern = 'root', opts = {}) {
    let prev = null;
    const cols = [];
    chords.forEach((c, m) => {
      const tri = progChord(k, c);
      const rh = opts.rh === false ? null : MT.voiceRH(tri.notes, prev);
      if (rh) prev = rh.map(midi);
      const lh = lhPattern(tri, pattern);
      lh.forEach((it, j) => cols.push({
        m,
        treble: j === 0 && rh ? item(rh.map(p => N(p)), 'w') : null,
        bass: it,
        above: j === 0 && opts.above ? opts.above[m] : undefined,
        below: j === 0 && opts.below ? opts.below[m] : undefined,
      }));
      cols.push({ bar: m === chords.length - 1 ? 'end' : true, m });
    });
    return cols;
  }

  function chordInStaff(k, deg, clef, q = null) {
    const rl = (LETTERS.indexOf(MT.KEY_TONIC[k]) + deg) % 7;
    let d = (clef === 'treble' ? 4 : 2) * 7 + rl;
    const [lo, hi] = clef === 'treble' ? [30, 36] : [18, 24];
    while (d < lo) d += 7;
    while (d > hi) d -= 7;
    return triad(k, deg, q, d);
  }
  const chordNotesStr = tri => tri.notes.map(name).join(' – ');

  // ---------- Lesson helpers ----------
  const labelled = (clef, poses, dur = 'q') => poses.map(pos => single(clef, atPos(pos, clef), { dur }));
  const withBelow = (cols, labels) => cols.map((c, i) => Object.assign(c, { below: labels[i] }));

  // =====================================================================
  const LEVELS = [];

  // ---- Level 1 ----
  LEVELS.push({
    title: 'Right Hand: the Treble Staff',
    blurb: 'Lines, spaces and the treble clef',
    lesson: [
      {
        title: 'The staff',
        html: 'Music is written on a <b>staff</b>: five lines and the four spaces between them. Each line and each space is a different note. The higher a note sits on the staff, the higher it sounds.',
        score: { system: 'treble', cols: labelled('treble', [0, 1, 2, 3, 4, 5, 6, 7, 8]) },
        play: { label: '▶ Hear them climb', bpm: 150 },
      },
      {
        title: 'The treble clef = your right hand',
        html: 'This curly symbol is the <b>treble clef</b>, also called the G clef: its curl wraps around the second line, which is <b>G</b>. On the piano, your <b>right hand</b> usually plays the treble staff, which holds the higher notes.',
        score: { system: 'treble', cols: [Object.assign(single('treble', atPos(2, 'treble'), { color: HL }), { below: 'G' })], minWidth: 18, center: true },
        play: { label: '▶ Hear G' },
      },
      {
        title: 'Line notes: E G B D F',
        html: 'From the bottom line up, the lines are <b>E G B D F</b>. Remember it as <i>Every Good Boy Does Fine</i>.',
        score: { system: 'treble', cols: withBelow(labelled('treble', [0, 2, 4, 6, 8], 'w'), ['E', 'G', 'B', 'D', 'F']) },
        play: { label: '▶ Listen', bpm: 200 },
      },
      {
        title: 'Space notes: F A C E',
        html: 'From the bottom space up, the spaces are <b>F A C E</b>: they spell <i>FACE</i>.',
        score: { system: 'treble', cols: withBelow(labelled('treble', [1, 3, 5, 7], 'w'), ['F', 'A', 'C', 'E']) },
        play: { label: '▶ Listen', bpm: 200 },
      },
      {
        title: 'Try it',
        html: 'Tap any line or space to see its name and hear it.',
        explore: { system: 'treble', click: { staff: 'treble', pmin: 0, pmax: 8 } },
      },
    ],
    gen() {
      if (rnd() < 0.3) return placeQ('treble', pick(LETTERS), 0, 8);
      return nameQ('treble', rint(0, 8));
    },
  });

  // ---- Level 2 ----
  LEVELS.push({
    title: 'Left Hand: the Bass Staff',
    blurb: 'The bass clef and its lines and spaces',
    lesson: [
      {
        title: 'The bass clef = your left hand',
        html: 'The <b>bass clef</b>, also called the F clef, is used for lower notes. Its two dots sit on either side of the fourth line, which is <b>F</b>. Your <b>left hand</b> usually plays the bass staff.',
        score: { system: 'bass', cols: [Object.assign(single('bass', atPos(6, 'bass'), { color: HL }), { below: 'F' })], minWidth: 18, center: true },
        play: { label: '▶ Hear F' },
      },
      {
        title: 'Line notes: G B D F A',
        html: 'From the bottom line up, the bass lines are <b>G B D F A</b>: <i>Good Boys Do Fine Always</i>.',
        score: { system: 'bass', cols: withBelow(labelled('bass', [0, 2, 4, 6, 8], 'w'), ['G', 'B', 'D', 'F', 'A']) },
        play: { label: '▶ Listen', bpm: 200 },
      },
      {
        title: 'Space notes: A C E G',
        html: 'From the bottom space up, the bass spaces are <b>A C E G</b>: <i>All Cows Eat Grass</i>.',
        score: { system: 'bass', cols: withBelow(labelled('bass', [1, 3, 5, 7], 'w'), ['A', 'C', 'E', 'G']) },
        play: { label: '▶ Listen', bpm: 200 },
      },
      {
        title: 'Careful: new names',
        html: 'The bass staff looks the same as the treble staff, but every name is different. The bottom line is <b>G</b> in bass clef, not E. Always check the clef before you read.',
        score: { system: 'grand', cols: [{ treble: item([N(atPos(0, 'treble'))]), bass: item([N(atPos(0, 'bass'))]), below: 'E / G' }], minWidth: 18, center: true },
      },
      {
        title: 'Try it',
        html: 'Tap any line or space on the bass staff.',
        explore: { system: 'bass', click: { staff: 'bass', pmin: 0, pmax: 8 } },
      },
    ],
    gen() {
      if (rnd() < 0.3) return placeQ('bass', pick(LETTERS), 0, 8);
      return nameQ('bass', rint(0, 8));
    },
  });

  // ---- Level 3 ----
  const LEDGER = { treble: [-5, -4, -3, -2, -1, 9, 10, 11, 12, 13], bass: [-4, -3, -2, -1, 9, 10, 11, 12] };
  LEVELS.push({
    title: 'Middle C & Ledger Lines',
    blurb: 'Notes above and below the staff',
    lesson: [
      {
        title: 'Ledger lines',
        html: 'Notes above or below the staff get short extra lines called <b>ledger lines</b>. Keep counting line, space, line, just as you do on the staff.',
        score: { system: 'treble', cols: withBelow(labelled('treble', [8, 9, 10, 11, 12], 'q'), ['F', 'G', 'A', 'B', 'C']) },
        play: { label: '▶ Listen', bpm: 150 },
      },
      {
        title: 'Middle C',
        html: '<b>Middle C</b> is the C nearest the middle of the piano. It sits on one ledger line <i>below</i> the treble staff and one ledger line <i>above</i> the bass staff. Both spots mean the same key: it’s where your two hands meet.',
        score: { system: 'grand', cols: [{ treble: item([N(MT.parse('C4'), undefined, HL)]), below: 'right hand' }, { bass: item([N(MT.parse('C4'), undefined, HL)]), below: 'left hand' }], minWidth: 22, center: true },
        keyboard: { lo: 48, hi: 72, marks: { 60: HL } },
        play: { label: '▶ Hear middle C' },
      },
      {
        title: 'Below the treble staff',
        html: 'Count down from the bottom line (E): D sits just below the staff, then C on the first ledger line, then B and A.',
        score: { system: 'treble', cols: withBelow(labelled('treble', [0, -1, -2, -3, -4], 'q'), ['E', 'D', 'C', 'B', 'A']) },
        play: { label: '▶ Listen', bpm: 150 },
      },
      {
        title: 'Around the bass staff',
        html: 'Above the bass staff: A (top line), B, then middle C on a ledger line. Below it: G (bottom line), F, then E on a ledger line.',
        score: { system: 'bass', cols: withBelow(labelled('bass', [8, 9, 10, 0, -1, -2], 'q'), ['A', 'B', 'C', 'G', 'F', 'E']) },
        play: { label: '▶ Listen', bpm: 150 },
      },
      {
        title: 'Try it',
        html: 'Tap above and below either staff. Try to find middle C on both.',
        explore: { system: 'grand', click: [{ staff: 'treble', pmin: -4, pmax: 12 }, { staff: 'bass', pmin: -4, pmax: 12 }] },
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.15) {
        const clef = pick(['treble', 'bass']);
        return placeExactQ(clef, clef === 'treble' ? -2 : 10, 'middle C', -4, 12);
      }
      if (r < 0.45) {
        const clef = rnd() < 0.6 ? 'treble' : 'bass';
        const pos = clef === 'treble' ? pick([-5, -4, -3, -2, -1, 0, 2, 5, 8, 9, 10, 11]) : pick([3, 5, 8, 9, 10, 11, 12]);
        return pianoQ(clef, clef, atPos(pos, clef));
      }
      const clef = pick(['treble', 'bass']);
      const pos = rnd() < 0.7 ? pick(LEDGER[clef]) : rint(0, 8);
      return nameQ(clef, pos);
    },
  });

  // ---- Level 4 ----
  LEVELS.push({
    title: 'Both Hands: the Grand Staff',
    blurb: 'Reading right and left hand together',
    lesson: [
      {
        title: 'The grand staff',
        html: 'Piano music joins a treble staff and a bass staff with a brace. Together they make the <b>grand staff</b>: the top staff is your <b>right hand</b> and the bottom staff is your <b>left hand</b>.',
        score: { system: 'grand', cols: [{ treble: item([N(MT.parse('E5'))]), bass: item([N(MT.parse('C3'))]) }], minWidth: 18, center: true },
        play: { label: '▶ Listen' },
      },
      {
        title: 'Lined up = played together',
        html: 'Notes stacked straight above one another are played at the same time. Read left to right: here both hands play together three times.',
        score: {
          system: 'grand', cols: [
            { treble: item([N(MT.parse('E5'))], 'h'), bass: item([N(MT.parse('C3'))], 'h'), below: 'E + C' },
            { treble: item([N(MT.parse('D5'))], 'h'), bass: item([N(MT.parse('G2'))], 'h'), below: 'D + G' },
            { treble: item([N(MT.parse('C5'))], 'w'), bass: item([N(MT.parse('C3'))], 'w'), below: 'C + C' },
          ],
        },
        play: { label: '▶ Listen', bpm: 90 },
      },
      {
        title: 'Landmark notes',
        html: 'Good readers don’t count from the bottom every time. They memorize a few <b>landmarks</b> and read nearby notes as steps away from them: treble G (the clef’s curl), middle C in either clef, and bass F (between the clef’s dots).',
        score: {
          system: 'grand', cols: [
            { treble: item([N(MT.parse('G4'), undefined, HL)]), below: 'G' },
            { treble: item([N(MT.parse('C4'), undefined, HL)]), below: 'mid C' },
            { bass: item([N(MT.parse('C4'), undefined, HL)]), below: 'mid C' },
            { bass: item([N(MT.parse('F3'), undefined, HL)]), below: 'F' },
          ],
        },
      },
      {
        title: 'On the keyboard',
        html: 'Here are the same landmarks on the piano. Tap any key to hear it.',
        keyboard: { lo: 36, hi: 84, marks: { 53: HL, 60: HL, 67: HL }, interactive: true },
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.45) {
        const tp = rint(-1, 10), bp = rint(-2, 9);
        const hand = rnd() < 0.5 ? 'treble' : 'bass';
        const tq = atPos(tp, 'treble'), bq = atPos(bp, 'bass');
        const c = { treble: item([N(tq, undefined, hand === 'treble' ? HL : undefined)]), bass: item([N(bq, undefined, hand === 'bass' ? HL : undefined)]) };
        const pos = hand === 'treble' ? tp : bp;
        return {
          type: 'letters', prompt: `Name the <b style="color:${HL}">${HAND[hand]}</b> note`,
          score: { system: 'grand', cols: [c], minWidth: 18, center: true },
          answer: (hand === 'treble' ? tq : bq).l,
          explain: `The ${HAND[hand]} reads the ${hand} staff. ` + explainPos(hand, pos),
          sig: `g${tp}${bp}${hand}`,
        };
      }
      if (r < 0.75) {
        const clef = pick(['treble', 'bass']);
        const pos = clef === 'treble' ? rint(-2, 10) : rint(-2, 10);
        return pianoQ('grand', clef, atPos(pos, clef), { lo: 36, hi: 84, prompt: 'Find the highlighted note on the keyboard' });
      }
      const clef = pick(['treble', 'bass']);
      const q = nameQ(clef, rint(-2, 10));
      q.score.system = 'grand';
      q.explain = `It's in the ${clef} staff (${HAND[clef]}). ` + q.explain;
      return q;
    },
  });

  // ---- Level 5 ----
  const valueVariant = v => {
    const n = 4 / v.b, its = [];
    for (let i = 0; i < n; i++) its.push(rhythmNote(v.dur));
    if (v.dur === 'e' || v.dur === 's') {
      const per = v.dur === 'e' ? 2 : 4;
      its.forEach((it, i) => (it.beam = 'v' + v.dur + Math.floor(i / per)));
    }
    return {
      label: v.name.replace(' note', ''),
      html: `A <b>${v.name}</b> is ${v.look}. It lasts <b>${fmtBeats(v.b)} beat${v.b === 1 ? '' : 's'}</b>${v.b < 4 ? `, so ${n} of them fill a 4-beat measure` : ''}.${v.dur === 'e' || v.dur === 's' ? ' Neighbouring ones are often joined by <b>beams</b> instead of flags.' : ''}`,
      score: { system: 'treble', time: [4, 4], cols: [...its.map(it => col('treble', it)), { bar: 'end' }] },
      play: { label: '▶ Listen with the beat', bpm: 80, clicks: true },
    };
  };
  LEVELS.push({
    title: 'Note Lengths & Rests',
    blurb: 'How long each note lasts',
    lesson: [
      {
        title: 'The beat',
        html: 'Music has a steady pulse called the <b>beat</b>: it’s what you tap your foot to. The <i>shape</i> of a note tells you how many beats to hold it.',
        score: { system: 'treble', time: [4, 4], cols: [...[0, 1, 2, 3].map(() => col('treble', rhythmNote('q'))), { bar: 'end' }] },
        play: { label: '▶ Hear four beats', bpm: 80, clicks: true },
      },
      { title: 'Note values', html: 'Pick a note value to see and hear it.', variants: NOTE_VALUES.map(valueVariant) },
      {
        title: 'The note tree',
        html: 'Each note value is half of the one before it:<br><b>1 whole = 2 halves = 4 quarters = 8 eighths = 16 sixteenths.</b><br>A half note is two quarter notes long, a quarter note is two eighths long, and so on.',
      },
      {
        title: 'Rests: counted silence',
        html: 'A <b>rest</b> means silence, but you keep counting. Each note value has a matching rest.',
        variants: REST_VALUES.map(v => ({
          label: v.name.replace(' rest', ''),
          html: `A <b>${v.name}</b> looks like ${v.look}. It is <b>${fmtBeats(v.b)} beat${v.b === 1 ? '' : 's'}</b> of silence.`,
          score: { system: 'treble', cols: [col('treble', restItem(v.dur))], minWidth: 16, center: true },
        })),
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.3) {
        const v = pick(NOTE_VALUES);
        return {
          type: 'choice', prompt: 'In 4/4 time, how many beats does this note last?',
          score: { system: 'treble', cols: [col('treble', rhythmNote(v.dur))], minWidth: 16, center: true },
          choices: ['4', '2', '1', '½', '¼'], answer: fmtBeats(v.b),
          explain: `It's a <b>${v.name}</b>: ${v.look}. It lasts ${fmtBeats(v.b)} beat${v.b === 1 ? '' : 's'}.`,
          play: { bpm: 80, clicks: true }, sig: 'nb' + v.dur,
        };
      }
      if (r < 0.55) {
        const v = pick(NOTE_VALUES);
        return {
          type: 'choice', prompt: 'What is this note called?',
          score: { system: 'treble', cols: [col('treble', rhythmNote(v.dur))], minWidth: 16, center: true },
          choices: NOTE_VALUES.map(x => x.name), answer: v.name,
          explain: `A <b>${v.name}</b> is ${v.look}.`, play: { bpm: 80, clicks: true }, sig: 'nn' + v.dur,
        };
      }
      if (r < 0.8) {
        const v = pick(REST_VALUES);
        const askBeats = rnd() < 0.5;
        return {
          type: 'choice', prompt: askBeats ? 'How many beats of silence is this rest?' : 'What is this rest called?',
          score: { system: 'treble', cols: [col('treble', restItem(v.dur))], minWidth: 16, center: true },
          choices: askBeats ? ['4', '2', '1', '½'] : REST_VALUES.map(x => x.name),
          answer: askBeats ? fmtBeats(v.b) : v.name,
          explain: `A <b>${v.name}</b> looks like ${v.look}. It is ${fmtBeats(v.b)} beat${v.b === 1 ? '' : 's'} of silence.`,
          noSound: true, sig: 'r' + v.dur + askBeats,
        };
      }
      const pairs = [['w', 'h'], ['w', 'q'], ['w', 'e'], ['h', 'q'], ['h', 'e'], ['q', 'e'], ['q', 's'], ['h', 's']];
      const [bd, sd] = pick(pairs);
      const big = NOTE_VALUES.find(v => v.dur === bd), small = NOTE_VALUES.find(v => v.dur === sd);
      const n = big.b / small.b;
      return {
        type: 'choice', prompt: `How many <b>${small.name}s</b> last as long as one <b>${big.name}</b>?`,
        score: { system: 'treble', cols: [Object.assign(col('treble', rhythmNote(bd)), { below: big.name.split(' ')[0] }), { bar: true }, Object.assign(col('treble', rhythmNote(sd)), { below: small.name.split(' ')[0] })], minWidth: 22, center: true },
        choices: ['2', '4', '8', '16'], answer: String(n),
        explain: `A ${big.name} is ${fmtBeats(big.b)} beats and a ${small.name} is ${fmtBeats(small.b)}, so ${n} of them fit.`,
        noSound: true, sig: 'eq' + bd + sd,
      };
    },
  });

  // ---- Level 6 ----
  const DOTTED = [
    { dur: 'h', b: 3, expl: 'a half note (2) plus half of that (1) = 3 beats' },
    { dur: 'q', b: 1.5, expl: 'a quarter note (1) plus half of that (½) = 1½ beats' },
    { dur: 'e', b: 0.75, expl: 'an eighth note (½) plus half of that (¼) = ¾ beat' },
    { dur: 'w', b: 6, expl: 'a whole note (4) plus half of that (2) = 6 beats' },
  ];
  const COUNT_LABELS = ['1', '1 &', '2', '2 &', '3', '3 &', '4', '4 &'];
  const countLabel = t => String(Math.floor(t) + 1) + (Math.abs(t % 1 - 0.5) < 1e-9 ? ' &' : '');
  const MISSING = { 1: 'quarter note', 2: 'half note', 3: 'dotted half note', 4: 'whole note' };
  LEVELS.push({
    title: 'Dots, Time Signatures & Counting',
    blurb: 'Measures, counting 1 & 2 &',
    lesson: [
      {
        title: 'Dotted notes',
        html: 'A <b>dot</b> after a note makes it longer by half its value.',
        variants: [
          { label: 'dotted half', html: 'Dotted half note = 2 + 1 = <b>3 beats</b>.', score: { system: 'treble', time: [4, 4], cols: [col('treble', rhythmNote('h', 1)), col('treble', rhythmNote('q')), { bar: 'end' }] }, play: { label: '▶ Listen', bpm: 80, clicks: true } },
          { label: 'dotted quarter', html: 'Dotted quarter note = 1 + ½ = <b>1½ beats</b>. It is often followed by an eighth note to finish the beat.', score: { system: 'treble', time: [4, 4], cols: [col('treble', rhythmNote('q', 1)), col('treble', rhythmNote('e')), col('treble', rhythmNote('h')), { bar: 'end' }] }, play: { label: '▶ Listen', bpm: 80, clicks: true } },
        ],
      },
      {
        title: 'Time signatures & measures',
        html: 'The two numbers at the start are the <b>time signature</b>. The top number is how many beats are in each <b>measure</b>. A bottom number of 4 means the quarter note gets one beat. <b>Bar lines</b> divide the music into measures.',
        variants: [
          { label: '4/4', html: '<b>4/4</b>: four beats per measure, the most common time.', score: { system: 'treble', time: [4, 4], cols: [col('treble', rhythmNote('h')), col('treble', rhythmNote('q')), col('treble', rhythmNote('q')), { bar: true }, col('treble', rhythmNote('w')), { bar: 'end' }] }, play: { label: '▶ Listen', bpm: 90, clicks: true, beatsPerBar: 4 } },
          { label: '3/4', html: '<b>3/4</b>: three beats per measure, like a waltz: ONE two three.', score: { system: 'treble', time: [3, 4], cols: [col('treble', rhythmNote('h')), col('treble', rhythmNote('q')), { bar: true }, col('treble', rhythmNote('h', 1)), { bar: 'end' }] }, play: { label: '▶ Listen', bpm: 110, clicks: true, beatsPerBar: 3 } },
          { label: '2/4', html: '<b>2/4</b>: two beats per measure, like a march: LEFT right.', score: { system: 'treble', time: [2, 4], cols: [col('treble', rhythmNote('q')), col('treble', rhythmNote('q')), { bar: true }, col('treble', rhythmNote('h')), { bar: 'end' }] }, play: { label: '▶ Listen', bpm: 100, clicks: true, beatsPerBar: 2 } },
        ],
      },
      {
        title: 'Counting out loud',
        html: 'Count the beats out loud: “1, 2, 3, 4.” Eighth notes split a beat in two, so count them “1 &, 2 &.” Each note starts on the count written under it.',
        score: (() => {
          const id = 'cnt';
          const its = [rhythmNote('q'), Object.assign(rhythmNote('e'), { beam: id }), Object.assign(rhythmNote('e'), { beam: id }), rhythmNote('h')];
          return { system: 'treble', time: [4, 4], cols: [...withBelow(its.map(it => col('treble', it)), ['1', '2', '&', '3 (4)']), { bar: 'end' }] };
        })(),
        play: { label: '▶ Listen', bpm: 80, clicks: true },
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.25) {
        const v = pick(DOTTED);
        const ans = fmtBeats(v.b);
        return {
          type: 'choice', prompt: 'How many beats does this dotted note last?',
          score: { system: 'treble', cols: [col('treble', rhythmNote(v.dur, 1))], minWidth: 16, center: true },
          choices: choicesFrom(ans, BEAT_CHOICES, 4, true), answer: ans,
          explain: `The dot adds half the note’s value: ${v.expl}.`, play: { bpm: 80, clicks: true }, sig: 'dot' + v.dur,
        };
      }
      if (r < 0.5) {
        const total = pick([2, 3, 4]);
        const its = fillBeats(total);
        return {
          type: 'choice', prompt: 'Count the beats. Which time signature fits this measure?',
          score: { system: 'treble', cols: [...its.map(it => col('treble', it)), { bar: 'end' }], minWidth: 22 },
          choices: ['2/4', '3/4', '4/4'], answer: `${total}/4`,
          explain: `The beats add up to ${sumStr(its)} = <b>${total}</b>, so it’s ${total}/4.`,
          play: { bpm: 80, clicks: true, beatsPerBar: total }, sig: 'ts' + total + sumStr(its),
        };
      }
      if (r < 0.75) {
        const ts = pick([3, 4]);
        const missing = rint(1, ts - 1);
        const its = fillBeats(ts - missing, { maxPiece: 3 });
        const atStart = rnd() < 0.4;
        const cols = its.map(it => col('treble', it));
        const blank = { blank: missing };
        const fullCols = cols.slice();
        const fill = col('treble', item([N(atPos(3, 'treble'), undefined, OK)], missing === 3 ? 'h' : missing === 2 ? 'h' : missing === 4 ? 'w' : 'q', { dots: missing === 3 ? 1 : 0 }));
        if (atStart) { cols.unshift(blank); fullCols.unshift(fill); } else { cols.push(blank); fullCols.push(fill); }
        cols.push({ bar: 'end' }); fullCols.push({ bar: 'end' });
        return {
          type: 'choice', prompt: 'Which note fills the gap and completes this measure?',
          score: { system: 'treble', time: [ts, 4], cols, minWidth: 22 },
          reveal: { system: 'treble', time: [ts, 4], cols: fullCols, minWidth: 22 },
          choices: ['quarter note', 'half note', 'dotted half note', 'whole note'].filter((_, i) => i < ts), answer: MISSING[missing],
          explain: `${ts}/${4} needs ${ts} beats. The measure already has ${sumStr(its)} = ${fmtBeats(itemBeats(its))}, so ${missing} beat${missing > 1 ? 's are' : ' is'} missing: a <b>${MISSING[missing]}</b>.`,
          play: { bpm: 80, clicks: true, beatsPerBar: ts, fromReveal: true }, sig: 'miss' + ts + missing + sumStr(its),
        };
      }
      // On which beat does the highlighted note start?
      const its = fillBeats(4, { maxPiece: 3 });
      let t = 0;
      const onsets = its.map(it => { const o = t; t += beats(it.dur, it.dots); return o; });
      const candidates = its.map((it, i) => i).filter(i => !its[i].rest && i > 0);
      const idx = candidates.length ? pick(candidates) : 0;
      its[idx].color = HL;
      const ans = countLabel(onsets[idx]);
      const before = its.slice(0, idx);
      return {
        type: 'choice', prompt: 'In 4/4, on which count does the highlighted note start?',
        score: { system: 'treble', time: [4, 4], cols: [...its.map(it => col('treble', it)), { bar: 'end' }], minWidth: 22 },
        choices: choicesFrom(ans, COUNT_LABELS, 4, true), answer: ans,
        explain: onsets[idx] === 0 ? 'It’s the first note of the measure: count 1.' : `Everything before it adds up to ${sumStr(before)} = ${fmtBeats(onsets[idx])} beat${onsets[idx] === 1 ? '' : 's'}, so it starts on “<b>${ans}</b>”.`,
        play: { bpm: 80, clicks: true }, sig: 'cnt' + sumStr(its) + idx,
      };
    },
  });

  // ---- Level 7 ----
  const SHARPABLE = 'CDFGA', FLATTABLE = 'DEGAB';
  LEVELS.push({
    title: 'Sharps, Flats & Naturals',
    blurb: 'Black keys and accidentals',
    lesson: [
      {
        title: 'Half steps',
        html: 'On the piano, the distance from one key to the very next key, black or white, is a <b>half step</b>. Tap the keys: each black key sits between two white keys.',
        keyboard: { lo: 60, hi: 72, labels: Object.fromEntries([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72].map(m => [m, MT.isBlack(m) ? '' : MT.midiName(m)])), interactive: true },
      },
      {
        title: 'Sharp ♯ and flat ♭',
        html: 'A <b>sharp ♯</b> raises a note one half step, to the very next key on the right. A <b>flat ♭</b> lowers it one half step, to the next key on the left. The sign goes just <i>before</i> the note.',
        score: { system: 'treble', cols: [Object.assign(single('treble', MT.parse('F4')), { below: 'F' }), Object.assign(single('treble', MT.parse('F#4')), { below: 'F♯' }), { bar: true }, Object.assign(single('treble', MT.parse('B4')), { below: 'B' }), Object.assign(single('treble', MT.parse('Bb4')), { below: 'B♭' })] },
        keyboard: { lo: 60, hi: 72, marks: { 65: '#adb5bd', 66: HL, 71: '#adb5bd', 70: HL } },
        play: { label: '▶ Listen', bpm: 180 },
      },
      {
        title: 'One black key, two names',
        html: 'Every black key has two names: the key between F and G is both <b>F♯</b> and <b>G♭</b>. Which name the music uses depends on the key it’s written in (Level 8).',
        score: { system: 'treble', cols: [Object.assign(single('treble', MT.parse('F#4')), { below: 'F♯' }), Object.assign(single('treble', MT.parse('Gb4')), { below: 'G♭' })], minWidth: 22, center: true },
        keyboard: { lo: 60, hi: 72, marks: { 66: HL } },
      },
      {
        title: 'Accidentals last the whole measure',
        html: 'Once a ♯ or ♭ appears, it applies to every later note on that line or space <b>until the bar line</b>. A <b>natural ♮</b> cancels it early.',
        score: { system: 'treble', cols: [Object.assign(single('treble', MT.parse('F#4'), { dur: 'q' }), { below: 'F♯' }), Object.assign(single('treble', MT.parse('F#4'), { dur: 'q' }), { below: 'still F♯' }), Object.assign(single('treble', MT.parse('F4'), { dur: 'h' }), { below: 'F (♮)' }), { bar: true }, Object.assign(single('treble', MT.parse('F4'), { dur: 'w' }), { below: 'new bar: F' }), { bar: 'end' }] },
        play: { label: '▶ Listen', bpm: 110 },
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.4) {
        const clef = rnd() < 0.7 ? 'treble' : 'bass';
        let pos, p, acc;
        do {
          pos = rint(-1, 9);
          acc = pick(['#', 'b']);
          p = atPos(pos, clef, accVal[acc]);
        } while ((acc === '#' && !SHARPABLE.includes(p.l)) || (acc === 'b' && !FLATTABLE.includes(p.l)));
        const L = p.l, ans = name(p);
        const nb = LETTERS[(LETTERS.indexOf(L) + (acc === '#' ? 1 : 6)) % 7];
        return {
          type: 'choice', prompt: 'Name this note',
          score: { system: clef, cols: [single(clef, p)], minWidth: 18, center: true },
          choices: shuffle([ans, L, L + (acc === '#' ? '♭' : '♯'), nb]), answer: ans,
          explain: `The note is on ${describePos(pos)} of the ${clef} staff, which is ${L}. The ${acc === '#' ? 'sharp raises it a half step' : 'flat lowers it a half step'}: <b>${ans}</b>.`,
          sig: `acc${clef}${pos}${acc}`,
        };
      }
      if (r < 0.7) {
        const clef = rnd() < 0.65 ? 'treble' : 'bass';
        let p, acc;
        do {
          const pos = clef === 'treble' ? rint(-4, 10) : rint(3, 10);
          acc = pick(['#', 'b']);
          p = atPos(pos, clef, accVal[acc]);
        } while ((acc === '#' && !SHARPABLE.includes(p.l)) || (acc === 'b' && !FLATTABLE.includes(p.l)));
        return pianoQ(clef, clef, p, {
          explain: `<b>${name(p)}</b> is the black key just ${acc === '#' ? 'right' : 'left'} of ${p.l}.`,
        });
      }
      const variant = pick(['same', 'bar', 'natural']);
      let pos, p1, acc;
      do {
        pos = rint(1, 7);
        acc = pick(['#', 'b']);
        p1 = atPos(pos, 'treble', accVal[acc]);
      } while ((acc === '#' && !SHARPABLE.includes(p1.l)) || (acc === 'b' && !FLATTABLE.includes(p1.l)));
      const L = p1.l, sym = acc === '#' ? '♯' : '♭';
      const p2 = atPos(pos, 'treble', variant === 'same' ? accVal[acc] : 0);
      const n2 = N(p2, variant === 'natural' ? 'n' : undefined, HL);
      const cols = variant === 'bar'
        ? [single('treble', p1), { bar: true }, col('treble', item([n2], 'w')), { bar: 'end' }]
        : [single('treble', p1, { dur: 'h' }), col('treble', item([n2], 'h')), { bar: 'end' }];
      const ans = name(p2);
      const why = {
        same: `An accidental lasts until the end of the measure, so the second ${L} is still <b>${ans}</b>.`,
        bar: `The bar line cancels accidentals. In the new measure it’s plain <b>${L}</b>.`,
        natural: `The natural sign ♮ cancels the ${sym}, so it’s plain <b>${L}</b>.`,
      }[variant];
      return {
        type: 'choice', prompt: 'Name the highlighted note',
        score: { system: 'treble', cols, minWidth: 22 },
        choices: shuffle([L + sym, L, L + (acc === '#' ? '♭' : '♯'), LETTERS[(LETTERS.indexOf(L) + 1) % 7]]), answer: ans,
        explain: why, sig: `carry${variant}${pos}${acc}`,
      };
    },
  });

  // ---- Level 8 ----
  const keyCountLabel = k => k === 0 ? 'no sharps or flats' : `${Math.abs(k)} ${k > 0 ? 'sharp' : 'flat'}${Math.abs(k) > 1 ? 's' : ''}`;
  function explainKey(k) {
    if (k === 0) return 'No sharps or flats means <b>C major</b>.';
    const accs = keyAccLetters(k);
    if (k > 0) {
      const last = accs[accs.length - 1];
      return `The sharps are ${accs.map(l => l + '♯').join(' ')}. The last sharp is <b>${last}♯</b>; one half step up from it is ${keyName(k)}, so it’s <b>${keyName(k)} major</b>.`;
    }
    if (k === -1) return 'One flat (B♭) is always <b>F major</b>.';
    return `The flats are ${accs.map(l => l + '♭').join(' ')}. The second-to-last flat names the key: <b>${keyName(k)} major</b>.`;
  }
  const keyVariants = [];
  for (let k = 0; k <= 7; k++) keyVariants.push(k);
  for (let k = -1; k >= -7; k--) keyVariants.push(k);
  LEVELS.push({
    title: 'Key Signatures & Scales',
    blurb: 'Major scales and reading in a key',
    lesson: [
      {
        title: 'The major scale',
        html: 'A <b>major scale</b> climbs eight notes using the pattern <b>W W H W W W H</b>, where W is a whole step (2 half steps) and H is a half step. Starting on C, that pattern uses only white keys.',
        score: { system: 'treble', cols: withBelow(MT.scale(0).map(p => single('treble', p, { dur: 'q' })), ['C', 'W', 'W', 'H', 'W', 'W', 'W', 'H'].map((x, i) => i === 0 ? 'C' : x)) },
        keyboard: { lo: 60, hi: 72, marks: { 60: HL, 62: HL, 64: HL, 65: HL, 67: HL, 69: HL, 71: HL, 72: HL } },
        play: { label: '▶ Hear C major', bpm: 150 },
      },
      {
        title: 'Key signatures',
        html: 'Start the same pattern on G and you need <b>F♯</b>. Instead of writing ♯ before every F, the sharp is written once at the start of each line: the <b>key signature</b>. Every F, in every octave, is played as F♯ unless a ♮ says otherwise.',
        score: { system: 'treble', key: 1, cols: withBelow(MT.scale(1).map(p => single('treble', p, { dur: 'q' })), MT.scale(1).map(name)) },
        keyboard: { lo: 67, hi: 79, marks: { 67: HL, 69: HL, 71: HL, 72: HL, 74: HL, 76: HL, 78: HL, 79: HL } },
        play: { label: '▶ Hear G major', bpm: 150 },
      },
      {
        title: 'Every key signature',
        html: 'Sharps always appear in the order <b>F C G D A E B</b> (<i>Father Charles Goes Down And Ends Battle</i>). Flats appear in the reverse order: <b>B E A D G C F</b>.',
        stepper: true,
        variants: keyVariants.map(k => ({
          label: `${keyName(k)} major`,
          html: `<b>${keyName(k)} major</b>: ${keyCountLabel(k)}.`,
          score: { system: 'grand', key: k, cols: [], minWidth: 18 },
        })),
      },
      {
        title: 'Naming the key',
        html: '<b>Sharp keys:</b> go one half step up from the last sharp. Last sharp F♯ → G major; last sharp C♯ → D major.<br><b>Flat keys:</b> the second-to-last flat is the key name. B♭ E♭ A♭ → E♭ major. <b>One flat</b> is F major.<br><b>Nothing</b> means C major.',
        score: { system: 'treble', key: -3, cols: [], minWidth: 18 },
      },
    ],
    gen() {
      const r = rnd();
      if (r < 0.45) {
        const k = rint(-7, 7);
        const clef = rnd() < 0.7 ? 'treble' : 'bass';
        const pool = uniq([k - 2, k - 1, k + 1, k + 2, -k].filter(x => x >= -7 && x <= 7 && x !== k).map(x => keyName(x) + ' major'));
        return {
          type: 'choice', prompt: 'Which major key has this key signature?',
          score: { system: clef, key: k, cols: [], minWidth: 16 },
          choices: shuffle([keyName(k) + ' major', ...shuffle(pool).slice(0, 3)]), answer: keyName(k) + ' major',
          explain: explainKey(k), noSound: true, sig: 'key' + k + clef,
        };
      }
      if (r < 0.8) {
        const k = pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
        const clef = rnd() < 0.65 ? 'treble' : 'bass';
        const L = rnd() < 0.7 ? pick(keyAccLetters(k)) : pick(LETTERS);
        const poses = [];
        for (let pos = 0; pos <= 8; pos++) if (atPos(pos, clef).l === L) poses.push(pos);
        const pos = pick(poses);
        const ka = keyAlter(L, k);
        const natural = ka !== 0 && rnd() < 0.25;
        const p = atPos(pos, clef, natural ? 0 : ka);
        const ans = name(p);
        const nb = LETTERS[(LETTERS.indexOf(L) + 1) % 7];
        let why;
        if (natural) why = `${keyName(k)} major has ${L}${SYM[ka]} in its key signature, but the natural sign ♮ cancels it: plain <b>${L}</b>.`;
        else if (ka) why = `${keyName(k)} major has ${L}${SYM[ka]} in its key signature, so this ${L} is played as <b>${ans}</b>.`;
        else why = `The key signature of ${keyName(k)} major doesn’t include ${L}, so it’s just <b>${L}</b>.`;
        return {
          type: 'choice', prompt: 'Name this note. Remember the key signature!',
          score: { system: clef, key: k, cols: [single(clef, p, { acc: natural ? 'n' : undefined })], minWidth: 18 },
          choices: shuffle([L + '♭', L, L + '♯', nb]), answer: ans,
          explain: `It’s on ${describePos(pos)}: ${L}. ` + why, sig: `rk${k}${clef}${pos}${natural}`,
        };
      }
      const k = pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
      const ans = keyCountLabel(k);
      const pool = [k - 1, k + 1, -k, k + 2, k - 2].filter(x => x >= -7 && x <= 7 && x !== k && x !== 0).map(keyCountLabel);
      return {
        type: 'choice', prompt: `How many sharps or flats does <b>${keyName(k)} major</b> have?`,
        score: null, reveal: { system: 'treble', key: k, cols: [], minWidth: 16 },
        choices: shuffle([ans, ...shuffle(uniq(pool)).slice(0, 3)]), answer: ans,
        explain: `${keyName(k)} major has ${ans}: ${keyAccLetters(k).map(l => l + (k > 0 ? '♯' : '♭')).join(' ')}.`,
        noSound: true, sig: 'kc' + k,
      };
    },
  });

  // ---- Level 9 ----
  const CHORD_KEYS = [0, 0, 1, -1, 2, -2];
  const diatonicNames = k => [0, 1, 2, 3, 4, 5, 6].map(d => triad(k, d).name);
  const diatonicNumerals = k => [0, 1, 2, 3, 4, 5, 6].map(d => triad(k, d).numeral);
  function chordCol(tri, clef, extra = {}) {
    return Object.assign(col(clef, item(tri.notes.map(p => N(p)), 'w')), extra);
  }
  LEVELS.push({
    title: 'Chords: Reading Triads',
    blurb: 'Stacked notes, major and minor',
    lesson: [
      {
        title: 'What is a chord?',
        html: 'A <b>chord</b> is three or more notes played together. The basic chord is a <b>triad</b>: a note plus every other note above it. On the staff a triad looks like a snowman, stacked line-line-line or space-space-space.',
        score: { system: 'treble', cols: [chordCol(chordInStaff(0, 0, 'treble'), 'treble', { below: 'C' }), chordCol(chordInStaff(0, 3, 'treble'), 'treble', { below: 'F' }), chordCol(chordInStaff(0, 4, 'treble'), 'treble', { below: 'G' })] },
        play: { label: '▶ Listen', bpm: 120 },
      },
      {
        title: 'Root, third, fifth',
        html: 'The bottom note of a stacked triad is the <b>root</b>, and it gives the chord its name. The middle note is the <b>third</b> and the top note is the <b>fifth</b>. C – E – G is a C chord.',
        score: { system: 'treble', cols: [chordCol(chordInStaff(0, 0, 'treble'), 'treble', { below: 'C – E – G' })], minWidth: 18, center: true },
        play: { label: '▶ Listen' },
      },
      {
        title: 'Major vs. minor',
        html: 'Count half steps from the root up to the third. <b>4 half steps = major</b> (bright). <b>3 half steps = minor</b> (darker). Listen to the difference.',
        variants: [
          { label: 'C major', html: '<b>C major</b>: C → E is 4 half steps.', score: { system: 'treble', cols: [chordCol(triad(0, 0, 'M', 35), 'treble', { below: 'C' })], minWidth: 18, center: true }, play: { label: '▶ Listen' } },
          { label: 'C minor', html: '<b>C minor</b>: C → E♭ is 3 half steps.', score: { system: 'treble', cols: [chordCol(triad(0, 0, 'm', 35), 'treble', { below: 'Cm' })], minWidth: 18, center: true }, play: { label: '▶ Listen' } },
          { label: 'A minor', html: '<b>A minor</b>: A → C is 3 half steps.', score: { system: 'treble', cols: [chordCol(triad(0, 5, null, 33), 'treble', { below: 'Am' })], minWidth: 18, center: true }, play: { label: '▶ Listen' } },
          { label: 'A major', html: '<b>A major</b>: A → C♯ is 4 half steps.', score: { system: 'treble', cols: [chordCol(triad(0, 5, 'M', 33), 'treble', { below: 'A' })], minWidth: 18, center: true }, play: { label: '▶ Listen' } },
        ],
      },
      {
        title: 'The chords of a key',
        html: 'Build a triad on every note of a major scale and you get its chords, numbered with <b>Roman numerals</b>. Uppercase = major, lowercase = minor, ° = diminished. <b>Every</b> major key follows this same pattern: I ii iii IV V vi vii°.',
        score: { system: 'treble', cols: [0, 1, 2, 3, 4, 5, 6].map(d => chordCol(triad(0, d, null, 30 + ((d + 5) % 7)), 'treble', { above: triad(0, d).numeral, below: triad(0, d).name })) },
        play: { label: '▶ Listen', bpm: 160 },
      },
      {
        title: 'Left-hand chords',
        html: 'The left hand often plays chords too, read from the bass staff. Here are C, F and G in the left hand.',
        score: { system: 'bass', cols: [0, 3, 4].map(d => chordCol(chordInStaff(0, d, 'bass'), 'bass', { below: triad(0, d).name })) },
        play: { label: '▶ Listen', bpm: 120 },
      },
    ],
    gen() {
      const r = rnd();
      const k = pick(CHORD_KEYS);
      const clef = rnd() < 0.6 ? 'treble' : 'bass';
      if (r < 0.45) {
        const deg = rnd() < 0.9 ? rint(0, 5) : 6;
        const tri = chordInStaff(k, deg, clef);
        const altered = tri.notes.filter(p => p.a !== 0);
        return {
          type: 'choice', prompt: `Name this chord${k ? ' (watch the key signature)' : ''}`,
          score: { system: clef, key: k, cols: [chordCol(tri, clef)], minWidth: 18 },
          choices: choicesFrom(tri.name, diatonicNames(k)), answer: tri.name,
          explain: `The bottom note (the root) is <b>${name(tri.notes[0])}</b>. The chord is ${chordNotesStr(tri)}${altered.length ? ` (the key signature makes ${altered.map(name).join(' and ')})` : ''}. Root to third is ${tri.i3} half steps, so it’s ${MT.QUAL_WORD[tri.quality]}: <b>${tri.name}</b>.`,
          sig: `cn${k}${deg}${clef}`,
        };
      }
      if (r < 0.7) {
        const deg = rint(0, 5);
        const tri = chordInStaff(k, deg, clef);
        const ans = tri.quality === 'M' ? 'Major' : 'Minor';
        return {
          type: 'choice', prompt: 'Listen and look: is this chord major or minor?', hearFirst: true,
          score: { system: clef, key: k, cols: [chordCol(tri, clef)], minWidth: 18 },
          choices: ['Major', 'Minor'], answer: ans,
          explain: `${chordNotesStr(tri)}: root to third is ${tri.i3} half steps, so it’s <b>${ans.toLowerCase()}</b> (${tri.name}). Major sounds bright; minor sounds darker.`,
          sig: `mm${k}${deg}${clef}`,
        };
      }
      const deg = rint(0, 6);
      const tri = chordInStaff(k, deg, clef);
      const scaleNames = MT.scale(k).slice(0, 7).map(name);
      return {
        type: 'choice', prompt: `This chord is in <b>${keyName(k)} major</b>. What is its Roman numeral?`,
        score: { system: clef, key: k, cols: [chordCol(tri, clef)], minWidth: 18 },
        choices: choicesFrom(tri.numeral, diatonicNumerals(k)), answer: tri.numeral,
        explain: `Count up the ${keyName(k)} major scale: ${scaleNames.map((n, i) => `${n} = ${MT.ROMAN[i]}`).join(', ')}. The root is ${name(tri.notes[0])}, so it’s ${MT.ROMAN[deg]}. It’s ${MT.QUAL_WORD[tri.quality]}, so it’s written <b>${tri.numeral}</b>.`,
        sig: `rn${k}${deg}${clef}`,
      };
    },
  });

  // ---- Level 10 ----
  const SHORT_PROGS = PROGRESSIONS.filter(p => !p.long);
  const progChoice = p => `${p.name} · ${p.nick.replace(/^The /, '')}`;
  function progLessonVariant(p, k = 0) {
    const labels = progLabels(k, p), names = progNames(k, p);
    return {
      label: p.nick.replace(/^The /, ''),
      html: `<b>${p.nick}</b>: ${p.name}. You’ll hear it in ${p.songs}.${p.minor ? ` It’s in A minor, the relative minor of C major, so the numerals count from A.` : ''}`,
      score: { system: 'grand', key: k, cols: progressionCols(k, p.chords, 'root', { above: labels, below: names }) },
      play: { label: '▶ Play it', bpm: 110 },
    };
  }
  function lhVariant(pattern) {
    return {
      label: PATTERNS[pattern].label,
      html: `<b>${PATTERNS[pattern].label}</b>: ${PATTERNS[pattern].desc}.`,
      score: { system: 'grand', time: [4, 4], cols: progressionCols(0, [0, 3, 4, 0], pattern, { below: ['C', 'F', 'G', 'C'] }) },
      play: { label: '▶ Play it', bpm: 96 },
    };
  }
  LEVELS.push({
    title: 'Progressions & Famous Patterns',
    blurb: 'I–V–vi–IV, ii–V–I, Alberti bass…',
    lesson: [
      {
        title: 'Chord progressions',
        html: 'A <b>chord progression</b> is a series of chords. A handful of progressions appear in thousands of songs. Learn them once and you’ll start hearing them everywhere. In piano music the <b>left hand</b> often plays the root of each chord while the <b>right hand</b> plays the full chord.',
      },
      { title: 'Famous progressions', html: 'Step through them one at a time. Each is shown in C major.', stepper: true, variants: PROGRESSIONS.map(p => progLessonVariant(p)) },
      {
        title: 'Smooth voice leading',
        html: 'Notice the right hand barely moves between chords. Pianists pick the <b>inversion</b> (rearrangement) of each chord that is closest to the last one. The left hand plays the root, so the chord’s name stays clear: <b>read the chord name from the bass note</b>.',
        score: { system: 'grand', cols: progressionCols(0, [0, 3, 4, 0], 'root', { above: ['I', 'IV', 'V', 'I'], below: ['C', 'F', 'G', 'C'] }) },
        play: { label: '▶ Play it', bpm: 110 },
      },
      { title: 'Left-hand patterns', html: 'The same chords can be played with different left-hand patterns. Step through them.', stepper: true, variants: ['block', 'arpeggio', 'alberti', 'oompah'].map(lhVariant) },
      { title: 'Your turn', html: 'Open the <b>Progression Studio</b> from the home screen to play these progressions in any key, with any left-hand pattern. Play-along mode waits for you to play each chord.' },
    ],
    testMix: true,
    gen() {
      const r = rnd();
      const k = pick([0, 0, 1, -1]);
      if (r < 0.35) {
        const p = pick(SHORT_PROGS);
        const pk = p.minor ? 0 : k;
        return {
          type: 'choice', prompt: 'Listen and look: which famous progression is this?', hearFirst: true,
          score: { system: 'grand', key: pk, cols: progressionCols(pk, p.chords, 'root') },
          reveal: { system: 'grand', key: pk, cols: progressionCols(pk, p.chords, 'root', { above: progLabels(pk, p), below: progNames(pk, p) }) },
          choices: choicesFrom(progChoice(p), SHORT_PROGS.map(progChoice)), answer: progChoice(p),
          explain: `The left hand plays the roots: ${progNames(pk, p).join(' – ')}. ${p.minor ? 'In A minor' : `In ${keyName(pk)} major`} that’s ${progLabels(pk, p).join(' – ')}: <b>${p.nick}</b>, heard in ${p.songs}.`,
          play: { bpm: 110, fromReveal: true }, sig: 'fp' + p.id + pk,
        };
      }
      if (r < 0.65) {
        const kk = pick([0, 1, -1, 2]);
        const deg = rint(0, 5);
        const tri = triad(kk, deg);
        const inv = rint(0, 2);
        const rh = MT.voiceInversion(tri.notes, inv);
        const c = { treble: item(rh.map(p => N(p)), 'w'), bass: item([N(MT.lhRoot(tri.notes[0]))], 'w') };
        return {
          type: 'choice', prompt: `In <b>${keyName(kk)} major</b>, what is this chord’s Roman numeral?`,
          score: { system: 'grand', key: kk, cols: [c], minWidth: 18 },
          choices: choicesFrom(tri.numeral, diatonicNumerals(kk)), answer: tri.numeral,
          explain: `The left hand plays the root, <b>${name(tri.notes[0])}</b>. The right hand has ${rh.map(name).join(' – ')}${inv ? `: the same ${tri.name} chord, rearranged (${inv === 1 ? 'first' : 'second'} inversion)` : `: ${tri.name} in root position`}. ${name(tri.notes[0])} is note ${deg + 1} of ${keyName(kk)} major, and the chord is ${MT.QUAL_WORD[tri.quality]}: <b>${tri.numeral}</b>.`,
          sig: `pn${kk}${deg}${inv}`,
        };
      }
      if (r < 0.85) {
        const pattern = pick(['block', 'arpeggio', 'alberti', 'oompah']);
        const deg = pick([0, 3, 4, 5]);
        const tri = triad(k, deg);
        const cols = lhPattern(tri, pattern).map(it => col('bass', it));
        cols.push({ bar: 'end' });
        return {
          type: 'choice', prompt: 'What left-hand pattern is this?',
          score: { system: 'bass', key: k, time: [4, 4], cols },
          choices: ['block', 'arpeggio', 'alberti', 'oompah'].map(x => PATTERNS[x].label), answer: PATTERNS[pattern].label,
          explain: `<b>${PATTERNS[pattern].label}</b>: ${PATTERNS[pattern].desc}. The chord is ${tri.name}.`,
          play: { bpm: 96 }, sig: 'lh' + pattern + deg + k,
        };
      }
      const p = pick(SHORT_PROGS);
      const labels = p.labels || p.chords.map(c => progChord(0, c).numeral);
      let hide = labels.length - 1;
      if (labels[hide] === labels[hide - 1]) hide--;
      const pool = p.minor ? ['i', 'III', 'iv', 'V', 'VI', 'VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi'];
      return {
        type: 'choice', prompt: `<b>${p.nick}</b> goes ${labels.slice(0, hide).join(' – ')} – <b>?</b> What comes next?`,
        score: null,
        reveal: { system: 'grand', key: 0, cols: progressionCols(0, p.chords, 'root', { above: progLabels(0, p), below: progNames(0, p) }) },
        choices: choicesFrom(labels[hide], pool), answer: labels[hide],
        explain: `${p.nick}: <b>${p.name}</b>, heard in ${p.songs}.`,
        play: { bpm: 110, fromReveal: true }, sig: 'nx' + p.id,
      };
    },
  });

  LEVELS.forEach((L, i) => (L.id = i + 1));

  const API = { LEVELS, describePos, PROGRESSIONS, PATTERNS, progressionCols, progLabels, progNames, progChord, lhPattern, HL, OK, BAD, shuffle, pick };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Levels = API;
})(typeof window !== 'undefined' ? window : globalThis);
