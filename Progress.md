# Piano Tutor — Progress

An interactive app that teaches you to read sheet music. Open `index.html` in a browser. It needs no install, no server and no internet, and works straight from `file://`.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page shell and all CSS |
| `music.js` | Music theory, the hand-drawn SVG notation renderer, the on-screen keyboard, and the Web Audio synth and scheduler |
| `levels.js` | The 10 levels (lessons, question generators, test mix) and the chord progression and left-hand pattern library |
| `songs.js` | The 10 bonus songs (one per level) and the builder that turns them into score lines and play-along steps |
| `app.js` | Screens: home, level (Learn / Practice / Test / Bonus song) and Progression Studio |

## 2026-10-31 — First build

### 10 levels, each with Learn, Practice and Test
1. Treble clef / right hand
2. Bass clef / left hand
3. Middle C and ledger lines
4. Grand staff: both hands
5. Note lengths and rests
6. Dots, time signatures, counting
7. Sharps, flats, naturals
8. Key signatures and scales
9. Triads, major/minor, Roman numerals
10. Chord progressions and left-hand patterns

- **Learn:** lesson cards with notation, ▶ Listen playback that highlights each note as it plays, "Try it" staffs you can tap, variants and steppers.
- **Practice:** endless questions with instant feedback and an explanation. There are four question types:
  - name the note letter
  - multiple choice
  - tap the right spot on the staff
  - tap the right piano key
