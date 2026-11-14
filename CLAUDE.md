# Quinta Flute Practice

An iPad app that teaches a child to play the Choroi Quinta pentatonic flute and to read music. It has a fingering chart, a song library with finger diagrams under every note, a converter that turns sheet music into finger patterns, short music-theory lessons, three practice games, and microphone listening that checks the notes he plays.

The user is David, a parent building this for his son. The son is the end user, so everything on screen has to work for a child: big touch targets, plain words, no reading walls.

## Files

- `index.html`: the whole app (HTML, CSS and JS in one file, about 2,070 lines). There is no build step and no dependencies apart from two Google Fonts.
- `icon.png`: the 180×180 Home Screen icon.
- `CLAUDE.md`: this file.

Keep it a single self-contained file unless there's a strong reason to split it. It runs in two places and has to work in both (see below).

## The instrument (source of truth)

These facts come from Choroi's printed fingering chart, which David photographed, and from his corrections. Don't change them without checking with him.

- The flute has **5 holes on the front and 1 thumb hole on the back**. Front holes are numbered 1–5 from the mouthpiece down.
- It plays seven notes: D E G A B D' E'. They're written D4–E5 on the treble staff and **sound one octave higher** (d''–e''').
- Choroi makes it at A = 440 Hz and at A = 432 Hz. The app has a tuning setting for this.
- Fingerings are stored as `holes: [thumb, h1, h2, h3, h4, h5]`, where 1 = covered, 0 = open and 0.5 = half covered:

| Note | MIDI (written) | holes |
|---|---|---|
| D (low) | 62 | `[1,1,1,1,1,1]` |
| E (low) | 64 | `[1,1,1,1,1,0]` |
| G | 67 | `[1,1,1,1,0,0]` |
| A | 69 | `[1,1,1,0,0,0]` |
| B | 71 | `[1,1,0,0,0,0]` |
| D (high) | 74 | `[1,0,0,0,0,0]` |
| E (high) | 76 | `[0,0,0,0,0,0]` |
| F♯ (half hole) | 66 | `[1,1,1,1,0.5,0]` |
| C (half hole) | 72 | `[1,0.5,0,0,0,0]` |

- **Unverified:** the F♯ and C half-hole fingerings are educated guesses. The UI says "listen and adjust" for them.
- **Unknown:** which finger covers which front hole. The app names the thumb hole and numbers the others. Don't add finger names (index, middle, left or right hand) until David confirms how his son holds the flute.
- The "mood of the fifth" idea (A as the home note, G-D-A-E-B as a chain of fifths) is used in the lessons.

## Two ways the app runs

1. **As a Claude artifact.** This is a private page in David's claude.ai account. The page declares these capabilities:
   - `sample` with `images: true`: "Snap a photo" sends sheet music to Claude, which returns ABC notation.
   - `db` and `user`: saved songs and lesson progress are kept per user in the artifact's database.
   - **The microphone is blocked** in the artifact frame, which is a platform rule. The mic button explains this and points to the standalone copy.
2. **Standalone**, served from an https address (planned: GitHub Pages) and added to the iPad Home Screen.
   - `window.claude` doesn't exist there, so storage falls back to `localStorage` and photo reading shows a "needs Claude" message.
   - The microphone works there. It needs https.
   - Set the `STANDALONE_URL` constant to the hosted address so the mic button inside Claude can link to it.

**Rule:** any feature that depends on `window.claude` must check for it and degrade gracefully. Any feature that needs the mic must explain itself when the mic isn't available.

The Claude-hosted copy is republished from a claude.ai chat. After changing `index.html` here, David asks Claude in claude.ai to republish it.

## Code map (sections of `index.html`, in order)

- **CSS**: design tokens in `:root`, dark theme blocks, and `html:root[data-appearance=...]` overrides.
- **`// ==CORE START==` … `// ==CORE END==`**: pure logic with no DOM, so Node can run it in tests. Keep it that way.
  - `FLUTE`, `HALF`, `BY_MIDI`: the instrument data.
  - `spell`, `staffStep`, `noteLabel`, `noteForHoles`: note helpers.
  - `parseABC`: an ABC subset parser. It handles headers T/M/L/K, key signatures and modes, bar-scoped accidentals, ties, broken rhythm `>` `<`, tuplets `(3`, chords (keeps the top note), rests, inline fields, and chord symbols and decorations (ignored).
    - If there are no headers at all, typed letters count as quarter notes (`L:1/4`).
  - `fitReport`, `bestShift`: try every transposition from −24 to +24 semitones and score them (exact note +1, half-hole note +0.5, missing note −2; ties go to the smallest shift).
  - `autoBars`, `pickupBeats`, `beatsPerBar`.
  - Listening (pure parts):
    - `rmsOf`.
    - `yinPitch`: YIN pitch detection limited to 480–1500 Hz.
    - `writtenFromFreq`: subtracts 12 because the flute sounds an octave up.
    - `NoteTracker`: turns frames into note events.
    - `makeFollow`: the "Follow me" logic.
    - `scoreTimed`: the "Play in time" scoring.
