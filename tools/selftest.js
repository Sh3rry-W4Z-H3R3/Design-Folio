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
    name: "cursor anchored to page CSS instead of the viewport",
    detectedBy: "cursor-check.js",
    scope: ["craft"],
    file: "assets/js/chrome.js",
    // Removes the inline left/top anchor, restoring the real bug where a
    // page's own `left: 50vw` offsets the dot from the pointer.
    mutate: (s) => {
      const i = s.indexOf("    // Anchor both elements at the viewport origin");
      const j = s.indexOf("    var x = 0, y = 0, queued = false;");
      if (i === -1 || j === -1) throw new Error("anchor block not found");
      return s.slice(0, i) + s.slice(j);
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
    name: "the wordmark is no longer wired to the plan",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    // The rail is the only way into the navigation now. A trigger that
    // renders but does not open the dialog looks completely fine in a
    // screenshot.
    mutate: (s) => {
      const old = 'mark.setAttribute("aria-controls", "floorplan");';
      if (!s.includes(old)) throw new Error("aria-controls line not found");
      return s.replace(old, 'mark.setAttribute("aria-controls", "nothing");');
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
    name: "the floorplan no longer opens as a modal",
    detectedBy: "behaviour.js",
    scope: [],
    file: "assets/js/floorplan.js",
    mutate: (s) => {
      const old = 'if (typeof dlg.showModal === "function") dlg.showModal();';
      if (!s.includes(old)) throw new Error("showModal call not found");
      return s.replace(old, 'if (false) dlg.showModal();');
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

// Refuse to run against uncommitted work — a crash mid-mutation would be
// indistinguishable from the user's own edits.
const dirty = spawnSync("git", ["status", "--porcelain", "dist"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
if (dirty) {
  console.error("Working tree under dist/ is dirty. Commit or stash first:\n" + dirty);
  process.exit(2);
}

// A finally block does not run when the process is killed — a timeout
// during an earlier version of this suite left a mutated craft.html
// behind. Track what is currently mutated and restore on the way out,
// however we exit.
const inFlight = new Map();
function restoreAll() {
  for (const [file, text] of inFlight) fs.writeFileSync(file, text);
  inFlight.clear();
}
["SIGINT", "SIGTERM", "SIGHUP"].forEach((sig) =>
  process.on(sig, () => {
    restoreAll();
    process.exit(130);
  })
);
process.on("exit", restoreAll);
process.on("uncaughtException", (e) => {
  restoreAll();
  console.error(e);
  process.exit(1);
});

const results = [];
for (const m of MUTATIONS) {
  const full = path.join(DIST, m.file);
  const original = fs.readFileSync(full, "utf8");
  let caught = false;
  let error = null;
  try {
    inFlight.set(full, original);
    fs.writeFileSync(full, m.mutate(original));
    caught = checkFails(m.detectedBy, m.scope);
  } catch (e) {
    error = e.message;
  } finally {
    fs.writeFileSync(full, original);
    inFlight.delete(full);
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
