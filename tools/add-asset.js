/* Add a shared stylesheet or script to every page.
 *
 *   node tools/add-asset.js css assets/css/floorplan.css --after assets/css/chrome.css
 *   node tools/add-asset.js js  assets/js/floorplan.js   --after assets/js/chrome.js
 *
 * Add --write to apply; without it, reports what would change.
 * Idempotent: a page that already references the asset is skipped.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const [kind, asset] = process.argv.slice(2);
const WRITE = process.argv.includes("--write");
const afterIdx = process.argv.indexOf("--after");
const after = afterIdx > -1 ? process.argv[afterIdx + 1] : null;

if (!kind || !asset || !["css", "js"].includes(kind)) {
  console.error("Usage: node tools/add-asset.js <css|js> <path> [--after <path>] [--write]");
  process.exit(1);
}

const line =
  kind === "css"
    ? '<link rel="stylesheet" href="' + asset + '" />'
    : '<script src="' + asset + '" defer></script>';

let changed = 0;
const skipped = [];

for (const file of fs.readdirSync(DIST).filter((f) => f.endsWith(".html")).sort()) {
  const full = path.join(DIST, file);
  let html = fs.readFileSync(full, "utf8");

  if (html.includes(asset)) {
    skipped.push(file);
    continue;
  }

  // Match the anchor line and keep its exact indentation, so the output
  // sits with the lines around it rather than at column zero.
  const anchorRe = after
    ? new RegExp("([ \\t]*)(<(?:link|script)[^>]*" + after.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^>]*>(?:</script>)?)")
    : null;

  if (anchorRe && anchorRe.test(html)) {
    html = html.replace(anchorRe, (m, indent, tag) => indent + tag + "\n" + indent + line);
  } else if (kind === "css") {
    html = html.replace(/([ \t]*)<\/head>/, "$1  " + line + "\n$1</head>");
  } else {
    html = html.replace(/([ \t]*)<\/body>/, "$1  " + line + "\n$1</body>");
  }

  changed++;
  if (WRITE) fs.writeFileSync(full, html);
}

console.log(
  `${changed} page(s) ${WRITE ? "updated" : "would change"}` +
    (skipped.length ? `, ${skipped.length} already had it` : "")
);