- **Song book**:
  - `BOOK`: warm-ups, original tunes and traditional songs, all exactly on the flute.
  - `XMAS`: Christmas songs, transposed at load with `bestShift`.
  - `LIBRARY` combines both.
  - `EXAMPLE_ABC` is "Twinkle, Twinkle", used to demo transposition and half-holes.
- **State `S`**: the single app state object (view, settings, big-flute state, player, make, compose, lesson, game).
- **Audio**:
  - `audio()` creates the AudioContext on the first tap (iOS rule).
  - `tone()` is the synth flute, using sine harmonics, vibrato and a breath "chiff".
  - `click()` is the metronome.
  - `runEvents()` schedules a list of events and returns the start time `t0`; `stopRun()` stops it.
- **Flute drawing**: `fluteSVG()` draws the big and mini flutes, with the thumb hole beside the body as on Choroi's chart. `drawBig()` and `showNote()` drive the left-hand flute column.
- **Score drawing**: `renderScore()` lays out bars into staff lines (systems) and draws note heads, stems, flags, dots, ties, triplet "3"s and rests, with the fingering diagram and colored letter under each note.
  - Note groups are `.nt[data-i]`.
  - CSS classes `on`, `ok`, `retry` and `miss` color them.
- **Storage `Store`**:
  - `localStorage` keys: `quinta.settings`, `quinta.songs`, `quinta.progress`.
  - With `db`: songs are at `data/users/<uid>/library/songs/<id>` and progress at `data/users/<uid>/progress`.
  - Songs are packed as `[m, d, flags]`.
- **Views**: Flute (chart), Songs (list and player), Make (photo, typed ABC, write your own, then the fit and transpose result), Learn (7 lessons and 3 games).
- **Appearance and Keep awake**:
  - `applyAppearance()` sets `data-appearance` on `<html>`.
  - `Awake` uses the Screen Wake Lock API, falling back to a tiny silent looping MP4 (data URI).
- **Listening (app layer)**:
  - `Mic` (getUserMedia with echo cancellation, noise suppression and auto gain all off; an AnalyserNode with fftSize 1024; one frame per animation frame).
  - `onMicFrame()` routes every frame to the "I hear" meter, the Flute tab, the active Follow session (`FS`), the scored session (`SC`) and game answers.
  - `startFollow()`, `startFollowSong()`, `startScored()`, `EXERCISES` (lessons 1, 2 and 6).
- **Navigation and actions**: hash routing (`#flute`, `#songs`, `#make`, `#learn`) and one delegated click handler that switches on `data-act`.

## Listening details (tuned against synthetic tones, not yet a real flute)

- **Frames:**
  - Each analysis frame is 1024 samples.
  - The loudness gate is `max(0.004, 3 × noise floor)`.
  - A frame needs a YIN clarity above 0.8.
  - Detected notes are accepted from MIDI 60 to 78 (written pitch).
- **`NoteTracker`:**
  - A note starts after 90 ms of stable pitch.
  - A loudness drop below 50% of the note's peak counts as a tongued break. The same note then only counts again once it gets 1.5× louder, so a slow fade never counts twice.
  - 50 ms of silence releases the note.
- **`makeFollow`:**
  - The right note advances at once.
  - A wrong note only counts if it starts after the current note was asked for and is held for 260 ms. This keeps finger changes and the tail of the previous note from counting.
- **`scoreTimed`:**
  - Each note is judged from frames between 20% and 92% of its time slot, shifted 70 ms for latency.
  - It's right if at least 30% of those frames have a pitch and at least half of those match.
- **Feedback loop:**
  - The mic would hear the app's own sound, so `tone()` sets `Mic.ignoreUntil`.
  - While listening, metronome clicks become low 262/330 Hz sine tocks, below the detector's 480 Hz floor.

## Song library rules

