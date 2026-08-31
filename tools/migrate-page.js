/* Migrate pages onto the shared CSS/JS layer.
 *
 *   node tools/migrate-page.js            # dry run, reports per page
 *   node tools/migrate-page.js --write    # apply
 *   node tools/migrate-page.js --write craft.html digital.html
 *
 * Per page it:
 *   1. sets <html data-room> — derived from the --accent the page ALREADY
 *      uses, so the migration cannot change any page's colours
 *   2. inserts the blocking mode snippet into <head>
 *   3. links rooms.css / base.css / chrome.css after tokens.css
 *   4. swaps mobile-nav.js for assets/js/chrome.js
 *   5. strips the inline cursor JS, which would otherwise fight chrome.js
 *      (the old code sets left/top; chrome.js sets transform)
 *
 * Step 5 removes statements by balanced-delimiter scanning from known
 * anchors rather than by line ranges, because the copy-pasted blocks are
 * formatted differently on different pages.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const WRITE = process.argv.includes("--write");
const only = process.argv.slice(2).filter((a) => a.endsWith(".html"));

const SNIPPET = fs
  .readFileSync(path.join(__dirname, "mode-snippet.html"), "utf8")
  .match(/<!-- MODE:START -->[\s\S]*<!-- MODE:END -->/)[0]
  .split("\n")
  .map((l) => (l.trim() ? "    " + l.trim() : l))
  .join("\n");

const LINKS = [
  '    <link rel="stylesheet" href="assets/css/rooms.css" />',
  '    <link rel="stylesheet" href="assets/css/base.css" />',
  '    <link rel="stylesheet" href="assets/css/chrome.css" />',
].join("\n");

// Accent value -> room. Derived from what each page already declares, so
// a page keeps exactly the accent it has today.
const ACCENT_ROOM = {
  "#e8547a": "digital",
  "#6dbf9e": "physical",
  "#c8b882": "play",
};

// Where a page's semantic room differs from what its accent implies.
// Exhibition pages currently use the mint/craft accent; naming them here
// records the real room without changing any colour, because rooms.css
// gives exhibition the same mint accent until Phase 4.
const SEMANTIC = {
  "exhibitions.html": "exhibition",
  "blend.html": "exhibition",
  "cycle-arts.html": "exhibition",
  "crafted-by-design.html": "exhibition",
  "cherry-vision.html": "exhibition",
  "side-quests.html": "play",
};

// Pages that belong to no single room — the shopfront, the about/contact
// office, and the all-work index. rooms.css :root already gives them the
// pink/mint default these pages use, so leaving them unroomed is both
// semantically right and visually identical.
const NEUTRAL = new Set(["index.html", "about.html", "contact.html", "work.html"]);

// Pages whose accent disagrees with the room they actually belong to.
// Both predate this work: Andra's Garden Heaven is a digital Shopify
// project wearing the craft mint, and Origin Plastics is an industrial
// design internship wearing the play gold. Reassigning them would change
// how the pages look, which is a Phase 4 design decision, not something
// a mechanical migration should do — so the accent is preserved and the
// mismatch is reported instead.
const MISMATCH = {
  "andras.html": "digital",
  "origin.html": "physical",
};

/* Walk forward from `start` past one complete statement, respecting
   strings, template literals and nested brackets. Returns the index just
   past the terminating semicolon. */
function endOfStatement(src, start) {
  let i = start;
  let depth = 0;
  let quote = null;
  let tmplDepth = 0;

  while (i < src.length) {
    const c = src[i];
    const prev = src[i - 1];

    if (quote) {
      if (c === "\\") { i += 2; continue; }
      if (c === quote) {
        quote = null;
      } else if (quote === "`" && c === "$" && src[i + 1] === "{") {
        tmplDepth++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (tmplDepth && c === "}") { tmplDepth--; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i === -1) return src.length; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 2; continue; }

    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0) return i + 1;

    i++;
    if (prev === undefined && i > src.length) break;
  }
  return -1;
}

