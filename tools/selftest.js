/* Does the harness actually catch bugs?
 *
 *   node tools/selftest.js
 *
 * A suite that always passes is indistinguishable from one that cannot
 * fail. This deliberately breaks the site in known ways, asserts the
 * matching check goes red, and puts the file back.
 *
 * Every mutation here is a bug that really shipped, or the exact class of
 * bug a check was written to catch. If you add a check to verify.js, add
 * a mutation for it here — otherwise there is no evidence it works.
 *
 * Files are restored from an in-memory copy in a finally block, and the
 * run aborts if the working tree is dirty, so a crash cannot leave a
 * mutation behind.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const MUTATIONS = [
  {
    name: "the cursor stops following the pointer",
    detectedBy: "cursor-check.js",
    scope: ["craft"],
    file: "assets/js/chrome.js",
    /* This replaces "cursor anchored to page CSS instead of the viewport",
       which stopped being a bug that could happen. That mutation stripped
       the inline left/top anchor so a page's own `left: 50vw` would offset
       the dot — but every page-level .cursor rule has since been removed,
       and chrome.css positions the dot at the origin itself, so removing
       the anchor no longer breaks anything. A mutation nothing can catch
       is not evidence of a weak check; it is a mutation whose hazard is
       gone.

       The anchor stays as insurance against a page reintroducing that
       CSS. What cursor-check.js still genuinely defends is the tracking
       itself, so that is what this breaks. */
    mutate: (s) => {
      const old = 'dot.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";';
      if (!s.includes(old)) throw new Error("paint transform not found");
      // Half-speed tracking: the dot still moves, so it looks alive.
      return s.replace(old, 'dot.style.transform = "translate(" + (x / 2) + "px," + (y / 2) + "px) translate(-50%,-50%)";');
    },
  },
  {
    name: "footer clusters no longer wrap on narrow screens",
    detectedBy: "responsive.js",
    scope: ["about"],
    file: "assets/css/chrome.css",
    mutate: (s) => {
      const old = ".footer-nav,\n.footer-nav__left,\n.footer-nav__right {\n  flex-wrap: wrap;\n}";
      if (!s.includes(old)) throw new Error("flex-wrap block not found");
      return s.replace(old, ".footer-nav,\n.footer-nav__left,\n.footer-nav__right {\n  flex-wrap: nowrap;\n}");
    },
  },
  {
    name: "a referenced image is missing",
    detectedBy: "smoke.js",
    scope: ["craft"],
    file: "craft.html",
    mutate: (s) => s.replace(/\.webp/, ".webp-GONE"),
  },
  {
    name: "an internal link points at a page that does not exist",
    detectedBy: "link-check.js",
    file: "craft.html",
    mutate: (s) => s.replace('href="digital.html"', 'href="Digital.html"'),
  },
  {
    name: "the plan button is no longer wired to the dialog",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // The rail is the only way into the navigation now. A trigger that
    // renders but does not open the dialog looks completely fine in a
    // screenshot.
    mutate: (s) => {
      const old = 'nav.setAttribute("aria-controls", "floorplan");';
      if (!s.includes(old)) throw new Error("aria-controls line not found");
      return s.replace(old, 'nav.setAttribute("aria-controls", "nothing");');
    },
  },
  {
    name: "the plan is hidden again below 768px",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/css/floorplan.css",
    // The rule this restores is the one Phase 3b removed. With the top
    // nav gone it would leave a phone with no navigation at all.
    mutate: (s) =>
      s + "\n@media (max-width: 768px) { .plan__inner { display: none; } }\n",
  },
  {
    name: "a case study loses its back chip",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    mutate: (s) => {
      const old = "    if (parent) {";
      if (!s.includes(old)) throw new Error("back chip branch not found");
      return s.replace(old, "    if (false) {");
    },
  },
  {
    name: "the cursor icons stop reaching the plan",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // The exact regression the nav removal would have caused silently:
    // data-cursor lived only on the nav links.
    mutate: (s) => {
      const old = "      if (r.cursor) a.dataset.cursor = r.cursor;";
      if (!s.includes(old)) throw new Error("room cursor line not found");
      return s
        .replace(old, "")
        .replace("      if (d.cursor) a.dataset.cursor = d.cursor;", "");
    },
  },
  {
    name: "editorial mode is left with no navigation",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // Restores the pre-3b early return, which was correct only while a
    // top nav existed to fall back to.
    mutate: (s) => {
      const old = "  function init() {\n    if (document.querySelector(\".rail\")) return;";
      if (!s.includes(old)) throw new Error("init guard not found");
      return s.replace(
        old,
        "  function init() {\n    if (!workshop) return;\n    if (document.querySelector(\".rail\")) return;"
      );
    },
  },
  {
    name: "the rail falls back to the panel's thin tint",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/css/glass.css",
    // Over craft.html's pale clay card this drops the wordmark from
    // 5.68:1 to 2.06:1 — invisible to a screenshot diff, unreadable to a
    // person.
    mutate: (s) => {
      const old = "  background: var(--glass-bg-rail);";
      if (!s.includes(old)) throw new Error("rail scrim rule not found");
      return s.replace(old, "  background: var(--glass-bg);");
    },
  },
  {
    name: "a top nav comes back on one page",
    detectedBy: "behaviour.js",
    scope: [],
    file: "craft.html",
    // The nav check reads the source rather than loading 26 pages in a
    // browser, which is fast but easy to get subtly wrong — footer-nav__left
    // contains the substring nav__left. This proves it still fires.
    mutate: (s) => {
      const anchor = "<body>";
      if (!s.includes(anchor)) throw new Error("no <body> to inject into");
      return s.replace(
        anchor,
        anchor + '\n<nav><a href="index.html" class="nav__home">Sherjeel</a></nav>'
      );
    },
  },
  {
    name: "the entrance beacon reverts to an ordinary rail",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // Restores the second wordmark on index.html: the hero says the name
    // and so does the corner. Both render fine, which is exactly why a
    // screenshot would not catch it.
    mutate: (s) => {
      const old = 'if (page === PLAN.entrance.href) {';
      if (!s.includes(old)) throw new Error("beacon branch not found");
      return s.replace(old, "if (false) {");
    },
  },
  {
    name: "a page grows the cursor with its own inline loop again",
    detectedBy: "behaviour.js",
    scope: [],
    file: "contact.html",
    // The exact shape that hid from the old check: a per-element loop
    // written without getElementById, on a page the check never loaded.
    mutate: (s) => {
      const anchor = "</body>";
      if (!s.includes(anchor)) throw new Error("no </body>");
      return s.replace(
        anchor,
        '<script>document.querySelectorAll("a").forEach(function (el) {' +
          ' el.addEventListener("mouseenter", function () { cursor.classList.add("grow"); }); });' +
          "</script>\n" + anchor
      );
    },
  },
  {
    name: "a page loses its declared cursor targets",
    detectedBy: "behaviour.js",
    scope: [],
    file: "side-quests.html",
    // Removing the attribute costs the grow on .gallery-item — behaviour
    // the inline loops used to carry, which is exactly what could have
    // been dropped silently when they were swept.
    mutate: (s) => {
      const old = ' data-cursor-targets=".gallery-item"';
      if (!s.includes(old)) throw new Error("data-cursor-targets not found");
      return s.replace(old, "");
    },
  },
  {
    name: "a room overrides its own accent again",
    detectedBy: "behaviour.js",
    scope: [],
    file: "side-quests.html",
    // The exact fault that sat in the Play room unnoticed: the page
    // declares its room and then quietly repaints it another room's
    // colour. Consistently wrong looks designed.
    mutate: (s) => {
      const anchor = "</head>";
      if (!s.includes(anchor)) throw new Error("no </head>");
      return s.replace(anchor, "<style>:root{--accent:#e8547a;}</style>\n" + anchor);
    },
  },
  {
    name: "the floorplan no longer opens as a modal",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    /* The anchor moved when the click handler grew a body: this used to
       match a one-line `if (...) dlg.showModal();`. It reported ERROR
       rather than MISSED, which is the distinction worth keeping — a
       mutation that cannot be applied says nothing about the check. */
    mutate: (s) => {
      const old = 'if (typeof dlg.showModal === "function") {';
      if (!s.includes(old)) throw new Error("showModal branch not found");
      // Falls through to the non-modal setAttribute("open") path.
      return s.replace(old, "if (false) {");
    },
  },
  {
    name: "the facade drifts back to the bottom of the plan",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/css/floorplan.css",
    // The doors have to sit over the rooms they open into — that is the
    // only reason to draw a plan rather than list links. Nobody re-checks
    // that by eye after moving a wall.
    mutate: (s) => {
      const old = ".plan__facade {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 0;";
      if (!s.includes(old)) throw new Error("facade block not found");
      return s.replace(old, ".plan__facade {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;");
    },
  },
  {
    name: "a plan link carries data-room again",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    /* The bug that hid the Exhibition title. rooms.css matches a bare
       [data-room="exhibition"], so a plan link carrying it turned the
       light room's tokens on for its own subtree and drew the name in
       near-black on the dark panel. */
    mutate: (s) => {
      const old = "      a.dataset.planRoom = r.id;\n      // The monitor/pot cursor icons";
      if (!s.includes(old)) throw new Error("room link assignment not found");
      return s.replace(old, "      a.dataset.planRoom = r.id;\n      a.dataset.room = r.id;\n      // The monitor/pot cursor icons");
    },
  },
  {
    name: "the light room's plan loses its own scrim",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/css/floorplan.css",
    // A light panel over a near-black backdrop: the exhibition room's
    // glass tokens are built for a pale ground, and the dialog was
    // painting one it could not sit on.
    mutate: (s) => {
      const old = '[data-room="exhibition"] .plan::backdrop {\n  background: rgba(210, 202, 188, 0.86);\n}';
      if (!s.includes(old)) throw new Error("light-room backdrop not found");
      return s.replace(old, "");
    },
  },
  {
    name: "each rail control carries its own glass again",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // Four stacked backdrop-filters, which is what the single pane
    // replaced. It looks plausible in a diff and smeared on screen.
    mutate: (s) => {
      const old = 'var nav = el("button", "plan-btn");';
      if (!s.includes(old)) throw new Error("plan button not found");
      return s.replace(old, 'var nav = el("button", "plan-btn glass");');
    },
  },
  {
    name: "the cursor stays on the body when the plan opens",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    /* showModal() puts the dialog in the top layer, above every z-index
       on the page. Leaving the dot behind does not stop it tracking — it
       just paints it underneath, which is why the plan was the one screen
       on the site with no pointer of its own. */
    mutate: (s) => {
      const old = "        dlg.showModal();\n        carry(dlg);";
      if (!s.includes(old)) throw new Error("carry call not found");
      return s.replace(old, "        dlg.showModal();");
    },
  },
  {
    name: "a narrow window loses its pointer entirely",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/css/chrome.css",
    /* The pages hide the custom cursor below 768px; base.css suppresses
       the system one by pointer type, which does not follow width. With
       only one half of that pair in place, a laptop window dragged under
       768px has nothing pointing at all — and nothing about the page
       looks broken, because the page looks exactly the same. */
    mutate: (s) => {
      const old = '  :root[data-mode="workshop"] body,\n  :root[data-mode="workshop"] a,\n  :root[data-mode="workshop"] button,\n  :root[data-mode="workshop"] summary,\n  :root[data-mode="workshop"] [role="button"] {\n    cursor: auto;\n  }';
      if (!s.includes(old)) throw new Error("narrow-screen cursor restore not found");
      return s.replace(old, "");
    },
  },
];