- Public-domain tunes only. Never include lyrics (titles are fine).
- Take melodies from published notation, not memory, and record where each came from in `src`. Current sources:
  - Go Tell It on the Mountain (chorus) and Mary Had a Baby: folkinfo.mainlynorfolk.info, ABC files 296 and 294.
  - Jolly Old Saint Nicholas: folktunefinder 168735.
  - Jingle Bells (chorus): haolingsheng.com.
  - Good King Wenceslas: flutetree.org. The source left the natural sign off the last note, so it was added.
- `BOOK` songs must fit the flute exactly (`fitReport` gives miss 0 and half 0). Christmas songs may use half-hole notes, and their cards show a "Half-hole" tag.
- "Up and Down the Hill", "A Is Home" and "Barn Swallows" are original tunes written for this app.
- Many carols don't fit. "Silent Night" goes higher and lower than the flute can play, and "Deck the Halls" and "We Wish You a Merry Christmas" use F♯ and C all the way through.

## Design and copy

- Colors are tokens only. Note colors go by pitch class (D blue, E green, G ochre, A red, B violet). Half-hole notes are grey, and notes that aren't on the flute are carmine with a "?".
- Light and dark themes:
  - The default follows the device or host (`prefers-color-scheme`, plus `data-theme` set by the Claude host).
  - The user's Appearance choice overrides both through `data-appearance`.
- Fonts:
  - Andika, a typeface designed for beginning readers.
  - Noto Music for the clef and note glyphs.
- iPad landscape is the main layout, but it must still work at phone width. Touch targets are at least 48 px.
- Copy: American English and plain words a child can follow. Use sentence case and active voice, with no emoji as section markers. Error messages say what went wrong and what to do next.
- Respect `prefers-reduced-motion`. Keyboard focus must be visible.

## Gotchas

- `[hidden]{display:none!important}` is needed because `.btn` sets `display`.
- Inline SVG uses `style="fill:var(--x)"`, not `fill="var(--x)"`.
- On iOS:
  - Web Audio has to start from a tap.
  - The mic needs https and a tap.
  - Silent Mode mutes Web Audio.
- The parser drops ties between different pitches.
- `renderLessonPane()` stops any running Follow session. On rotation, `drawPlayerScore()` re-applies Follow results.

## Testing

There are no test files in this repo yet. These are the checks that were used; recreate them under `tests/` when needed.

1. **Core logic** (`node tests/core.test.js index.html`):
   - Extract the code between the CORE markers and run it in a Node `vm`.
   - Check staff positions and key signatures.
   - Check the ABC features: broken rhythm, tuplets, chords and bar accidentals.
   - Check that every `BOOK` song fits at shift 0 and that its bars add up (allowing for a pickup).
   - Check that Twinkle comes out with half-holes and no misses, and test `autoBars`.
2. **Listening** (`node tests/listen.test.js`):
   - Synthesize flute-like tones (sine plus 2nd and 3rd harmonics plus noise) at 44.1 and 48 kHz, for A = 440 and 432, at 0 and ±30 cents. Every note must be detected correctly.
   - Legato notes, tongued repeats with 25–40 ms gaps, a 2 s fade that counts once, and silence.
   - A low click must be ignored.
   - Follow-me cases: a full song, a held wrong note, and a quick passing note that must not count.
   - `scoreTimed`.
3. **End to end with a fake mic**:
   - Serve the folder on `127.0.0.1`.
   - Launch Chrome with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<file.wav>%noloop`.
   - Drive it with Playwright: open Hot Cross Buns, press Follow me or Play in time, and read `#playFb` and the `.nt` classes.
   - WAVs come from a small numpy script; for Play in time, put 3.15 s of silence before the first note at 80 bpm.
4. **Visual check:** take one Playwright screenshot at 1180×820. To render the real fonts offline, route the Google Fonts requests to local copies of the TTF files.

## Open items

- Test the listening with the real flute in a real room, then tune the gate, onset, dip and wrong-note timings if needed.
- Check the F♯ and C half-hole fingerings on the real flute.
- Ask David which fingers cover which holes, then add finger names to the instructions.
- Host the standalone copy (GitHub Pages), set `STANDALONE_URL`, and republish the Claude copy.
- The Claude copy and the standalone copy don't share saved songs (`db` vs `localStorage`). An export/import of songs as ABC text could bridge them.
- Possible next features:
  - A mic sensitivity setting.
  - Rhythm-only clapping games.
  - More lessons with "Your turn" exercises.
  - A native wrapper (for example Capacitor) if Safari's mic or wake-lock limits get in the way.
