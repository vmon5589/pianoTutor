// app.js — screens: home, level (learn / practice / test), Progression Studio.
(function () {
  'use strict';
  const { LEVELS, PROGRESSIONS, PATTERNS, progressionCols, progLabels, progNames, progChord, describePos, HL, OK, BAD } = Levels;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const app = $('#app');

  // ---------- progress ----------
  const STORE = 'pianoTutor.v1';
  let progress;
  try { progress = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { progress = {}; }
  progress.best = progress.best || {};
  progress.passed = progress.passed || {};
  progress.bonus = progress.bonus || {};
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* private mode */ } };
  const isUnlocked = id => id === 1 || !!progress.passed[id - 1];
  const stars = s => (s >= 10 ? '★★★' : s >= 9 ? '★★☆' : s >= 8 ? '★☆☆' : '');

  // ---------- audio ----------
  let player = null;
  function stopAudio() { if (player) { player.stop(); player = null; } }
  function playWithHighlight(cols, opts, svgs) {
    stopAudio();
    const clear = () => svgs.forEach(svg => svg && $$('.col.now', svg).forEach(g => g.classList.remove('now')));
    player = MT.playCols(cols, Object.assign({}, opts, {
      onCol: i => {
        clear();
        svgs.forEach(svg => { const g = svg && svg.querySelector(`.col[data-i="${i}"]`); if (g) g.classList.add('now'); });
        if (opts.onCol) opts.onCol(i);
      },
      onEnd: () => { clear(); player = null; if (opts.onEnd) opts.onEnd(); },
    }));
  }

  // ---------- lesson piano (toggle) ----------
  const PIANO_KEY = 'pianoTutor.showPiano';
  let showPiano = false;
  try { showPiano = localStorage.getItem(PIANO_KEY) === '1'; } catch (e) { /* private mode */ }
  const HAND_COLOR = { treble: HL, bass: '#f08c00' };
  const SIDE = { treble: 'right', bass: 'left' };
  const narrow = () => window.matchMedia('(max-width: 560px)').matches;
  // Phones: keep the pinned keyboard small (cropped hands; shorter keys when the screen is short).
  const kbSize = () => ({
    shortKeys: window.matchMedia('(max-height: 500px)').matches,
    handH: window.matchMedia('(max-width: 560px), (max-height: 500px)').matches ? 74 : undefined,
  });

  // On small screens keyboards are wider than the screen and scroll sideways.
  // Bring these keys into view (if they don't all fit, start from the lowest).
  function revealKeys(box, midis) {
    if (!box || !midis.length || box.scrollWidth <= box.clientWidth + 1) return;
    const bl = box.getBoundingClientRect().left;
    const xs = [];
    midis.forEach(m => {
      const k = box.querySelector(`.key[data-midi="${m}"] rect`);
      if (k) { const r = k.getBoundingClientRect(); xs.push(r.left - bl + box.scrollLeft, r.right - bl + box.scrollLeft); }
    });
    if (!xs.length) return;
    const lo = Math.min(...xs), hi = Math.max(...xs), w = box.clientWidth, pad = 36;
    // Judge against where a smooth scroll already under way will end up, not where it is mid-slide.
    const cur = box._goal != null ? box._goal : box.scrollLeft;
    if (lo - pad >= cur && hi + pad <= cur + w) return;
    const left = Math.min(box.scrollWidth - w, Math.max(0, hi - lo + 2 * pad <= w ? (lo + hi) / 2 - w / 2 : lo - pad));
    box._goal = left;
    clearTimeout(box._goalT);
    box._goalT = setTimeout(() => (box._goal = null), 700);
    box.scrollTo({ left, behavior: 'smooth' });
  }
  const handKeys = hands => hands.flatMap(h => Object.values(h.keys));
  const HANDS_KEY = 'pianoTutor.showHands';
  let showHands = true;
  try { showHands = localStorage.getItem(HANDS_KEY) !== '0'; } catch (e) { /* private mode */ }
  const handsLabel = () => (showHands ? '✋ <span class="wide">Hide hands</span><span class="narrow">Hands</span>' : '✋ Hands');
  // A pill that turns the hand silhouettes on/off everywhere (remembered), then calls redraw().
  function handsToggle(btn, redraw) {
    const sync = () => { btn.innerHTML = handsLabel(); btn.classList.toggle('on', showHands); };
    sync();
    btn.addEventListener('click', () => {
      showHands = !showHands;
      try { localStorage.setItem(HANDS_KEY, showHands ? '1' : '0'); } catch (e) { /* private mode */ }
      sync();
      redraw();
    });
  }

  // Hand silhouettes for a run of score columns, with fingering worked out across all of them.
  // focus: column index whose hand position to show (default: the first note).
  // colors: { midi: color } of fingers to light (default: every note in that hand position).
  function handsFor(cols, focus, colors) {
    const out = [];
    if (!showHands) return out;
    for (const st of ['treble', 'bass']) {
      const groups = cols.map(c => (c[st] && !c[st].rest && c[st].notes ? c[st].notes.map(n => n.p) : []));
      if (!groups.some(g => g.length)) continue;
      const plan = MT.planHand(groups, SIDE[st]);
      const P = plan[focus != null ? focus : groups.findIndex(g => g.length)];
      if (!P) continue;
      const active = {};
      for (let f = 1; f <= 5; f++) {
        const m = P.keys[f];
        if (colors) { if (colors[m]) active[f] = colors[m]; }
        else if (plan.some(q => q && q.seg === P.seg && q.fingers.some(x => x.f === f))) active[f] = HAND_COLOR[st];
      }
      out.push({ side: SIDE[st], keys: P.keys, active });
    }
    return out;
  }
  // Grow a keyboard range (whole octaves) so every finger of every hand is on it.
  function allHands(fn) { const was = showHands; showHands = true; try { return fn(); } finally { showHands = was; } }
  function widen(range, hands) {
    let { lo, hi } = range;
    hands.forEach(h => Object.values(h.keys).forEach(m => { lo = Math.min(lo, m - MT.mod12(m)); hi = Math.max(hi, m - MT.mod12(m) + 12); }));
    return { lo, hi };
  }

  // Every note in a score, with its column, start beat and end beat.
  function scoreNotes(spec) {
    const out = [];
    let t = 0;
    (spec.cols || []).forEach((c, i) => {
      if (c.bar) return;
      if (c.blank) { t += c.blank; return; }
      let adv = null;
      for (const st of ['treble', 'bass']) {
        const it = c[st];
        if (!it) continue;
        const b = MT.beats(it.dur, it.dots);
        if (!it.rest) it.notes.forEach(n => out.push({ m: MT.midi(n.p), st, label: MT.name(n.p), col: i, t0: t, t1: t + b }));
        adv = adv == null ? b : Math.min(adv, b);
      }
      t += adv || 0;
    });
    return out;
  }
  // Keyboard range: whole octaves C..C covering the notes (or the clickable staff), at least two octaves.
  function pianoRange(spec, notes) {
    let ms = notes.map(n => n.m);
    if (!ms.length && spec.click) {
      (Array.isArray(spec.click) ? spec.click : [spec.click]).forEach(t => ms.push(MT.midi(MT.atPos(t.pmin, t.staff)), MT.midi(MT.atPos(t.pmax, t.staff))));
    }
    if (!ms.length) ms = spec.system === 'bass' ? [43, 57] : spec.system === 'grand' ? [43, 77] : [64, 77];
    let lo = Math.min(...ms), hi = Math.max(...ms);
    lo -= MT.mod12(lo);
    hi = hi - MT.mod12(hi) + 12;
    if (hi - lo < 24) hi = lo + 24;
    return { lo, hi };
  }
  // lit: list of notes to light (default: all notes in the score).
  function drawLessonPiano(card, lit) {
    const box = $('.pianoAbove', card), spec = card._spec;
    const btn = $('.ptoggle', card);
    const available = !!spec && !(card._v && card._v.keyboard);
    btn.hidden = !available;
    btn.classList.toggle('on', showPiano);
    const hb = $('.htoggle', card);
    hb.hidden = !available || !showPiano || !scoreNotes(spec || {}).length;
    btn.innerHTML = showPiano ? '🎹 <span class="wide">Hide piano</span><span class="narrow">Piano</span>' : '🎹 Piano';
    if (!available || !showPiano) { box.innerHTML = ''; return; }
    const notes = scoreNotes(spec);
    const cols = spec.cols || [];
    if (!card._range) card._range = notes.length ? widen(pianoRange(spec, notes), allHands(() => handsFor(cols))) : pianoRange(spec, notes);
    const range = card._range;
    const marks = {}, labels = {};
    (lit || notes).forEach(n => { marks[n.m] = HAND_COLOR[n.st]; labels[n.m] = n.label; });
    // Hands: during playback, the position for the latest sounding note; otherwise the first position.
    let handList = [];
    if (notes.length && (!lit || lit.length)) {
      const focus = lit ? Math.max(...lit.map(n => n.col)) : null;
      handList = handsFor(cols, focus, lit ? marks : null);
    }
    const hands = new Set(notes.map(n => n.st));
    box.innerHTML = MT.renderKeyboard(Object.assign({}, range, { marks, labels, hands: handList })) +
      (hands.size > 1 ? `<div class="legend small"><span style="color:${HAND_COLOR.treble}">■</span> right hand <span style="color:${HAND_COLOR.bass}">■</span> left hand</div>` : '');
    wireKeyboard(box, m => MT.Sound.tone(m, null, 0.8));
    revealKeys(box, (lit || notes).map(n => n.m));
  }

  let keyHandler = null;
  document.addEventListener('keydown', e => {
    if (!keyHandler || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches && e.target.matches('input, select, textarea')) return;
    keyHandler(e);
  });

  // ---------- shared widgets ----------
  function wireKeyboard(box, onKey) {
    $$('.key', box).forEach(k => k.addEventListener('pointerdown', e => { e.preventDefault(); onKey(+k.dataset.midi); }));
  }
  function wireStaff(box, onPick) {
    const svg = $('svg', box), ghost = $('.ghost', svg);
    const gx = +ghost.dataset.x, ys = {};
    ghost.style.pointerEvents = 'none';
    $$('.hit', svg).forEach(h => { (ys[h.dataset.staff] = ys[h.dataset.staff] || {})[h.dataset.pos] = +h.dataset.y; });
    svg._ys = ys;
    svg._gx = gx;
    $$('.hit', svg).forEach(h => {
      const st = h.dataset.staff, pos = +h.dataset.pos;
      h.addEventListener('mouseenter', () => { ghost.innerHTML = MT.ghostNote(gx, pos, k => ys[st][k]); ghost.style.display = ''; });
      h.addEventListener('click', () => onPick(st, pos));
    });
    svg.addEventListener('mouseleave', () => (ghost.style.display = 'none'));
  }
  function placeMark(box, st, pos, color, dx = 0, replace = false) {
    const svg = $('svg', box);
    if (replace) $$('.placed', svg).forEach(g => g.remove());
    svg.insertAdjacentHTML('beforeend', `<g class="placed" color="${color}" pointer-events="none">${MT.ghostNote(svg._gx + dx, pos, k => svg._ys[st][k])}</g>`);
  }
  function fresh(gen, avoid) {
    let q;
    for (let i = 0; i < 30; i++) { q = gen(); if (!avoid.includes(q.sig)) return q; }
    return q;
  }

  // ---------- home ----------
  function home() {
    stopAudio(); keyHandler = null; teardownStudio();
    const passed = LEVELS.filter(L => progress.passed[L.id]).length;
    app.innerHTML = `
      <header class="hero">
        <h1>Piano Tutor</h1>
        <p>Learn to read piano music in ten levels, from your first note to famous chord progressions. Pass each level’s test (8 out of 10) to unlock the next one.</p>
        <div class="bar"><div style="width:${passed * 10}%"></div></div>
        <div class="muted small">${passed} of 10 levels passed</div>
      </header>
      <div class="levels">
        ${LEVELS.map(L => {
          const un = isUnlocked(L.id), ps = progress.passed[L.id], best = progress.best[L.id];
          const status = ps ? `<span class="stars">${stars(best)}</span> ${best}/10`
            : un ? (best != null ? `Best ${best}/10` : 'Start →') : `🔒 Pass level ${L.id - 1}`;
          const bb = progress.bonus[L.id];
          return `<button class="level${un ? '' : ' locked'}${ps ? ' passed' : ''}" data-id="${L.id}" ${un ? '' : 'disabled'}>
            <span class="num">${L.id}</span><span class="lt">${L.title}</span><span class="lb">${L.blurb}</span><span class="ls">${status}${bb != null ? ` <span class="bonusbadge">♪ ${bb}%</span>` : ''}</span></button>`;
        }).join('')}
      </div>
      <button class="studio-card"><span class="lt">🎹 Progression Studio</span><span class="lb">Play famous chord progressions in any key with any left-hand pattern. Play-along mode waits for you to play each chord, on screen or on a MIDI keyboard.</span></button>
      <footer><button class="link" id="reset">Reset progress</button></footer>`;
    $$('.level').forEach(b => b.addEventListener('click', () => levelScreen(+b.dataset.id, 'learn')));
    $('.studio-card').addEventListener('click', studio);
    $('#reset').addEventListener('click', () => {
      if (confirm('Reset all progress?')) { progress = { best: {}, passed: {}, bonus: {} }; save(); home(); }
    });
    window.scrollTo(0, 0);
  }

  // ---------- level ----------
  function levelScreen(id, tab) {
    stopAudio(); keyHandler = null; teardownStudio();
    const L = LEVELS[id - 1];
    app.innerHTML = `
      <div class="topbar">
        <button class="ghost back">← Levels</button>
        <div class="ltitle"><span class="muted">Level ${id}</span> ${L.title}</div>
        <nav class="tabs">${[['learn', 'Learn'], ['practice', 'Practice'], ['test', 'Test'], ['bonus', '♪ Bonus<span class="wide"> song</span>']].map(([t, n]) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${n}</button>`).join('')}</nav>
      </div>
      <main id="pane"></main>`;
    $('.back').addEventListener('click', home);
    $$('.tabs button').forEach(b => b.addEventListener('click', () => levelScreen(id, b.dataset.tab)));
    const pane = $('#pane');
    if (tab === 'learn') learn(L, pane, 0);
    else if (tab === 'practice') practice(L, pane);
    else if (tab === 'bonus') bonus(L, pane);
    else testIntro(L, pane);
    window.scrollTo(0, 0);
  }

  // ---------- learn ----------
  function learn(L, pane, i) {
    stopAudio();
    const c = L.lesson[i], last = i === L.lesson.length - 1;
    pane.innerHTML = `
      <section class="card lesson">
        <div class="lhead"><span class="muted small">Lesson ${i + 1} of ${L.lesson.length}</span><span class="toggles"><button class="pill htoggle" hidden></button><button class="pill ptoggle" hidden></button></span></div>
        <h2>${c.title}</h2>
        <p class="text">${c.html}</p>
        ${c.variants ? `<div class="variants${c.stepper ? ' stepper' : ''}"></div><p class="vtext"></p>` : ''}
        <div class="pianoAbove"></div>
        <div class="music"></div>
        <div class="kbwrap"></div>
        <div class="out"></div>
        <div class="actions"></div>
      </section>
      <div class="nav">
        <button class="ghost prev" ${i === 0 ? 'disabled' : ''}>← Back</button>
        <div class="dots">${L.lesson.map((_, j) => `<span class="${j === i ? 'on' : ''}"></span>`).join('')}</div>
        <button class="primary next">${last ? 'Start practising →' : 'Next →'}</button>
      </div>`;
    const card = $('.lesson', pane);
    if (c.variants) {
      const vbox = $('.variants', card);
      let vi = 0;
      const drawV = () => {
        stopAudio();
        const v = c.variants[vi];
        vbox.innerHTML = c.stepper
          ? `<button class="ghost vprev" ${vi === 0 ? 'disabled' : ''}>‹</button><span class="vlabel">${v.label}</span><span class="muted small">${vi + 1} / ${c.variants.length}</span><button class="ghost vnext" ${vi === c.variants.length - 1 ? 'disabled' : ''}>›</button>`
          : c.variants.map((x, j) => `<button class="pill${j === vi ? ' on' : ''}" data-j="${j}">${x.label}</button>`).join('');
        $('.vtext', card).innerHTML = v.html || '';
        showPiece(card, v);
        $$('.pill', vbox).forEach(b => b.addEventListener('click', () => { vi = +b.dataset.j; drawV(); }));
        const p = $('.vprev', vbox), n = $('.vnext', vbox);
        if (p) p.addEventListener('click', () => { vi--; drawV(); });
        if (n) n.addEventListener('click', () => { vi++; drawV(); });
      };
      drawV();
    } else showPiece(card, c);
    handsToggle($('.htoggle', card), () => drawLessonPiano(card));
    $('.ptoggle', card).addEventListener('click', () => {
      showPiano = !showPiano;
      try { localStorage.setItem(PIANO_KEY, showPiano ? '1' : '0'); } catch (e) { /* private mode */ }
      drawLessonPiano(card);
    });
    $('.prev', pane).addEventListener('click', () => learn(L, pane, i - 1));
    $('.next', pane).addEventListener('click', () => (last ? levelScreen(L.id, 'practice') : learn(L, pane, i + 1)));
    keyHandler = e => {
      if (e.key === 'ArrowRight') $('.next', pane).click();
      else if (e.key === 'ArrowLeft' && i > 0) $('.prev', pane).click();
    };
    window.scrollTo(0, 0);
  }

  function showPiece(card, v) {
    const music = $('.music', card), kb = $('.kbwrap', card), out = $('.out', card), actions = $('.actions', card);
    out.innerHTML = '';
    actions.innerHTML = '';
    const spec = v.score || (v.explore ? Object.assign({ cols: [], minWidth: 20 }, v.explore) : null);
    music.innerHTML = spec ? MT.renderScore(spec) : '';
    card._spec = spec;
    card._v = v;
    card._range = null;
    drawLessonPiano(card);
    kb.innerHTML = v.keyboard ? MT.renderKeyboard(v.keyboard) : '';
    if (v.keyboard) wireKeyboard(kb, m => {
      MT.Sound.tone(m, null, 0.8);
      out.innerHTML = `<b>${MT.midiName(m)}</b>${m === 60 ? ' · middle C' : ''}`;
    });
    if (v.explore) wireStaff(music, (st, pos) => {
      const p = MT.atPos(pos, st);
      placeMark(music, st, pos, HL, 0, true);
      MT.Sound.tone(MT.midi(p), null, 0.9);
      drawLessonPiano(card, [{ m: MT.midi(p), st, label: p.l }]);
      out.innerHTML = `<b>${p.l}</b>: ${describePos(pos)} of the ${st} staff${MT.midi(p) === 60 ? ' · <b>middle C</b>' : ''}`;
    });
    if (v.play) {
      const b = document.createElement('button');
      b.className = 'primary soft';
      b.textContent = v.play.label || '▶ Listen';
      b.addEventListener('click', () => {
        const notes = scoreNotes(spec);
        playWithHighlight(v.play.cols || spec.cols, {
          bpm: v.play.bpm || 100, clicks: v.play.clicks, beatsPerBar: v.play.beatsPerBar || (spec.time ? spec.time[0] : 4),
          onCol: i => {
            const t = (notes.find(n => n.col === i) || {}).t0;
            const now = t == null ? [] : notes.filter(n => n.t0 <= t && t < n.t1);
            drawLessonPiano(card, now);
          },
          onEnd: () => drawLessonPiano(card),
        }, [$('svg', music)]);
      });
      actions.appendChild(b);
    }
  }

  // ---------- questions ----------
  function playOpts(q, spec) {
    const p = q.play || {};
    return { bpm: p.bpm || 120, clicks: p.clicks, beatsPerBar: p.beatsPerBar || (spec && spec.time ? spec.time[0] : 4) };
  }

  function renderQuestion(pane, q, o) {
    stopAudio();
    pane.innerHTML = `
      <section class="card quiz">
        <div class="qhead small">${o.head}</div>
        <h2 class="prompt">${q.prompt}</h2>
        <div class="music">${q.score ? MT.renderScore(q.score) : ''}</div>
        <div class="kbwrap">${q.type === 'piano' ? MT.renderKeyboard(q.keyboard) : ''}</div>
        ${q.hearFirst ? '<div class="actions"><button class="primary soft hear">▶ Hear it</button></div>' : ''}
        <div class="answers ${q.type}"></div>
        <div class="feedback" hidden></div>
      </section>`;
    const card = $('.quiz', pane), music = $('.music', card), kb = $('.kbwrap', card), ans = $('.answers', card), fb = $('.feedback', card);
    let done = false;
    const soundSpec = () => (q.play && q.play.fromReveal && q.reveal ? q.reveal : q.score);
    const hearIt = () => { const s = soundSpec(); if (s) playWithHighlight(s.cols, playOpts(q, s), [$('svg', music)]); };
    if (q.hearFirst) $('.hear', card).addEventListener('click', hearIt);

    if (q.type === 'letters') ans.innerHTML = MT.LETTERS.map(l => `<button class="ans letter" data-a="${l}">${l}</button>`).join('');
    else if (q.type === 'choice') ans.innerHTML = q.choices.map((c, i) => `<button class="ans" data-a="${esc(c)}"><span class="kbd">${i + 1}</span>${c}</button>`).join('');
    else if (q.type === 'place') { ans.innerHTML = '<p class="muted hint">Tap a line or space on the staff.</p>'; wireStaff(music, (st, pos) => submit({ st, pos })); }
    else if (q.type === 'piano') { ans.innerHTML = '<p class="muted hint">Tap a key on the keyboard.</p>'; wireKeyboard(kb, m => submit(m)); }
    $$('.ans', ans).forEach(b => b.addEventListener('click', () => submit(b.dataset.a)));

    function submit(given) {
      if (done) return;
      done = true;
      const ok = q.check ? q.check(given) : given === q.answer;
      const correctText = q.answerText || q.answer;
      let givenText = given;
      if (q.type === 'letters' || q.type === 'choice') {
        $$('.ans', ans).forEach(b => {
          b.disabled = true;
          if (b.dataset.a === q.answer) b.classList.add('right');
          else if (b.dataset.a === given) b.classList.add('wrong');
        });
      } else if (q.type === 'place') {
        givenText = MT.atPos(given.pos, given.st).l;
        $$('.hit', music).forEach(h => h.remove());
        $('.ghost', music).style.display = 'none';
        placeMark(music, given.st, given.pos, ok ? OK : BAD, 0, true);
        if (!ok) {
          const best = q.place.positions.slice().sort((a, b) => Math.abs(a - given.pos) - Math.abs(b - given.pos))[0];
          placeMark(music, q.place.clef, best, OK, 3.2 * MT.S);
          if (!q.noSound) MT.Sound.tone(MT.midi(MT.atPos(best, q.place.clef)), null, 0.9);
        } else if (!q.noSound) MT.Sound.tone(MT.midi(MT.atPos(given.pos, given.st)), null, 0.9);
      } else if (q.type === 'piano') {
        givenText = MT.midiName(given);
        const marks = { [q.answer]: OK };
        if (!ok) marks[given] = BAD;
        kb.innerHTML = MT.renderKeyboard(Object.assign({}, q.keyboard, { marks }));
        if (!q.noSound) MT.Sound.tone(q.answer, null, 0.9);
      }
      if (q.reveal) music.innerHTML = MT.renderScore(q.reveal);
      const canHear = !q.noSound && (q.score || q.reveal) && (q.type === 'letters' || q.type === 'choice');
      if (canHear) hearIt();
      if (o.onAnswer) o.onAnswer(ok, givenText, correctText);
      fb.hidden = false;
      fb.innerHTML = (ok ? '<div class="verdict ok">✓ Correct!</div>' : `<div class="verdict bad">✗ Not quite. The answer is <b>${correctText}</b>.</div>`) +
        (o.mode === 'practice' ? `<p class="explain">${q.explain}</p>` : '') +
        `<div class="actions">${canHear ? '<button class="ghost again">▶ Hear again</button>' : ''}<button class="primary nextq">${o.nextLabel || 'Next →'}</button></div>`;
      const again = $('.again', fb);
      if (again) again.addEventListener('click', hearIt);
      $('.nextq', fb).addEventListener('click', o.onNext);
      $('.nextq', fb).focus({ preventScroll: true });
    }

    keyHandler = e => {
      if (done) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('.nextq', fb).click(); }
        return;
      }
      if (q.type === 'letters') {
        const l = e.key.toUpperCase();
        if (MT.LETTERS.includes(l)) submit(l);
      } else if (q.type === 'choice') {
        const n = +e.key;
        if (n >= 1 && n <= q.choices.length) submit(q.choices[n - 1]);
      }
    };
  }

  // ---------- practice ----------
  function practice(L, pane) {
    const st = { right: 0, total: 0, streak: 0, recent: [] };
    const next = () => {
      const q = fresh(L.gen, st.recent);
      st.recent = [q.sig, ...st.recent].slice(0, 4);
      const head = `<span>Practice</span><span class="muted">${st.right} of ${st.total} correct · streak ${st.streak}</span>` +
        (st.right >= 8 ? '<button class="link totest">Ready? Take the test →</button>' : '');
      renderQuestion(pane, q, {
        mode: 'practice', head, onNext: next,
        onAnswer: ok => { st.total++; if (ok) { st.right++; st.streak++; } else st.streak = 0; },
      });
      const tt = $('.totest', pane);
      if (tt) tt.addEventListener('click', () => levelScreen(L.id, 'test'));
    };
    next();
  }

  // ---------- test ----------
  function testIntro(L, pane) {
    const best = progress.best[L.id];
    pane.innerHTML = `
      <section class="card center">
        <h2>Level ${L.id} test</h2>
        <p>10 questions${L.testMix ? ', including review from earlier levels' : ''}, no hints. Get <b>8 or more</b> right to pass${L.id < 10 ? ` and unlock Level ${L.id + 1}` : ''}.</p>
        ${best != null ? `<p class="muted">Your best: ${best}/10 <span class="stars">${stars(best)}</span></p>` : ''}
        <button class="primary big start">Start the test</button>
      </section>`;
    $('.start', pane).addEventListener('click', () => runTest(L, pane));
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); runTest(L, pane); } };
  }

  function runTest(L, pane) {
    const gen = L.testMix ? () => (Math.random() < 0.3 ? Levels.pick(LEVELS.slice(0, 9)).gen() : L.gen()) : L.gen;
    const qs = [], sigs = [];
    while (qs.length < 10) { const q = fresh(gen, sigs); sigs.push(q.sig); qs.push(q); }
    const results = [];
    const step = i => {
      if (i >= qs.length) return testResults(L, pane, results);
      const dots = qs.map((_, j) => `<i class="${j < results.length ? (results[j].ok ? 'ok' : 'bad') : j === i ? 'cur' : ''}"></i>`).join('');
      renderQuestion(pane, qs[i], {
        mode: 'test', head: `<span>Test</span><span class="muted">Question ${i + 1} of 10</span><span class="tdots">${dots}</span>`,
        nextLabel: i === qs.length - 1 ? 'See results →' : 'Next →',
        onAnswer: (ok, given, correct) => results.push({ q: qs[i], ok, given, correct }),
        onNext: () => step(i + 1),
      });
      window.scrollTo(0, 0);
    };
    step(0);
  }

  function testResults(L, pane, results) {
    stopAudio(); keyHandler = null;
    const score = results.filter(r => r.ok).length, pass = score >= 8;
    const wasPassed = !!progress.passed[L.id];
    if (progress.best[L.id] == null || score > progress.best[L.id]) progress.best[L.id] = score;
    if (pass) progress.passed[L.id] = true;
    save();
    const missed = results.filter(r => !r.ok);
    const passMsg = L.id < 10 ? (wasPassed ? '' : `Level ${L.id + 1} is unlocked.`) : 'You’ve finished all ten levels. Try the Progression Studio next.';
    pane.innerHTML = `
      <section class="card center result">
        <div class="big-score ${pass ? 'ok' : 'bad'}">${score}<span>/10</span></div>
        ${pass
          ? `<div class="stars big">${stars(score)}</div><h2>Level ${L.id} passed!</h2><p>${passMsg}</p>`
          : '<h2>Not quite: you need 8 to pass</h2><p>Look over the mistakes below, practise a little more, then try again.</p>'}
        <div class="actions">
          ${pass && L.id < 10 ? `<button class="primary nextlvl">Level ${L.id + 1} →</button>` : ''}
          ${pass && L.id === 10 ? '<button class="primary gostudio">Open the Progression Studio →</button>' : ''}
          ${pass ? '<button class="primary soft gobonus">♪ Try the bonus song</button>' : ''}
          <button class="${pass ? 'ghost' : 'primary'} retry">Retake the test</button>
          <button class="ghost prac">Practise more</button>
        </div>
      </section>
      ${missed.length ? `<h3 class="section">Review your mistakes</h3>` + missed.map(r => {
        const spec = r.q.reveal || r.q.score;
        return `<section class="card review">
          <div class="prompt">${r.q.prompt}</div>
          ${spec ? `<div class="music">${MT.renderScore(Object.assign({}, spec, { click: null, scale: 1.2 }))}</div>` : ''}
          <p>You answered <b class="bad">${r.given}</b>. The answer is <b class="ok">${r.correct}</b>.</p>
          <p class="explain">${r.q.explain}</p>
        </section>`;
      }).join('') : ''}`;
    const nl = $('.nextlvl', pane);
    if (nl) nl.addEventListener('click', () => levelScreen(L.id + 1, 'learn'));
    const gs = $('.gostudio', pane);
    if (gs) gs.addEventListener('click', studio);
    const gb = $('.gobonus', pane);
    if (gb) gb.addEventListener('click', () => levelScreen(L.id, 'bonus'));
    $('.retry', pane).addEventListener('click', () => runTest(L, pane));
    $('.prac', pane).addEventListener('click', () => levelScreen(L.id, 'practice'));
    window.scrollTo(0, 0);
  }

  // ---------- Bonus song ----------
  const BONUS = { hands: 'both', hints: false, bpm: {} };
  const bstars = p => (p >= 100 ? '★★★' : p >= 90 ? '★★☆' : p >= 80 ? '★☆☆' : '');
  function bonus(L, pane) {
    const song = Songs.forLevel(L.id), B = Songs.build(song, { perLine: narrow() ? 2 : 4 });
    const grand = song.system === 'grand';
    const handsOf = () => (!grand ? [song.system] : BONUS.hands === 'both' ? ['treble', 'bass'] : [BONUS.hands]);
    const bpm = () => BONUS.bpm[L.id] || song.bpm;
    const stepAt = {}, colAt = {};
    B.steps.forEach(s => (stepAt[s.gid] = s));
    B.allCols.forEach((c, i) => { if (c.m != null) colAt[c.m] = i; });
    B.range = widen(B.range, allHands(() => handsFor(B.allCols, 0).concat(...B.steps.map(s => handsFor(B.allCols, colAt[s.gid])))));
    const bestLine = () => (progress.bonus[L.id] != null
      ? `Your best: <b>${progress.bonus[L.id]}%</b> <span class="stars">${bstars(progress.bonus[L.id])}</span>`
      : `To set a score, play it${grand ? ' with both hands' : ''} and leave the key lights off.`);
    pane.innerHTML = `
      <section class="card bonus">
        <div class="muted small">Bonus song · uses what you learned up to Level ${L.id}</div>
        <h2>♪ ${song.title}</h2>
        <div class="muted small by">${song.by}</div>
        <p class="text">${song.about}</p>
        <ul class="look">${song.look.map(x => `<li>${x}</li>`).join('')}</ul>
        <div class="systems"></div>
        <div class="transport">
          <button class="primary listen">▶ Listen</button>
          <button class="primary soft alongbtn">🎹 Play along</button>
          <label class="chk">Tempo <input type="range" class="tempo" min="50" max="160" step="2"> <span class="tempoV"></span></label>
          <button class="link midibtn">Connect a MIDI keyboard</button>
        </div>
        <div class="opts">
          ${grand ? '<label>Hands <select class="hands"><option value="both">Both hands</option><option value="treble">Right hand only</option><option value="bass">Left hand only</option></select></label>' : ''}
          <label class="chk"><input type="checkbox" class="hints"> Practice mode: light up the keys and show the fingers</label>
          <button class="pill htoggle"></button>
        </div>
        <div class="dock">
          <div class="along" hidden></div>
          <div class="kbwrap"></div>
        </div>
        <p class="muted small rotatetip">Tip: turn your phone sideways for a bigger keyboard. Swipe below the keys to scroll.</p>
        <p class="muted small midimsg">${midiMsg}</p>
        <p class="small bestline">${bestLine()}</p>
      </section>`;
    const card = $('.bonus', pane), kb = $('.kbwrap', card), box = $('.along', card);
    $('.systems', card).innerHTML = B.specs.map(MT.renderScore).join('');
    const colEls = gid => $$(`.systems .col[data-m="${gid}"]`, card);
    const clearCls = cls => $$(`.systems .col.${cls}`, card).forEach(g => g.classList.remove(cls));
    const alive = () => card.isConnected;

    function drawKb(marks, hands) {
      kb.innerHTML = MT.renderKeyboard(Object.assign({}, B.range, kbSize(), { marks, hands: hands || [] }));
      wireKeyboard(kb, m => press(m, true));
    }
    // Idle: show where the hands start, with the fingers for the first notes lit.
    const drawIdle = () => {
      const s0 = B.steps[0];
      drawKb({}, handsFor(B.allCols, colAt[s0.gid], handMarks(s0)));
      revealKeys(kb, handKeys(allHands(() => handsFor(B.allCols, colAt[s0.gid]))));
    };
    const handMarks = s => {
      const marks = {};
      if (s) { s.bass.forEach(m => (marks[m] = HAND_COLOR.bass)); s.treble.forEach(m => (marks[m] = HAND_COLOR.treble)); }
      return marks;
    };

    // ----- listen -----
    let listening = false;
    function stopListen() {
      listening = false;
      stopAudio();
      $('.listen', card).textContent = '▶ Listen';
      clearCls('now');
      if (!A) drawIdle();
    }
    function listen() {
      if (listening) return stopListen();
      if (A) stopAlong();
      clearCls('done'); clearCls('miss');
      listening = true;
      $('.listen', card).textContent = '■ Stop';
      stopAudio();
      player = MT.playCols(B.allCols, {
        bpm: bpm(), tail: 300,
        onCol: i => {
          const c = B.allCols[i];
          clearCls('now');
          colEls(c.m).forEach(g => g.classList.add('now'));
          if (stepAt[c.m]) { const s = stepAt[c.m]; drawKb(handMarks(s), handsFor(B.allCols, i, handMarks(s))); revealKeys(kb, [...s.treble, ...s.bass]); }
        },
        onEnd: () => { player = null; if (alive()) stopListen(); },
      });
    }

    // ----- play along (waits for you) -----
    let A = null;
    const req = s => [...new Set(handsOf().flatMap(st => s[st]))];
    const autoHands = () => ['treble', 'bass'].filter(st => !handsOf().includes(st));
    const playAuto = s => autoHands().forEach(st => s[st].forEach(m => MT.Sound.tone(m, null, Math.max(0.25, s.beats[st] * 60 / bpm() * 0.95), 0.45)));
    function startAlong() {
      if (listening) stopListen();
      clearCls('done'); clearCls('miss'); clearCls('now');
      A = { idx: 0, clean: 0, counted: 0, wrong: 0, hints: BONUS.hints, scored: !BONUS.hints && (!grand || BONUS.hands === 'both'), svg: null };
      $('.alongbtn', card).textContent = '✕ Stop play-along';
      box.hidden = false;
      card.classList.add('playing');
      card.style.setProperty('--dockh', $('.dock', card).offsetHeight + 'px');
      onMidiNote = m => press(m, false);
      enterStep();
    }
    function stopAlong() {
      if (A) clearTimeout(A.timer);
      A = null;
      onMidiNote = null;
      $('.alongbtn', card).textContent = '🎹 Play along';
      box.hidden = true;
      card.classList.remove('playing');
      clearCls('now');
      drawIdle();
    }
    function enterStep() {
      const s = B.steps[A.idx];
      Object.assign(A, { hit: new Set(), miss: false, autoPlayed: false, wait: false });
      clearCls('now');
      const els = colEls(s.gid);
      els.forEach(g => g.classList.add('now'));
      const svg = els[0] && els[0].closest('svg');
      if (svg && svg !== A.svg) { A.svg = svg; showLine(svg); }
      status();
      drawAlongKb();
      if (!req(s).length) { // only the other hand plays here: play it for you and move on
        A.wait = true;
        playAuto(s);
        A.timer = setTimeout(next, Math.min(1500, s.adv * 60000 / bpm()));
      }
    }
    // Scroll so the current line of music sits in the space above the pinned keyboard.
    function showLine(svg) {
      const dockH = $('.dock', card).offsetHeight;
      card.style.setProperty('--dockh', dockH + 'px'); // short screens size the music lines to fit above the dock
      const r = svg.getBoundingClientRect(), room = innerHeight - dockH;
      if (r.top >= 8 && r.bottom <= room - 8) return;
      window.scrollBy({ top: r.top - Math.max(8, (room - r.height) / 2), behavior: 'smooth' });
    }
    function next() {
      if (!A || !alive()) return;
      A.idx++;
      if (A.idx >= B.steps.length) finish();
      else enterStep();
    }
    function drawAlongKb(wrongKey) {
      const s = B.steps[A.idx], marks = {};
      if (A.hints) handsOf().forEach(st => s[st].forEach(m => (marks[m] = HAND_COLOR[st])));
      A.hit.forEach(m => (marks[m] = OK));
      if (wrongKey != null) marks[wrongKey] = BAD;
      // Practice mode also shows the hands and which fingers to use (hidden in a scored run: it would give the answer away).
      drawKb(marks, A.hints ? handsFor(B.allCols, colAt[s.gid], marks) : []);
      // Phones: scroll to the hand position that still has notes to play (the area, not the exact key).
      const left = req(s).filter(m => !A.hit.has(m));
      const sides = handsOf().filter(st => s[st].some(m => left.includes(m))).map(st => SIDE[st]);
      revealKeys(kb, handKeys(allHands(() => handsFor(B.allCols, colAt[s.gid])).filter(h => sides.includes(h.side))));
    }
    function status() {
      const s = B.steps[A.idx], n = req(s).length;
      const who = !grand ? (song.system === 'treble' ? 'right hand' : 'left hand')
        : BONUS.hands === 'both' ? 'both hands' : BONUS.hands === 'treble' ? 'right hand (the left hand plays itself)' : 'left hand (the right hand plays itself)';
      box.innerHTML = `
        <div class="along-row">
          <div>
            <div class="muted small">Step ${A.idx + 1} of ${B.steps.length} · ${who} · ${A.wrong} wrong key${A.wrong === 1 ? '' : 's'}</div>
            <div class="target">${n > 1 ? `Play the <b>${n} notes</b> in the blue column, in any order` : n ? 'Play the note in the blue column' : '<span class="muted">Listen…</span>'}${A.hints ? fingerText(s) : ''}</div>
            <div class="muted small alonghelp">The song waits for you. Read the note, find the key, play it.${A.scored ? '' : ' <b>Practice run</b>: no score is saved.'}</div>
          </div>
          <div class="along-actions"><button class="ghost hearc" title="Hear this step">▶<span class="wide"> Hear this step</span></button></div>
        </div>`;
      $('.hearc', box).addEventListener('click', () => {
        const st = B.steps[A.idx];
        ['treble', 'bass'].forEach(h => st[h].forEach(m => MT.Sound.tone(m, null, 0.9, 0.5)));
      });
    }
    function fingerText(s) {
      const parts = handsFor(B.allCols, colAt[s.gid], handMarks(s))
        .filter(h => handsOf().includes(h.side === 'right' ? 'treble' : 'bass'))
        .map(h => { const fs = Object.keys(h.active); return fs.length ? `${h.side === 'right' ? 'right' : 'left'} hand finger${fs.length > 1 ? 's' : ''} ${fs.join('-')}` : ''; })
        .filter(Boolean);
      return parts.length ? ` <span class="muted small">(${parts.join(', ')})</span>` : '';
    }
    function press(m, screen) {
      if (screen) MT.Sound.tone(m, null, 0.8);
      if (!A) return;
      if (A.wait || A.done) return;
      const s = B.steps[A.idx], r = req(s);
      if (r.includes(m)) {
        if (A.hit.has(m)) return;
        A.hit.add(m);
        if (!A.autoPlayed) { A.autoPlayed = true; playAuto(s); }
        if (r.every(x => A.hit.has(x))) {
          A.counted++;
          if (!A.miss) A.clean++;
          colEls(s.gid).forEach(g => { g.classList.remove('now'); g.classList.add(A.miss ? 'miss' : 'done'); });
          A.wait = true;
          drawAlongKb();
          A.timer = setTimeout(next, 220);
        } else drawAlongKb();
      } else {
        A.miss = true;
        A.wrong++;
        status();
        drawAlongKb(m);
      }
    }
    function finish() {
      clearCls('now');
      const pct = A.counted ? Math.round(100 * A.clean / A.counted) : 0;
      let note = '';
      if (A.scored) {
        const prev = progress.bonus[L.id];
        if (prev == null || pct > prev) { progress.bonus[L.id] = pct; save(); note = prev == null ? 'Score saved.' : `New best (was ${prev}%).`; }
      } else note = `Practice run, so no score is saved. For a score, ${grand ? 'pick <b>Both hands</b> and ' : ''}turn the key lights off.`;
      const missed = A.counted - A.clean;
      box.innerHTML = `
        <div class="along-row">
          <div>
            <div class="target">${pct >= 80 ? '🎉' : '👏'} <b>${pct}%</b> <span class="stars">${bstars(pct)}</span>. You played ${A.clean} of ${A.counted} steps with no wrong keys.</div>
            <div class="muted small">${missed ? 'Steps where a wrong key slipped in are <b class="bad">red</b> in the music. ' : 'A clean run! '}${note}</div>
          </div>
          <div class="along-actions"><button class="primary again">Play again</button><button class="ghost end">Done</button></div>
        </div>`;
      A.done = true;
      onMidiNote = null;
      card.classList.remove('playing');
      $('.again', box).addEventListener('click', startAlong);
      $('.end', box).addEventListener('click', stopAlong);
      $('.bestline', card).innerHTML = bestLine();
      $('.alongbtn', card).textContent = '🎹 Play along';
      A = null;
      box.hidden = false;
      drawIdle();
    }

    // ----- controls -----
    const tempo = $('.tempo', card);
    tempo.value = bpm();
    $('.tempoV', card).textContent = bpm() + ' bpm';
    tempo.addEventListener('input', () => { BONUS.bpm[L.id] = +tempo.value; $('.tempoV', card).textContent = tempo.value + ' bpm'; });
    tempo.addEventListener('change', () => { if (listening) { stopListen(); listen(); } });
    $('.listen', card).addEventListener('click', listen);
    $('.alongbtn', card).addEventListener('click', () => (A ? stopAlong() : startAlong()));
    $('.midibtn', card).addEventListener('click', connectMidi);
    const hands = $('.hands', card);
    if (hands) { hands.value = BONUS.hands; hands.addEventListener('change', () => { BONUS.hands = hands.value; if (A) startAlong(); }); }
    const hints = $('.hints', card);
    hints.checked = BONUS.hints;
    hints.addEventListener('change', () => { BONUS.hints = hints.checked; if (A) startAlong(); });
    handsToggle($('.htoggle', card), () => { if (A) { status(); drawAlongKb(); } else if (!listening) drawIdle(); });
    drawIdle();
  }

  // ---------- Progression Studio ----------
  const STUDIO_KEYS = [0, 1, 2, 3, 4, -1, -2, -3, -4];
  const S = { prog: 'pop', key: 0, pattern: 'root', labels: 'names', bpm: 96, loop: true, showNotes: true };
  const midiHeld = new Set(), screenHeld = new Set();
  let onHeldChange = null, onMidiNote = null, midiAccess = null, midiMsg = '';
  function teardownStudio() { onHeldChange = null; onMidiNote = null; screenHeld.clear(); }

  function onMidiMessage(e) {
    const [s, n, v] = e.data, cmd = s & 0xf0;
    if (cmd === 0x90 && v > 0) midiHeld.add(n);
    else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) midiHeld.delete(n);
    else return;
    if (onHeldChange) onHeldChange(cmd === 0x90 && v > 0);
    if (onMidiNote && cmd === 0x90 && v > 0) onMidiNote(n);
  }
  function connectMidi() {
    const msg = t => { midiMsg = t; const el = $('.midimsg'); if (el) el.textContent = t; };
    if (!navigator.requestMIDIAccess) return msg('This browser can’t connect to MIDI keyboards. Try Chrome or Edge.');
    navigator.requestMIDIAccess().then(acc => {
      midiAccess = acc;
      const attach = () => {
        const ins = [...acc.inputs.values()];
        ins.forEach(inp => (inp.onmidimessage = onMidiMessage));
        msg(ins.length ? `MIDI connected: ${ins.map(i => i.name).join(', ')}` : 'No MIDI keyboard found yet. Plug one in and it will connect automatically.');
      };
      attach();
      acc.onstatechange = attach;
    }, () => msg('MIDI access was blocked by the browser.'));
  }

  function studio() {
    stopAudio(); keyHandler = null; teardownStudio();
    app.innerHTML = `
      <div class="topbar"><button class="ghost back">← Home</button><div class="ltitle">Progression Studio</div></div>
      <main>
        <section class="card studio">
          <div class="controls">
            <label>Progression<select id="sProg">${PROGRESSIONS.map(p => `<option value="${p.id}">${p.nick.replace(/^The /, '')}: ${p.name}</option>`).join('')}</select></label>
            <label>Key<select id="sKey">${STUDIO_KEYS.map(k => `<option value="${k}">${MT.keyName(k)} major</option>`).join('')}</select></label>
            <label>Left hand<select id="sPat">${Object.keys(PATTERNS).map(p => `<option value="${p}">${PATTERNS[p].label}</option>`).join('')}</select></label>
            <label>Labels<select id="sLab"><option value="names">Chord names</option><option value="numerals">Roman numerals</option><option value="both">Both</option><option value="none">None</option></select></label>
            <label>Tempo <span id="sBpmV"></span><input id="sBpm" type="range" min="50" max="160" step="2"></label>
          </div>
          <p class="desc"></p>
          <div class="systems"></div>
          <div class="transport">
            <button class="primary play">▶ Play</button>
            <label class="chk"><input type="checkbox" id="sLoop"> Loop</label>
            <button class="ghost alongbtn">🎹 Play along</button>
            <button class="pill htoggle"></button>
            <button class="link midibtn">Connect a MIDI keyboard</button>
          </div>
          <div class="along" hidden></div>
          <div class="kbwrap"></div>
          <p class="muted small rotatetip">Tip: turn your phone sideways for a bigger keyboard. Swipe below the keys to scroll.</p>
          <p class="muted small midimsg">${midiMsg}</p>
        </section>
      </main>`;
    $('.back').addEventListener('click', () => { stopAll(); home(); });
    $('#sProg').value = S.prog; $('#sKey').value = S.key; $('#sPat').value = S.pattern; $('#sLab').value = S.labels;
    $('#sBpm').value = S.bpm; $('#sBpmV').textContent = S.bpm + ' bpm'; $('#sLoop').checked = S.loop;
    $('#sProg').addEventListener('change', e => { S.prog = e.target.value; redraw(); });
    $('#sKey').addEventListener('change', e => { S.key = +e.target.value; redraw(); });
    $('#sPat').addEventListener('change', e => { S.pattern = e.target.value; redraw(); });
    $('#sLab').addEventListener('change', e => { S.labels = e.target.value; redraw(); });
    $('#sBpm').addEventListener('input', e => { S.bpm = +e.target.value; $('#sBpmV').textContent = S.bpm + ' bpm'; });
    $('#sLoop').addEventListener('change', e => (S.loop = e.target.checked));
    $('.play').addEventListener('click', () => (playing ? stopAll() : startPlay()));
    $('.alongbtn').addEventListener('click', () => (along ? stopAlong() : startAlong()));
    $('.midibtn').addEventListener('click', connectMidi);
    handsToggle($('.htoggle'), () => { if (along) drawAlongKb(false); });

    let allCols = [], playing = false, along = null;
    const prog = () => PROGRESSIONS.find(p => p.id === S.prog);

    function redraw() {
      stopAll();
      if (along) stopAlong();
      const p = prog();
      const nums = progLabels(S.key, p), names = progNames(S.key, p);
      allCols = progressionCols(S.key, p.chords, S.pattern, {
        above: S.labels === 'numerals' || S.labels === 'both' ? nums : null,
        below: S.labels === 'names' || S.labels === 'both' ? names : null,
      });
      const per = narrow() && S.pattern !== 'block' && S.pattern !== 'root' ? 2 : 4, systems = [];
      for (let s = 0; s * per < p.chords.length; s++) systems.push(allCols.filter(c => Math.floor(c.m / per) === s));
      $('.systems').innerHTML = systems.map((cols, s) => MT.renderScore({ system: 'grand', key: S.key, time: s === 0 ? [4, 4] : null, cols, scale: 1.3 })).join('');
      const minor = p.minor ? ` Shown in ${MT.name(MT.triad(S.key, 5).notes[0])} minor, the relative minor of ${MT.keyName(S.key)} major.` : '';
      $('.desc').innerHTML = `<b>${p.nick}</b>: ${p.name}. Heard in ${p.songs}.${minor}`;
      drawKb({});
    }

    function measureMidis(m) {
      const out = { rh: [], lh: [] };
      allCols.forEach(c => {
        if (c.m !== m || c.bar) return;
        if (c.treble) c.treble.notes.forEach(n => out.rh.push(MT.midi(n.p)));
        if (c.bass) c.bass.notes.forEach(n => out.lh.push(MT.midi(n.p)));
      });
      return out;
    }
    function drawKb(marks, hands) {
      const box = $('.kbwrap');
      box.innerHTML = MT.renderKeyboard(Object.assign({ lo: 36, hi: 84, marks, hands: hands || [] }, kbSize()));
      wireKeyboard(box, onScreenKey);
    }
    const measureCols = m => allCols.filter(c => c.m === m && !c.bar);
    function mark(m, cls) {
      $$(`.systems .col.${cls}`).forEach(g => g.classList.remove(cls));
      if (m != null) $$(`.systems .col[data-m="${m}"]`).forEach(g => g.classList.add(cls));
    }

    function startPlay() {
      stopAudio();
      if (along) stopAlong();
      playing = true;
      $('.play').textContent = '■ Stop';
      let lastM = -1;
      player = MT.playCols(allCols, {
        bpm: S.bpm, tail: 0,
        onCol: i => {
          const m = allCols[i].m;
          if (m === lastM) return;
          lastM = m;
          mark(m, 'now');
          const mm = measureMidis(m), marks = {};
          mm.lh.forEach(x => (marks[x] = '#91a7ff'));
          mm.rh.forEach(x => (marks[x] = HL));
          drawKb(marks, handsFor(measureCols(m)));
          revealKeys($('.kbwrap'), [...mm.lh, ...mm.rh]);
        },
        onEnd: () => { player = null; if (playing && S.loop) startPlay(); else stopAll(); },
      });
    }
    function stopAll() {
      playing = false;
      stopAudio();
      const b = $('.play');
      if (b) b.textContent = '▶ Play';
      mark(null, 'now');
      if (!along && $('.kbwrap')) drawKb({});
    }

    // Play-along: wait until the held notes match the current chord (any octave / inversion).
    const held = () => new Set([...screenHeld, ...midiHeld]);
    const target = () => progChord(S.key, prog().chords[along.idx]);
    function startAlong() {
      stopAll();
      along = { idx: 0, t0: performance.now(), fresh: true };
      screenHeld.clear();
      $('.along').hidden = false;
      $('.alongbtn').textContent = '✕ End play-along';
      onHeldChange = isOn => { if (isOn && along) along.fresh = true; check(); };
      showTarget();
    }
    function stopAlong() {
      along = null;
      screenHeld.clear();
      onHeldChange = () => drawKb(Object.fromEntries([...midiHeld].map(m => [m, HL])));
      $('.along').hidden = true;
      $('.alongbtn').textContent = '🎹 Play along';
      mark(null, 'now'); mark(null, 'done');
      drawKb({});
    }
    function showTarget() {
      const p = prog(), tri = target();
      mark(along.idx, 'now');
      const lab = progLabels(S.key, p)[along.idx];
      $('.along').innerHTML = `
        <div class="along-row">
          <div>
            <div class="muted small">Chord ${along.idx + 1} of ${p.chords.length}</div>
            <div class="target">Play <b>${tri.name}</b> <span class="muted">(${lab})</span>${S.showNotes ? `: ${tri.notes.map(MT.name).join(' – ')}` : ''}</div>
            <div class="muted small">Any octave or inversion. On screen, tap keys to hold them down and tap again to let go.</div>
          </div>
          <div class="along-actions">
            <label class="chk"><input type="checkbox" class="showN" ${S.showNotes ? 'checked' : ''}> Show notes</label>
            <button class="ghost hearc">▶ Hear it</button>
            <button class="ghost skip">Skip →</button>
          </div>
        </div>`;
      $('.showN').addEventListener('change', e => { S.showNotes = e.target.checked; showTarget(); });
      $('.skip').addEventListener('click', advance);
      $('.hearc').addEventListener('click', () => { const mm = measureMidis(along.idx); [...mm.lh.slice(0, 1), ...mm.rh].forEach(m => MT.Sound.tone(m, null, 1.2)); });
      drawAlongKb(false);
    }
    function drawAlongKb(ok) {
      const marks = {};
      if (S.showNotes) measureMidis(along.idx).rh.forEach(m => (marks[m] = '#d0dbff'));
      held().forEach(m => (marks[m] = ok ? OK : HL));
      drawKb(marks, S.showNotes ? handsFor(measureCols(along.idx).map(c => ({ treble: c.treble }))) : []);
      revealKeys($('.kbwrap'), measureMidis(along.idx).rh);
    }
    function check() {
      if (!along) return;
      const want = new Set(target().notes.map(p => MT.mod12(MT.midi(p))));
      const have = new Set([...held()].map(MT.mod12));
      const ok = along.fresh && have.size > 0 && [...want].every(x => have.has(x)) && [...have].every(x => want.has(x));
      drawAlongKb(ok);
      if (!ok) return;
      const idx = along.idx;
      mark(idx, 'done');
      along.fresh = false;
      setTimeout(() => { if (along && along.idx === idx) advance(); }, 450);
    }
    function advance() {
      screenHeld.clear();
      along.idx++;
      if (along.idx >= prog().chords.length) return finish();
      showTarget();
    }
    function finish() {
      const secs = Math.round((performance.now() - along.t0) / 1000);
      mark(null, 'now');
      $('.along').innerHTML = `<div class="along-row"><div class="target">🎉 You played all ${prog().chords.length} chords in ${secs} seconds.</div><div class="along-actions"><button class="primary again">Again</button><button class="ghost end">Done</button></div></div>`;
      $('.again', $('.along')).addEventListener('click', () => { mark(null, 'done'); startAlong(); });
      $('.end', $('.along')).addEventListener('click', stopAlong);
      along = null;
      drawKb({});
    }
    function onScreenKey(m) {
      MT.Sound.tone(m, null, 0.8);
      if (!along) return;
      if (screenHeld.has(m)) screenHeld.delete(m);
      else { screenHeld.add(m); along.fresh = true; }
      check();
    }

    onHeldChange = () => drawKb(Object.fromEntries([...midiHeld].map(m => [m, HL])));
    redraw();
    window.scrollTo(0, 0);
  }

  home();
})();
