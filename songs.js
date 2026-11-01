// songs.js — one bonus song per level, plus the builder that turns them into score columns and play-along steps.
//
// Song format: each measure has `rh` (treble) and/or `lh` (bass) as space-separated tokens.
//   Token: PITCH[+PITCH...]:DUR   e.g. C5:q   A4+C5+E5:h   F#4:q.   Bb2:e   r:h (rest)
//   DUR is w h q e s, plus "." per dot. Pitches are absolute (write Bb in F major, F# in G major);
//   the renderer prints only the accidentals the key signature and the measure don't already cover.
//   A token can end in @Name/Numeral to print a chord label above (name) and below (numeral).
(function (root) {
  'use strict';
  const MT = root.MT || (typeof require !== 'undefined' ? require('./music.js') : null);

  const SONGS = [
    {
      level: 1, title: 'Mary Had a Little Lamb', by: 'Traditional',
      system: 'treble', key: 0, time: [4, 4], bpm: 100,
      about: 'Your first real song, all in the right hand. It only uses four notes, <b>G A B D</b>, and every one of them sits on a line or in a space of the treble staff.',
      look: ['G is line 2: the line the treble clef curls around.', 'B is the middle line. The tune keeps coming back to it.', 'D is line 4. It only shows up in measure 4.'],
      measures: [
        { rh: 'B4:q A4:q G4:q A4:q' }, { rh: 'B4:q B4:q B4:h' }, { rh: 'A4:q A4:q A4:h' }, { rh: 'B4:q D5:q D5:h' },
        { rh: 'B4:q A4:q G4:q A4:q' }, { rh: 'B4:q B4:q B4:q B4:q' }, { rh: 'A4:q A4:q B4:q A4:q' }, { rh: 'G4:w' },
      ],
    },
    {
      level: 2, title: 'Twinkle, Twinkle, Little Star', by: 'Traditional (French melody)',
      system: 'bass', key: 0, time: [4, 4], bpm: 100,
      about: 'The whole tune is in the left hand, on the bass staff. It uses <b>C D E F G A</b>, from space 2 up to the top line.',
      look: ['The first jump is from C (space 2) up to G (space 4).', 'The bass names are different from the treble names: the top line is A, not F.', 'Measures 5–8 repeat the same two measures twice.'],
      measures: [
        { lh: 'C3:q C3:q G3:q G3:q' }, { lh: 'A3:q A3:q G3:h' }, { lh: 'F3:q F3:q E3:q E3:q' }, { lh: 'D3:q D3:q C3:h' },
        { lh: 'G3:q G3:q F3:q F3:q' }, { lh: 'E3:q E3:q D3:h' }, { lh: 'G3:q G3:q F3:q F3:q' }, { lh: 'E3:q E3:q D3:h' },
        { lh: 'C3:q C3:q G3:q G3:q' }, { lh: 'A3:q A3:q G3:h' }, { lh: 'F3:q F3:q E3:q E3:q' }, { lh: 'D3:q D3:q C3:h' },
      ],
    },
    {
      level: 3, title: 'Hot Cross Buns', by: 'Traditional',
      system: 'grand', key: 0, time: [4, 4], bpm: 100,
      about: 'The tune is played twice at exactly the same pitch: first in the right hand, then in the left. It sits right around <b>middle C</b>, so it needs ledger lines on both staves.',
      look: ['Treble staff: middle C is on a ledger line <i>below</i> the staff, and D hangs just under the staff.', 'Bass staff: the same middle C is on a ledger line <i>above</i> the staff, and E needs two ledger lines.', 'They are the same piano keys both times. Only the way they are written changes.'],
      measures: [
        { rh: 'E4:q D4:q C4:h', lh: 'r:w' }, { rh: 'E4:q D4:q C4:h', lh: 'r:w' },
        { rh: 'C4:q C4:q C4:q C4:q', lh: 'r:w' }, { rh: 'D4:q D4:q D4:q D4:q', lh: 'r:w' }, { rh: 'E4:q D4:q C4:h', lh: 'r:w' },
        { rh: 'r:w', lh: 'E4:q D4:q C4:h' }, { rh: 'r:w', lh: 'E4:q D4:q C4:h' },
        { rh: 'r:w', lh: 'C4:q C4:q C4:q C4:q' }, { rh: 'r:w', lh: 'D4:q D4:q D4:q D4:q' }, { rh: 'r:w', lh: 'E4:q D4:q C4:h' },
      ],
    },
    {
      level: 4, title: 'Jingle Bells (chorus)', by: 'James Lord Pierpont, 1857',
      system: 'grand', key: 0, time: [4, 4], bpm: 112,
      about: 'Now both hands play together. The right hand has the tune, and the left hand holds one long bass note under each measure.',
      look: ['Notes lined up one above the other are played at the same time.', 'The left hand plays on beat 1, together with the first right-hand note of each measure.', 'Measure 7 is the only one where the left hand changes in the middle of the measure.'],
      measures: [
        { rh: 'E4:q E4:q E4:h', lh: 'C3:w' }, { rh: 'E4:q E4:q E4:h', lh: 'C3:w' }, { rh: 'E4:q G4:q C4:q D4:q', lh: 'C3:w' }, { rh: 'E4:w', lh: 'C3:w' },
        { rh: 'F4:q F4:q F4:q F4:q', lh: 'F3:w' }, { rh: 'F4:q E4:q E4:q E4:q', lh: 'C3:w' }, { rh: 'E4:q D4:q D4:q E4:q', lh: 'D3:h G2:h' }, { rh: 'D4:h G4:h', lh: 'G2:w' },
        { rh: 'E4:q E4:q E4:h', lh: 'C3:w' }, { rh: 'E4:q E4:q E4:h', lh: 'C3:w' }, { rh: 'E4:q G4:q C4:q D4:q', lh: 'C3:w' }, { rh: 'E4:w', lh: 'C3:w' },
        { rh: 'F4:q F4:q F4:q F4:q', lh: 'F3:w' }, { rh: 'F4:q E4:q E4:q E4:q', lh: 'C3:w' }, { rh: 'G4:q G4:q F4:q D4:q', lh: 'G2:w' }, { rh: 'C4:w', lh: 'C3+G3:w' },
      ],
    },
    {
      level: 5, title: 'When the Saints Go Marching In', by: 'Traditional spiritual',
      system: 'grand', key: 0, time: [4, 4], bpm: 120,
      about: 'Almost every phrase starts with a <b>rest</b>: count it silently, then come in on beat 2. The song uses whole, half, quarter and eighth notes, plus whole, half and quarter rests.',
      look: ['The quarter rest (the zig-zag) is beat 1. Wait for it.', 'In measures 1, 3, 5 and 9 the left hand has a whole rest: it sits out the whole measure.', 'Measure 11 starts with two eighth notes joined by a beam. Together they take one beat.'],
      measures: [
        { rh: 'r:q C4:q E4:q F4:q', lh: 'r:w' }, { rh: 'G4:w', lh: 'C3:w' },
        { rh: 'r:q C4:q E4:q F4:q', lh: 'r:w' }, { rh: 'G4:w', lh: 'C3:w' },
        { rh: 'r:q C4:q E4:q F4:q', lh: 'r:w' }, { rh: 'G4:h E4:h', lh: 'C3:h G2:h' },
        { rh: 'C4:h E4:h', lh: 'C3:h r:h' }, { rh: 'D4:w', lh: 'G2:w' },
        { rh: 'r:q E4:q E4:q D4:q', lh: 'r:w' }, { rh: 'C4:h C4:q E4:q', lh: 'C3:w' },
        { rh: 'G4:e G4:e G4:q F4:h', lh: 'F3:w' }, { rh: 'r:h E4:q F4:q', lh: 'C3:h r:h' },
        { rh: 'G4:q E4:q C4:q D4:q', lh: 'C3:h G2:h' }, { rh: 'C4:w', lh: 'C3:w' },
      ],
    },
    {
      level: 6, title: 'Amazing Grace', by: 'Traditional melody (“New Britain”), words by John Newton',
      system: 'grand', key: 0, time: [3, 4], bpm: 92, pickup: 1,
      about: 'A song in <b>3/4</b>: count “1 2 3” in every measure. It starts on beat 3 with a single <b>pickup</b> note before the first bar line. That missing beat is made up in the short last measure.',
      look: ['The left hand mostly plays dotted half notes: 2 + 1 = 3 beats, the whole measure.', 'Measures 7 and 14: in the left hand, a dotted quarter (1½) plus an eighth (½) fills two beats.', 'Count the pickup as “3”, then the first full measure starts on “1”.'],
      measures: [
        { rh: 'G3:q', lh: 'r:q' },
        { rh: 'C4:h E4:e C4:e', lh: 'C3:h.' }, { rh: 'E4:h D4:q', lh: 'C3:h.' }, { rh: 'C4:h A3:q', lh: 'F3:h.' }, { rh: 'G3:h G3:q', lh: 'C3:h.' },
        { rh: 'C4:h E4:e C4:e', lh: 'C3:h.' }, { rh: 'E4:h D4:e E4:e', lh: 'G2:h.' }, { rh: 'G4:h.', lh: 'G2:q. D3:e G3:q' }, { rh: 'G4:h E4:q', lh: 'C3:h.' },
        { rh: 'G4:h E4:e C4:e', lh: 'C3:h.' }, { rh: 'E4:h D4:q', lh: 'C3:h.' }, { rh: 'C4:h A3:q', lh: 'F3:h.' }, { rh: 'G3:h G3:q', lh: 'C3:h.' },
        { rh: 'C4:h E4:e C4:e', lh: 'C3:h.' }, { rh: 'E4:h D4:q', lh: 'G2:q. D3:e G3:q' }, { rh: 'C4:h.', lh: 'C3:h.' },
        { rh: 'C4:h', lh: 'C3:h' },
      ],
    },
    {
      level: 7, title: 'Für Elise (opening)', by: 'Ludwig van Beethoven, 1810',
      system: 'grand', key: 0, time: [3, 4], bpm: 72, pickup: 1,
      about: 'Beethoven’s famous opening rocks between <b>E and D♯</b>. It’s written here in 3/4 with eighth notes (the original is in 3/8 with sixteenths, so it sounds the same but looks busier).',
      look: ['Measure 1: the sharp on D♯ lasts for the whole measure, so the plain D later in that measure needs a <b>natural</b> sign ♮.', 'The next measure starts fresh: D♯ needs its sharp written again.', 'Measure 3 has a G♯: the black key just above G.'],
      measures: [
        { rh: 'E5:e D#5:e', lh: 'r:q' },
        { rh: 'E5:e D#5:e E5:e B4:e D5:e C5:e', lh: 'r:h.' },
        { rh: 'A4:q r:e C4:e E4:e A4:e', lh: 'A2:h.' },
        { rh: 'B4:q r:e E4:e G#4:e B4:e', lh: 'E3:h.' },
        { rh: 'C5:q r:e E4:e E5:e D#5:e', lh: 'A2:h.' },
        { rh: 'E5:e D#5:e E5:e B4:e D5:e C5:e', lh: 'r:h.' },
        { rh: 'A4:q r:e C4:e E4:e A4:e', lh: 'A2:h.' },
        { rh: 'B4:q r:e E4:e C5:e B4:e', lh: 'E3:h.' },
        { rh: 'A4:h', lh: 'A2:h' },
      ],
    },
    {
      level: 8, title: 'Minuet in G', by: 'Christian Petzold, c. 1725 (long credited to J. S. Bach)',
      system: 'grand', key: 1, time: [3, 4], bpm: 104,
      about: 'In the key of <b>G major</b>. The one sharp in the key signature, on the F line, means every F in the piece is played as <b>F♯</b>, even though no sharp is written next to the notes.',
      look: ['Measure 3 ends on the top line of the treble staff: that F is F♯.', 'Measure 7 starts on F♯ in the bottom space, and measure 8’s left hand climbs D – F♯ – A.', 'The tune walks up and down the G major scale: G A B C D E F♯ G.'],
      measures: [
        { rh: 'D5:q G4:e A4:e B4:e C5:e', lh: 'G3+B3:h A3:q' }, { rh: 'D5:q G4:q G4:q', lh: 'B3:h.' },
        { rh: 'E5:q C5:e D5:e E5:e F#5:e', lh: 'C4:h.' }, { rh: 'G5:q G4:q G4:q', lh: 'B3:h.' },
        { rh: 'C5:q D5:e C5:e B4:e A4:e', lh: 'A3:h.' }, { rh: 'B4:q C5:e B4:e A4:e G4:e', lh: 'G3:h.' },
        { rh: 'F#4:q G4:e A4:e B4:e G4:e', lh: 'D3:h.' }, { rh: 'A4:h.', lh: 'D3:q F#3:q A3:q' },
        { rh: 'D5:q G4:e A4:e B4:e C5:e', lh: 'G3+B3:h A3:q' }, { rh: 'D5:q G4:q G4:q', lh: 'B3:h.' },
        { rh: 'E5:q C5:e D5:e E5:e F#5:e', lh: 'C4:h.' }, { rh: 'G5:q G4:q G4:q', lh: 'B3:h.' },
        { rh: 'C5:q D5:e C5:e B4:e A4:e', lh: 'A3:h.' }, { rh: 'B4:q C5:e B4:e A4:e G4:e', lh: 'G3:h.' },
        { rh: 'A4:q B4:e A4:e G4:e F#4:e', lh: 'D3:h.' }, { rh: 'G4:h.', lh: 'G2:h.' },
      ],
    },
    {
      level: 9, title: 'Ode to Joy', by: 'Ludwig van Beethoven, Symphony No. 9, 1824',
      system: 'grand', key: 0, time: [4, 4], bpm: 104,
      about: 'The right hand plays the tune. The left hand plays a <b>triad</b> under each measure: three notes stacked line-line-line or space-space-space. Chord names are shown above the music and Roman numerals below.',
      look: ['C, F and G are <b>major</b> chords (I, IV, V). Am is <b>minor</b> (vi).', 'In each chord the bottom note is the root, the note the chord is named after.', 'In the last measure the left hand changes chord halfway: G (V) to C (I), the classic ending.'],
      measures: [
        { rh: 'E4:q E4:q F4:q G4:q', lh: 'C3+E3+G3:w@C/I' }, { rh: 'G4:q F4:q E4:q D4:q', lh: 'G2+B2+D3:w@G/V' },
        { rh: 'C4:q C4:q D4:q E4:q', lh: 'A2+C3+E3:w@Am/vi' }, { rh: 'E4:q. D4:e D4:h', lh: 'G2+B2+D3:w@G/V' },
        { rh: 'E4:q E4:q F4:q G4:q', lh: 'C3+E3+G3:w@C/I' }, { rh: 'G4:q F4:q E4:q D4:q', lh: 'G2+B2+D3:w@G/V' },
        { rh: 'C4:q C4:q D4:q E4:q', lh: 'F2+A2+C3:w@F/IV' }, { rh: 'D4:q. C4:e C4:h', lh: 'G2+B2+D3:h@G/V C3+E3+G3:h@C/I' },
      ],
    },
    {
      level: 10, title: 'Sunday Drive', by: 'Original, written for Piano Tutor',
      system: 'grand', key: -1, time: [4, 4], bpm: 92,
      about: 'A short original piece in <b>F major</b> (one flat: every B is B♭) that uses everything: both hands, the pop progression <b>I – V – vi – IV</b>, then <b>I – vi – IV – V</b>, two left-hand patterns, dotted rhythms, eighth notes and accidentals.',
      look: [
        '<b>The pattern, line 1:</b> each measure has the same rhythm (dotted quarter, eighth, quarter, quarter) and the same shape: start high, step down twice, bounce back up. That shape moves to fit each chord: F, C, Dm, B♭.',
        '<b>The pattern, line 2:</b> every measure is four eighth notes and then a half note. Measure 7 is measure 5’s run, moved up to the B♭ chord. Measure 8 runs back down.',
        'Left hand: <b>oom-pah</b> in line 1, then <b>Alberti bass</b> (low – high – middle – high) in line 2.',
        'Measure 6: C♯ then C♮ in the same measure. The natural cancels the sharp.',
      ],
      measures: [
        { rh: 'C5:q. A4:e F4:q A4:q', lh: 'F2:q@F/I A2+C3:q F2:q A2+C3:q' },
        { rh: 'C5:q. G4:e E4:q G4:q', lh: 'C3:q@C/V E3+G3:q C3:q E3+G3:q' },
        { rh: 'D5:q. A4:e F4:q A4:q', lh: 'D3:q@Dm/vi F3+A3:q D3:q F3+A3:q' },
        { rh: 'D5:q. Bb4:e F4:h', lh: 'Bb2:q@B♭/IV D3+F3:q Bb2:q D3+F3:q' },
        { rh: 'F4:e G4:e A4:e C5:e A4:h', lh: 'F2:e@F/I C3:e A2:e C3:e F2:e C3:e A2:e C3:e' },
        { rh: 'D5:e C#5:e D5:e C5:e A4:h', lh: 'D3:e@Dm/vi A3:e F3:e A3:e D3:e A3:e F3:e A3:e' },
        { rh: 'Bb4:e C5:e D5:e F5:e D5:h', lh: 'Bb2:e@B♭/IV F3:e D3:e F3:e Bb2:e F3:e D3:e F3:e' },
        { rh: 'E5:e D5:e C5:e Bb4:e G4:h', lh: 'C3:e@C/V G3:e E3:e G3:e C3:e G3:e E3:e G3:e' },
        { rh: 'F4+A4+C5:w', lh: 'F2+A2+C3:w@F/I' },
      ],
    },
  ];

  // ---------- builder ----------
  const DUR = /^([whqes])(\.{0,2})$/;
  const EPS = 1e-9;
  let beamN = 0;

  function parseTok(tok) {
    let label = null;
    const at = tok.indexOf('@');
    if (at >= 0) { label = tok.slice(at + 1).split('/'); tok = tok.slice(0, at); }
    const [ps, d] = tok.split(':');
    const m = DUR.exec(d || '');
    if (!m) throw new Error('bad duration in ' + tok);
    const dur = m[1], dots = m[2].length, rest = ps === 'r';
    return { dur, dots, rest, notes: rest ? [] : ps.split('+').map(s => MT.parse(s)), b: MT.beats(dur, dots), label };
  }
  const parseLine = s => (s ? s.trim().split(/\s+/).map(parseTok) : []);

  // Beam runs of same-length eighths/sixteenths that fall inside the same beam unit (in quarter beats).
  function autoBeam(evs, unit) {
    let run = [];
    const flush = () => { if (run.length > 1) { const id = 'sb' + ++beamN; run.forEach(e => (e.beam = id)); } run = []; };
    for (const e of evs) {
      const ok = !e.rest && (e.dur === 'e' || e.dur === 's') && !e.dots;
      const u = Math.floor(e.t / unit + EPS);
      const fits = ok && Math.floor((e.t + e.b) / unit - EPS) === u;
      if (fits && run.length && run[0].dur === e.dur && run[0]._u === u) run.push(e);
      else { flush(); if (fits) { e._u = u; run = [e]; } }
    }
    flush();
  }

  function build(song, opts = {}) {
    const staves = song.system === 'grand' ? ['treble', 'bass'] : [song.system];
    const src = { treble: 'rh', bass: 'lh' };
    const bpb = song.time[0] * 4 / song.time[1];
    const unit = song.beamUnit || (song.time[0] === 4 ? 2 : 1);
    const n = song.measures.length;
    let gid = 0;
    const measures = song.measures.map((ms, mi) => {
      const expected = song.pickup && mi === 0 ? song.pickup : song.pickup && mi === n - 1 ? bpb - song.pickup : bpb;
      const parts = {};
      for (const st of staves) {
        const evs = parseLine(ms[src[st]]);
        let t = 0;
        evs.forEach(e => { e.t = t; t += e.b; });
        if (Math.abs(t - expected) > EPS) throw new Error(`${song.title}, measure ${mi + 1} (${src[st]}): ${t} beats, expected ${expected}`);
        autoBeam(evs, unit);
        parts[st] = evs;
      }
      const times = [...new Set(staves.flatMap(st => parts[st].map(e => e.t)))].sort((a, b) => a - b);
      return times.map((t, i) => {
        const c = { m: gid++, measure: mi, adv: (i < times.length - 1 ? times[i + 1] : expected) - t };
        for (const st of staves) {
          const e = parts[st].find(x => Math.abs(x.t - t) < EPS);
          if (!e) continue;
          c[st] = e.rest ? { notes: [], dur: e.dur, dots: e.dots, rest: true }
            : { notes: e.notes.map(p => ({ p })), dur: e.dur, dots: e.dots, beam: e.beam };
          if (e.label) { c.above = e.label[0]; if (e.label[1]) c.below = e.label[1]; }
        }
        return c;
      });
    });

    // Lines of music: `perLine` full measures each; a pickup rides along on the first line.
    const perLine = opts.perLine || song.perLine || 4;
    const lines = [];
    let cur = [], full = 0;
    measures.forEach((cols, mi) => {
      cur.push(...cols, { bar: mi === n - 1 ? 'end' : true });
      if (!(song.pickup && mi === 0)) full++;
      if (full === perLine || mi === n - 1) {
        // Never leave a single measure alone on the last line: it would be stretched across the page.
        if (mi === n - 1 && full === 1 && lines.length) lines[lines.length - 1].push(...cur);
        else lines.push(cur);
        cur = []; full = 0;
      }
    });
    const allCols = lines.flat();

    const steps = [];
    let lo = Infinity, hi = -Infinity;
    allCols.forEach(c => {
      if (c.bar) return;
      const s = { gid: c.m, measure: c.measure, adv: c.adv, treble: [], bass: [], beats: {} };
      for (const st of ['treble', 'bass']) {
        const it = c[st];
        if (it && !it.rest) { s[st] = it.notes.map(x => MT.midi(x.p)); s.beats[st] = MT.beats(it.dur, it.dots); }
        s[st].forEach(m => { lo = Math.min(lo, m); hi = Math.max(hi, m); });
      }
      if (s.treble.length || s.bass.length) steps.push(s);
    });
    lo -= MT.mod12(lo);
    hi = hi - MT.mod12(hi) + 12;
    if (hi - lo < 24) hi = lo + 24;

    const labelled = allCols.some(c => c.above || c.below), m = labelled ? 6 : 4.5; // room above/below for chord labels
    const specs = lines.map((cols, i) => ({ system: song.system, key: song.key, time: i === 0 ? song.time : null, cols, scale: 1.3, top: m, bottom: m }));
    justify(specs);
    return { song, specs, allCols, steps, range: { lo, hi } };
  }

  // Spread extra space over the columns so every line comes out the same width (and the same staff size).
  function justify(specs) {
    const width = sp => +/viewBox="0 0 ([\d.]+)/.exec(MT.renderScore(sp))[1];
    const ws = specs.map(width), target = Math.max(...ws);
    specs.forEach((sp, i) => {
      const notes = sp.cols.filter(c => !c.bar);
      const pad = (target - ws[i]) / MT.S / notes.length;
      if (pad > 0.01) notes.forEach(c => (c.pad = pad));
    });
  }

  const forLevel = id => SONGS.find(s => s.level === id);
  const API = { SONGS, build, forLevel };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Songs = API;
})(typeof window !== 'undefined' ? window : globalThis);