- **Test:** 10 questions, and 8 or more passes the level. Passing earns stars. Every level is open from the start (progress lives only in this browser's localStorage, so locking would strand people on a new device or after clearing data). Level 10's test mixes in material from every level.
- Progress is saved in the browser (`localStorage` key `pianoTutor.v1`). The home screen has a reset button.
- Keyboard shortcuts: letters A–G, 1–9 for choices, Enter to go on, arrow keys for lesson cards.

### Notation renderer (hand-drawn SVG, no libraries)
- Treble, bass and grand staff with a brace.
- Clefs, key and time signatures, and ledger lines.
- Notes from whole to sixteenth, dots, flags, beams and rests.
- Accidentals follow the key signature and carry through the bar, like real notation.

### Progression Studio
- Chord progressions:
  - I–V–vi–IV pop
  - ii–V–I jazz
  - 50s
  - minor pop
  - royal road
  - Andalusian
  - Pachelbel's Canon
  - 12-bar blues
  - cadence
- 9 keys and 5 left-hand patterns: block, root, arpeggio, Alberti and oom-pah.
- Options for tempo, loop and chord labels (letters or Roman numerals).
- Play-along mode: hold the chord on the on-screen keys or a MIDI keyboard (Chrome/Edge) to move on. Any inversion or octave counts.

### Lesson piano toggle
- A **🎹 Piano** button at the top right of lesson cards shows a keyboard above the notes, with the matching keys lit.
- Blue is the right hand (treble) and orange is the left hand (bass). Labels follow the key signature and accidentals (e.g. F♯ in G major).
- During ▶ Listen only the keys sounding at that moment stay lit. On "Try it" cards the tapped key lights.
- The range is whole octaves around the card's notes, at least two, and stays fixed for the whole card.
- The on/off choice is remembered (`pianoTutor.showPiano`). The button is hidden on cards that already show their own keyboard.

### Verification
- Node harness with no browser: about 99k checks on theory, accidentals, beat counts, question generators and answer checking, all passing. Deliberately broken copies (flat keys, dotted-half beats) were caught, which shows the checks work.
- Lesson piano check: all 72 cards and variants that get the piano have every note within the keyboard range and valid timing.
- **Not yet viewed in a browser.** Vince judges the visuals.

## 2026-11-01 — Summary of the day
Requests, in order, and what was built for each:
1. **A "bonus test" song per level** that mixes what was tested and lets you play along. Added a ♪ Bonus song tab with 10 songs, Listen, and a play-along that waits for you and gives a score.
2. **A made-up song should have a pattern to its notes.** Nine songs are real public-domain tunes. The Level 10 original, "Sunday Drive", is built from repeated rhythms and melody shapes (details below).
3. **Hand silhouettes showing finger positions.** Drawn over the keyboards in lessons, bonus songs and the Studio, with automatic fingering.
4. **Toggle the hands like the piano.** Added a ✋ Hands button that is remembered.
5. **Make sure it all works on mobile.** Phone layout, scrolling keyboards, pinned play-along, iOS audio. Tested on emulated phones.
6. **Prepare for GitHub Pages.** Set up a local git repo and commit. Vince pushed it (see Hosting).
7. **Open every level.** Progress only lives in one browser's localStorage, so locking levels behind earlier tests would strand people on a new device. Every level can now be selected from the start (details below).
8. **Home intro wording.** "Start anywhere: every level is open." became "Select a level."

The app was viewed in a (headless) browser for the first time today. Screenshots were checked on desktop, iPhone and Android sizes.

## 2026-11-01 — Bonus songs and hands

### Bonus song (4th tab on every level)
- Each level has a real song that uses only what has been taught up to that level:
  1. Mary Had a Little Lamb (treble only)
  2. Twinkle Twinkle (bass only)
  3. Hot Cross Buns (middle C written on both staves)
  4. Jingle Bells chorus (both hands)
  5. When the Saints (rests)
  6. Amazing Grace (3/4, pickup, dots)
  7. Für Elise opening (D♯/D♮ in one measure, G♯; written in 3/4 because 3/8 isn't taught)
  8. Minuet in G (key of G, F♯)
  9. Ode to Joy (left-hand triads, chord names and numerals)
  10. "Sunday Drive", an original piece in F that uses I–V–vi–IV and I–vi–IV–V, oom-pah and Alberti, and C♯/C♮. It is built from patterns: line 1 repeats one rhythm and shape through each chord; line 2 is "4 eighths + half" in every measure, and measure 7 is measure 5 moved up.
- Each song has a short "what to look for" list. **▶ Listen** plays it with a moving highlight and lit keys, with a tempo slider.
- **Play along** waits for you. Play every note in the blue column, in any order, on screen or on MIDI, and it moves on. A step with a wrong key turns red in the music, a clean one green.
- Score = clean steps ÷ steps. It is saved in `progress.bonus[level]` (shows as ♪ % on the home card) only for a run with both hands and practice mode off.
- Options: Right hand / Left hand only (the other hand plays itself), and Practice mode (lights the keys, shows the fingers and names the fingers to use).
- The level test results screen has a "♪ Try the bonus song" button after a pass.
- Engine: a column can carry `adv` (beats to the next column) so two hands can have different rhythms. Lines of music are justified to the same width. A single last measure joins the line above.

### Hand silhouettes with fingering
- `MT.planHand` works out the fingering. The hand stays in a five-finger position until a note falls outside it, then moves. Chords get 1-3-5. A chord wider than five notes spreads the fingers across it.
- `renderKeyboard({ hands })` draws a top-down hand silhouette below the keys, with numbered fingertips (1 = thumb) on the keys. Lit fingers are blue for the right hand and orange for the left.
- Shown in:
  - the lesson 🎹 Piano view (follows the notes during ▶ Listen)
  - the bonus song: starting position, Listen and practice mode (hidden in a scored run)
  - the Progression Studio: during play, and in play-along with "Show notes"
- **✋ Hands** toggle next to 🎹 Piano, and in the bonus song and the Studio. It is remembered in `pianoTutor.showHands` and is on by default.

### Verification
- Node: every song's measures add up to the time signature (pickups allowed). Accidentals print where expected and key-signature notes print none. Levels 1 and 2 stay on their staff.
- Headless Chrome: each bonus song played start to finish (both hands, and right hand only) with one deliberate wrong key. Result each time: exactly one red step and the right %. One-hand runs aren't saved. Listen, the home badges, the hands toggle (remembered after reload) and the lesson and Studio hands were all checked. No console errors.

## 2026-11-01 — Mobile

- **Keyboards:** on screens 560px wide or less, keyboards keep about 28px white keys and scroll sideways. `revealKeys` slides them to the notes in play. In a scored play-along it slides to the hand's five-finger area rather than the exact key, so the answer stays hidden. When two hands are too far apart to fit, it shows the lower one first.
- **Bonus play-along:** the step box and keyboard are pinned to the bottom of the screen (sticky "dock"). The page scrolls so the current line of music sits above it. On short (landscape) screens each line of music is sized to fit that space (`--dockh`).
- **Phone layout:** 2 measures per line in bonus songs (and in the Studio for busy left-hand patterns), cropped hands (`handH`), and shorter keys on short screens (`shortKeys`). Labels are shorter: "♪ Bonus", "✋ Hands", "🎹 Piano". A portrait tip suggests turning the phone sideways.
- **iOS audio:** audio unlocks on the first tap, click or key press, and `navigator.audioSession.type = 'playback'` lets sound play with the silent switch on (Safari 16.4+).
- **Touch:** no double-tap zoom, and no text-selection or long-press menu on the keys.
- **Verified** in headless Chrome emulating iPhone 13 and Pixel 5 (portrait), plus both in landscape. All 10 bonus songs were played start to finish with real touch taps at screen coordinates. Every needed key was scrolled into view automatically (0 misses), with no page overflow and no errors. The desktop tests were rerun and still pass.
- Not tested on a physical phone: real Safari audio and how the touch feels.

## 2026-11-01 — All levels open
- Removed `isUnlocked` from `app.js`. Level cards are never disabled, and the 🔒 "Pass level N" status and the `.level.locked` CSS are gone. Cards for levels not yet passed show "Start →" or "Best N/10".
- Scores, stars, bonus-song badges and "N of 10 levels passed" are still saved. They are now just a record.
- Wording: the home intro says "Select a level. Each one ends with a test (8 out of 10 passes) and a bonus song." The test intro no longer says "and unlock Level N". The pass screen says "Ready for Level N." and keeps its "Level N →" button.
- Verified in a fresh browser (no saved progress): 0 disabled cards, Level 10 and its bonus song open directly, no page errors.

## Hosting
- **GitHub repo:** https://github.com/vmon5589/pianoTutor. The app is pushed to `main`.
- **Status (2026-11-01):** Vince added the remote and pushed. `origin/main` is up to date as of commit `d758f8c` ("Select a level"), not counting this Progress.md update.
- **Rule for Claude:** never push unless Vince says to, or Claude asks and Vince approves. Commit locally, then ask.
- **First push:**
  1. Log in to GitHub on this Mac. Either run `brew install gh && gh auth login`, or use a personal access token (classic, `repo` scope) as the password when git asks.
  2. Run `git remote add origin https://github.com/vmon5589/pianoTutor.git && git push -u origin main`.
- **Turn on Pages:** repo **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**. The site goes live at https://vmon5589.github.io/pianoTutor/ after a minute or two. On a free account the repo must be public.
- **Later updates:** `git add -A && git commit -m "…"; git push`. Use `;` before `git push`, not `&&`. With `&&`, a "nothing to commit" (when the work is already committed) counts as a failure and skips the push.
- **Notes:**
  - All paths are relative, so the app works from the `/pianoTutor/` subpath.
  - Progress is saved per device, in each browser's localStorage.
  - Web MIDI needs HTTPS, so MIDI keyboards should work on github.io in Chrome and Edge.
  - On iPhone, Share → Add to Home Screen opens it like an app.

## Open items / tunables to judge on screen
- Look of the hand-drawn clefs, flags, rests and note spacing.
- Lesson piano: orange left-hand color (`#f08c00`), button position, key label size.
- Known limitation: during playback a column of only rests lights no keys.
- Hand silhouette shape and size, and whether auto-fingering choices feel natural (it's a simple five-finger-position rule, not a pianist's fingering).
- Bonus song arrangements (left-hand parts are simplified) and tempos.
- Try it on a real phone: Safari audio (including with the silent switch on), how the tapping feels, and the auto-scrolling keyboard.
- Phone play-along with both hands far apart: the keyboard shows the lower hand first and slides to the other after you play it. Check that this feels natural.
- Confirm Pages is turned on and https://vmon5589.github.io/pianoTutor/ loads (see Hosting).
