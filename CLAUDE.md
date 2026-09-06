# sherjeelhussain.com — working notes

Portfolio for **Sherjeel Hussain**, Glasgow-based physical/industrial and
digital designer. The site's job is to win him work as a **hybrid designer**,
so an industrial-design hiring manager scanning the first screen must not
come away thinking "ceramics hobbyist".

Self-taught, intermediate. **He edits this by hand.** That constraint decides
most of the architecture below — no build step, no framework, no bundler.

---

## The concept

A **workshop**. The visitor lands outside a shopfront, two doors lead to the
Industrial and Digital rooms, and **the navigation is a floorplan** — not a
nav bar. There is no nav bar in a workshop; there is a building you move
through. Someone in a hurry can bypass the tour (see *editorial mode*).

Six rooms: **Industrial** (mint), **Digital** (pink), **Exhibition** (the one
light room), **Play** (gold), **Office** (rose), plus the entrance.

---

## Architecture

27 static HTML pages in `dist/`. No build. Pages link a shared layer, then
carry their own inline `<style>`.

```
dist/
  tokens.css              palette, type scale, spacing — the base
  assets/css/
    rooms.css             per-room token sets, keyed on <html data-room>
    base.css              resets, cursor suppression
    chrome.css            custom cursor, footer nav, skip link, mode switch
    glass.css             the floating rail (nav) + chrome token scope
    floorplan.css         the <dialog> plan
    case.css              the case-study spine + the Cone
  assets/js/
    chrome.js             cursor (delegated), mode switch
    floorplan.js          PLAN geometry -> the dialog, the rail, the glyph
    case.js               the Cone (scroll reveal), case studies only
```

Link order matters: `tokens → rooms → base → chrome → glass → floorplan →
case`, then the page's own inline styles.

### Two systems worth understanding before editing

**Rooms.** `<html data-room="digital">` selects a token set in `rooms.css`.
Everything else reads tokens. A page that hardcodes a hex will not follow its
room — that has caused three separate bugs here, so treat any literal colour
in a page as suspect.

**Modes.** A blocking inline `<head>` script sets `<html data-mode>` before
paint. `workshop` is the full experience; `editorial` is the fast path
(touch, reduced motion, or an explicit choice) and deliberately skips the
custom cursor and the Cone.

---

## The case-study spine

All 18 case studies run six beats **in this order**, each declaring itself
with `data-case-beat`:

`ps` → `hard` → `turn` → *(the page's own journey sections)* → `landed` →
`unblocked`

Problem/Solution · What made it hard · The turn · … · Where it landed · What
it unblocked.

The test: **read only the beat headings and you should get a coherent
argument.** Constraints (`hard`) are the hinge — they explain why the turn
happened, and the turn explains why the making looks the way it does.

A page may render a beat with its own component (Kala Topi's tensions,
Tarebook's mid-build pivot, Origin's constraints panel) as long as it carries
the attribute. The harness checks the *sequence*, not the markup.

---

## Verification

```bash
node tools/verify.js      # smoke, cursor, behaviour, links, responsive
node tools/behaviour.js   # 219 checks, ~40s — the useful one while working
node tools/selftest.js    # 30 deliberate bugs, proves the checks can fail
```

`selftest.js` plants a known bug, asserts the matching check goes red, and
restores. **A check without a mutation is not evidence.** If you add a check,
add a mutation.

Expect **26/27 smoke** — `about.html`'s missing portrait is pre-existing and
is Sherjeel's to supply.

---

## Traps, all of which have already cost time here

- **`pgrep -f "tools/selftest.js"` matches your own waiter shell**, because
  the pattern is in its command line. Use `pgrep -f "[t]ools/selftest\.js"`.
  The same trap once killed the session's shell via `pkill -f chrome`.
- **selftest only refuses to run on a dirty tree under `dist/`.** While it
  runs, one file shows modified — that is its planted mutation, which it
  restores. **Never commit it**, whatever the stop hook says. If a run is
  interrupted, the next run replays `tools/.selftest-journal.json` and
  recovers.
- **`rm` scratch files BEFORE `git add -A`**, not after. A probe was swept
  into a commit that way.
- **Deploy previews are unreachable from the sandbox.** The egress proxy
  denies `pages.dev`, `netlify.app`, `workers.dev` and `sherjeelhussain.com`
  at CONNECT with a 403. Verify from check runs, never by fetching.
- **`/assets/*` is cached for 24h** (`dist/_headers`). After a deploy, a
  returning browser serves stale CSS/JS. Hard-refresh before believing a
  change did not land — this has been mistaken for a bug once already.
- **Don't pipe a long-running log through `head`.** It truncates the summary
  line you actually needed, and you cannot then quote a result.

---

## House style

Match the surrounding code's comment density — this codebase explains *why*,
including what was measured and what was got wrong. Keep that.

Never invent a metric, a client outcome, or a project fact. Where a page has
no number, say so. Two case studies (`cherry-vision`, `kala-topi`) say
outright that there is nothing to report yet; that is deliberate.

Contrast is checked, not eyeballed. AA (4.5:1) for text. The exhibition room
is where this bites — see `docs/HANDOFF.md`.