function checkFails(script, scope) {
  // Scope to the affected page where the check supports it: the full
  // responsive sweep is ~8 minutes, and running it five times would make
  // this suite too slow to actually run.
  const r = spawnSync(process.execPath, [path.join(__dirname, script)].concat(scope || []), {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  // responsive.js reports rather than exiting non-zero.
  if (script === "responsive.js") {
    const m = out.match(/(\d+) page\(s\) with findings/);
    return !!m && m[1] !== "0";
  }
  return r.status !== 0;
}

/* ── SURVIVING A HARD KILL ──────────────────────────────────
   An earlier version tracked mutations in memory and restored them from
   signal handlers. That does not work, and this suite proved it: almost
   all of its wall-clock time is spent inside spawnSync, which blocks the
   event loop, so a SIGTERM arriving mid-check is never delivered to a JS
   handler at all. A run killed by a timeout left a mutated stylesheet
   behind — silently, in a suite whose entire job is to be trustworthy.

   So the record of what has been changed lives on DISK, written before
   the mutation and deleted after the restore. Nothing needs to run at
   exit for it to work: the next run finds the journal and puts the file
   back. That survives SIGKILL, a timeout, and a container restart. */
const JOURNAL = path.join(__dirname, ".selftest-journal.json");

function journalWrite(file, original) {
  fs.writeFileSync(JOURNAL, JSON.stringify({ file, original }));
}
function journalClear() {
  if (fs.existsSync(JOURNAL)) fs.unlinkSync(JOURNAL);
}

// Replay before anything else, including the dirty check — a leftover
// mutation IS a dirty tree, and refusing to start because of it would
// leave the only thing that can clean it up unable to run.
if (fs.existsSync(JOURNAL)) {
  try {
    const { file, original } = JSON.parse(fs.readFileSync(JOURNAL, "utf8"));
    fs.writeFileSync(file, original);
    console.log(`recovered a mutation left by an interrupted run: ${path.relative(ROOT, file)}\n`);
  } catch (e) {
    console.error("Could not replay the journal — restore by hand:\n" + e.message);
    process.exit(2);
  }
  journalClear();
}

// Refuse to run against uncommitted work — a crash mid-mutation would be
// indistinguishable from the user's own edits.
const dirty = spawnSync("git", ["status", "--porcelain", "dist"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
if (dirty) {
  console.error("Working tree under dist/ is dirty. Commit or stash first:\n" + dirty);
  process.exit(2);
}

// Belt and braces for the cases where the loop IS free to run.
function panic(e) {
  journalClear();
  if (e) console.error(e);
  process.exit(e ? 1 : 130);
}
["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) => process.on(sig, () => panic()));
process.on("uncaughtException", panic);

const results = [];
for (const m of MUTATIONS) {
  const full = path.join(DIST, m.file);
  const original = fs.readFileSync(full, "utf8");
  let caught = false;
  let error = null;
  try {
    // Journal first: between this line and the restore below, the file
    // on disk is wrong, and only the journal knows how to put it right.
    journalWrite(full, original);
    fs.writeFileSync(full, m.mutate(original));
    caught = checkFails(m.detectedBy, m.scope);
  } catch (e) {
    error = e.message;
  } finally {
    fs.writeFileSync(full, original);
    journalClear();
  }
  results.push({ ...m, caught, error });
  console.log(
    `  ${error ? "ERROR" : caught ? "caught" : "MISSED"}  ${m.detectedBy.padEnd(16)} ${m.name}` +
      (error ? `  (${error})` : "")
  );
}

const missed = results.filter((r) => !r.caught || r.error);
console.log(`\n${results.length - missed.length}/${results.length} deliberate bugs were caught.`);
if (missed.length) {
  console.log("A check that cannot fail is not a check. Fix the ones marked MISSED.");
}
process.exit(missed.length ? 1 : 0);
