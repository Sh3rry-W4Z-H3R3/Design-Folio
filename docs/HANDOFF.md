# Handoff — state of the rebuild

Written 2026-09-06 to continue this work in a fresh session.
Read `CLAUDE.md` first; it is the operational half. This is the state.

---

## Where it is

`main` is live on three hosts (Netlify, Cloudflare Pages, Cloudflare Workers)
at **sherjeelhussain.com**. Two PRs merged: **#8** (rooms, doors, nav in the
corner) and **#9** (the case-study spine, Edward's review, the Cone).

**Current numbers** — quote these only after re-running, they move:

| | |
|---|---|
| behaviour checks | 219 |
| selftest mutations | 30 |
| smoke | 26/27 (the missing portrait) |
| responsive | 27 pages × 11 widths, clean |
| `dist/` | 297 MB |

---

## What has been built, in order

**Phase 0** — image tooling out of the deploy dir, filenames normalised with
redirects, cache headers.

**Phase 1** — the shared CSS/JS layer extracted from 26 pages of duplication.
The mode system. `chrome.js` replacing ~35 lines of cursor JS copy-pasted
into every page.

**Phase 3 / 3b** — the floorplan became the navigation. Top nav deleted from
25 pages. The rail moved to the top right as one liquid-glass container
holding wordmark, contact pill and plan glyph.

**Phase 4** — every room given its own identity. Industrial leads with
manufacture work (CANTI, Origin, THUDPUK) rather than ceramics. Digital leads
with Tarebook, Andra's, Sim Glasgow. Exhibition became the light room.

**The spine** — all 18 case studies on the six beats. This is the current
work and the thing most likely to need iteration.

**The Cone** — one piece of motion: a firing line down the left edge that
fills with scroll, beats lighting as it passes. Named for the pyrometric cone
because it is a progress reading. Everything it hides is gated behind a class
only `case.js` sets, so JS-off / reduced-motion / editorial all get plain
readable text.

---

## The exhibition room — read this before touching colour

It is the one light room and it has broken **four** separate times. The
pattern is always the same: something assumes dark.

1. Every exhibition page redeclared `:root { --bg: #0a0a0a }`, which ties
   with `[data-room="exhibition"]` on specificity and wins on order.
2. Panels hardcoded `#111` / `#0e0e0e` and stayed dark while their text went
   dark with the tokens — 1.07:1.
3. The floorplan's `::backdrop` was a fixed near-black, giving the light room
   a dark panel wearing near-black text.
4. It read as a white-out: `--surface` was **lighter** than the wall it sat
   on (1.11:1, the wrong way round) and hairlines were at 1.23:1.

Current values, all measured:

```css
--bg: #f2ece1   --fg: #000000   --fg-mid: #3a3630   --fg-dim: #5f594f
--surface: #e7e0d2   --surface-2: #dcd3c2      /* darker than the wall */
--line: #cabfa9      --line-2: #a89e8c
--accent: #276048        /* 6.26:1 wall, 5.60 surface, 4.96 surface-2 */
--accent-chrome: mint    /* on the dark nav, 8.42:1 */
--accent-on-media: mint  /* on photographs */
```

`--mint` measures **1.86:1** on this room's wall — right green, wrong
lightness. That is why the room carries a deepened one of its own.

**The chrome is not in the room.** `.rail` and `.plan` reset the neutral
tokens for their own subtree in `glass.css`, so the nav is the same dark
object on every page. The rail scrim is `0.92` alpha, not `0.55` — a
translucent veil takes its colour from what is behind it, so 55% black
composited to mid-grey over cream while reading near-black over the dark
rooms. Declaring it dark was not enough to make it look dark.

---

## Waiting on Sherjeel

Do **not** chase these; he is aware.

- `img/sherjeel-portrait.jpg` — the one smoke failure.
- **AGH MacBook mockup** re-exported on a neutral ground. The CSS half is
  done (`andras.html`, `#14161a`) and commented as half a fix; the blue is
  baked into the image.
- Higher-quality image exports generally (Edward's note).
- Grey-box `.glb` — blocks **Phase 2**, the 3D shopfront.
- A floorplan geometry sketch — `PLAN` in `floorplan.js` is placeholder.
- The editorial-mode design pass.
- The 421 MB `src-images/` decision.
- Clearing Netlify's Base directory field.

**One flag, raised once, still unanswered:** his text said "green for digital,
pink for physical", but his own reference image and `rooms.css` both say
Physical = mint, Digital = pink. Built to the image and the codebase. Do not
raise it again unasked.

---

## Outlook — what is next

1. **Iterate the spine copy.** Every beat is his words restructured, drawn
   from what each page already said. Some will be wrong. That is expected and
   he edits it.
2. **Phase 2, the 3D shopfront** — unblocks the moment the `.glb` arrives.
   The door transition is already built against the 2D fallback, so the scene
   plugs into a finished transition.
3. **Editorial mode** needs a design of its own. It works; it has never been
   art-directed.
4. **`index.html` hero** — parked pending his Figma.
5. **The Side Quests Liquid screenshot** contains a visible
   `{% comment %} TO DO : Add alt text AND CHANGE IMAGE {% endcomment %}`.
   Flagged to him; his call whether that reads as honest working code.

---

## Reviewer feedback driving the work

**Edward Wairumbi**, verbatim, and where each landed:

| | |
|---|---|
| "start with problem and solution statements — *client had x problem, i gave them y solution*" | beat 1, all 18 |
| "try to show how you unblocked future problems for the brand/client" | beat 6, all 18 |
| "revisit the journey before showcasing the final works" | beat order, enforced by the harness |
| "more numbers/stats + images" | done where real numbers existed; **never invented** |
| "landing page should feature 3-4 best projects" | `index.html`, seven → four |
| "Kala Topi is a great project and should land higher" | `digital.html`, 4th → 2nd, narrow → wide |
| "move brand strat above colour section" | `kala-topi.html` |
| "Coding is an extra, include examples in the side quests page" | `side-quests.html` Code section |
| "On AGH mockups, use a neutral background" | half done, see above |
| "export images to highest quality" | his manual pass |

---

## Context-reduction tips for the next session

The single biggest cost in this project is re-reading files that are already
understood. To keep a session cheap:

- **Read `CLAUDE.md` and this file, then stop.** They exist so the codebase
  does not have to be re-derived. Do not open all 27 pages to "get oriented".
- **Grep for structure, don't read whole pages.** The case studies are
  700–1700 lines each and mostly inline CSS. To see a page's shape:
  ```bash
  grep -n 'data-case-beat\|class="section-label"\|<h2' dist/canti.html
  ```
- **Never `cat` a case study.** Use `sed -n 'START,ENDp'` on a located range.
- **Use `tools/behaviour.js` (~40s) while working**; save the full
  `verify.js` (~6 min) and `selftest.js` (~15 min) for before a commit.
- **Run long jobs backgrounded and write to a log file**, then read the log.
  Do not pipe through `head`/`tail` — you lose the summary line.
- **One measurement beats three guesses.** Every colour decision here was
  settled with a contrast script rather than by eye; that is faster than
  arguing about it and it is what the checks assert.
- Screenshots: `.screens/` holds baselines. Element screenshots
  (`locator.screenshot`) are far cheaper to read than full pages.

---

## Git

Branch: `claude/portfolio-rebuild-planning-c3iu31`. GitHub deletes it on
merge, so after each merge reset it from the new `main`
(`git checkout -B <branch> origin/main`) and open a **new** PR — a merged PR
cannot carry follow-up work.

Commit messages here explain *why*, name what was measured, and say what was
got wrong. Keep that; it is most of this repo's documentation.