// Anchors for the cursor code. A pattern is only removed if the statement
// it starts actually mentions the cursor, so unrelated page JS using the
// same selector is left alone.
const CURSOR_ANCHORS = [
  /(?:const|let|var)\s+cursor\s*=\s*document\.getElementById\(/,
  /(?:const|let|var)\s+cursorIcon\s*=\s*document\.getElementById\(/,
  /(?:const|let|var)\s+ICONS\s*=\s*\{/,
  /document\.addEventListener\(\s*["']mousemove["']/,
  /document\.addEventListener\(\s*["']mouse(?:enter|leave)["']/,
  /document\.querySelectorAll\(\s*["']\[data-cursor\]["']\s*\)/,
  /document\.querySelectorAll\(\s*["']a:not\(\[data-cursor\]\)["']\s*\)/,
  /document\.querySelectorAll\(\s*["']a,\s*button["']\s*\)/,
];

function stripCursorJs(script) {
  let out = script;
  let removed = 0;

  for (const re of CURSOR_ANCHORS) {
    let guard = 0;
    while (guard++ < 10) {
      const m = out.match(re);
      if (!m) break;
      const start = m.index;
      const end = endOfStatement(out, start);
      if (end === -1) break;
      const stmt = out.slice(start, end);
      // Only remove if this statement is genuinely cursor code.
      if (!/cursor|ICONS/i.test(stmt)) break;
      out = out.slice(0, start) + out.slice(end);
      removed++;
    }
  }
  return { out, removed };
}

const pages = (only.length ? only : fs.readdirSync(DIST).filter((f) => f.endsWith(".html"))).sort();
const report = [];

for (const file of pages) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) { report.push({ file, note: "not found" }); continue; }

  let html = fs.readFileSync(full, "utf8");
  const before = html;
  const did = [];

  // 1. data-room, derived from the page's existing accent.
  if (!/<html[^>]*data-room=/.test(html) && !NEUTRAL.has(file)) {
    const accent = (html.match(/--accent:\s*(#[0-9a-f]{6})/i) || [])[1];
    const room = SEMANTIC[file] || ACCENT_ROOM[(accent || "").toLowerCase()];
    if (room) {
      html = html.replace(/<html([^>]*)>/, '<html$1 data-room="' + room + '">');
      did.push("room=" + room + (MISMATCH[file] ? " [semantically " + MISMATCH[file] + "]" : ""));
    } else {
      did.push("room=none" + (accent ? " (accent " + accent + ")" : ""));
    }
  }

  // 2. Mode snippet, before the font preconnect.
  if (!html.includes("MODE:START")) {
    if (/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/.test(html)) {
      html = html.replace(
        /(\s*)<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/,
        "\n\n" + SNIPPET + "\n$1<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\""
      );
      did.push("mode");
    } else {
      did.push("MODE SKIPPED (no preconnect)");
    }
  }

  // 3. Shared stylesheets, after tokens.css.
  if (!html.includes("assets/css/base.css")) {
    if (/<link rel="stylesheet" href="tokens\.css"\s*\/?>/.test(html)) {
      html = html.replace(
        /(<link rel="stylesheet" href="tokens\.css"\s*\/?>)/,
        "$1\n" + LINKS
      );
      did.push("css");
    } else {
      did.push("CSS SKIPPED (no tokens.css)");
    }
  }

  // 4. chrome.js in place of mobile-nav.js.
  if (html.includes("mobile-nav.js")) {
    html = html.replace(/<script src="mobile-nav\.js"( defer)?><\/script>/, '<script src="assets/js/chrome.js" defer></script>');
    did.push("chrome.js");
  } else if (!html.includes("assets/js/chrome.js")) {
    html = html.replace(/(\s*)<\/body>/, '$1  <script src="assets/js/chrome.js" defer></script>\n$1</body>');
    did.push("chrome.js (added)");
  }

  // 5. Inline cursor JS.
  let totalRemoved = 0;
  html = html.replace(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi, (m, body, off, whole) => {
    if (!/cursor/i.test(body)) return m;
    const { out, removed } = stripCursorJs(body);
    totalRemoved += removed;
    // Drop the whole tag if nothing but whitespace and comments remain.
    if (!out.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").trim()) return "";
    return m.replace(body, out);
  });
  if (totalRemoved) did.push("cursorJS×" + totalRemoved);

  if (html !== before) {
    report.push({ file, note: did.join(", ") });
    if (WRITE) fs.writeFileSync(full, html);
  } else {
    report.push({ file, note: "no change" });
  }
}

report.forEach((r) => console.log(`  ${r.file.padEnd(30)} ${r.note}`));
console.log(`\n${report.filter((r) => r.note !== "no change").length} pages ${WRITE ? "migrated" : "would change (dry run)"}.`);
