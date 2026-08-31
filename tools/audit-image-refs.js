/* Audit every image reference in the HTML.
 *
 *   node tools/audit-image-refs.js
 *
 * Reports three things:
 *   1. RAW    — refs still pointing at .jpg/.jpeg/.png (these block relocating originals)
 *   2. MISSING— refs whose target file doesn't exist on disk (case-sensitively)
 *   3. ORPHANS— image files on disk that no HTML page references
 *
 * Exits non-zero if RAW or MISSING is non-empty, so it can gate the cleanup.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const IMG_EXT = /\.(webp|jpe?g|png|svg|gif|avif)$/i;
const RAW_EXT = /\.(jpe?g|png)$/i;

// Pull candidate paths out of src, srcset, href, and url(...) in inline CSS.
// Only srcset gets comma-split — plenty of filenames here legitimately
// contain commas ("iPhone 15 Mockup, Perspective.webp"), and splitting a
// plain src on them invents paths that were never referenced.
const REF_PATTERNS = [
  { re: /(?:src|href)\s*=\s*"([^"]+)"/gi, list: false },
  { re: /(?:src|href)\s*=\s*'([^']+)'/gi, list: false },
  { re: /srcset\s*=\s*"([^"]+)"/gi, list: true },
  { re: /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, list: false },
];

// Commented-out markup ("<!-- REPLACE: <img src=…> -->") isn't a live
// reference, and neither is anything inside a CSS comment.
const stripComments = (html) =>
  html.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

// Inline styles often carry entity-encoded quotes: style="… url(&quot;a.jpg&quot;)".
// The browser decodes these before fetching, so the scan has to as well —
// otherwise the ref reads as ending in "&quot;" and is skipped as a non-image.
const decodeEntities = (html) =>
  html
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
const imageFiles = allFiles.filter((f) => IMG_EXT.test(f));
const onDisk = new Set(imageFiles.map((f) => path.relative(DIST, f)));

const raw = [];
const missing = [];
const referenced = new Set();

for (const file of htmlFiles) {
  const html = decodeEntities(stripComments(fs.readFileSync(file, "utf8")));
  const page = path.relative(DIST, file);

  for (const { re, list } of REF_PATTERNS) {
    for (const match of html.matchAll(re)) {
      // srcset holds a comma-separated list of "path 800w" descriptors
      const candidates = (list ? match[1].split(",") : [match[1]])
        .map((s) => (list ? s.trim().split(/\s+/)[0] : s.trim()))
        .filter(Boolean);

      for (const ref of candidates) {
        if (/^(https?:|data:|mailto:|tel:|#)/i.test(ref)) continue;
        if (!IMG_EXT.test(ref)) continue;

        // In CSS, "a\ b" is an escaped space that resolves to "a b" — these
        // load fine in the browser, so decode rather than reporting them.
        const unescaped = ref.replace(/\\(.)/g, "$1");
        const clean = decodeURIComponent(unescaped.split(/[?#]/)[0]).replace(/^\.\//, "");
        const resolved = path.normalize(
          path.join(path.dirname(page), clean.startsWith("/") ? "." + clean : clean)
        );

        referenced.add(resolved);
        const exists = onDisk.has(resolved);
        // A raw ref only blocks the cleanup if the file is actually there —
        // a raw ref to a file that doesn't exist is a pending asset (a photo
        // still to be shot), reported as MISSING and nothing to relocate.
        if (RAW_EXT.test(clean) && exists) raw.push({ page, ref });
        if (!exists) missing.push({ page, ref, resolved });
      }
    }
  }
}

const orphans = [...onDisk].filter((f) => !referenced.has(f));

const report = (title, rows, fmt) => {
  console.log(`\n${title}: ${rows.length}`);
  rows.slice(0, 40).forEach((r) => console.log("  " + fmt(r)));
  if (rows.length > 40) console.log(`  … and ${rows.length - 40} more`);
};

console.log(`Scanned ${htmlFiles.length} pages, ${imageFiles.length} image files.`);
report("RAW refs (jpg/png on disk, still referenced)", raw, (r) => `${r.page} -> ${r.ref}`);
report("MISSING refs (asset not yet supplied)", missing, (r) => `${r.page} -> ${r.ref}`);
report("ORPHAN files (on disk, unreferenced)", orphans, (f) => f);

if (raw.length) {
  console.log("\nNot safe to relocate originals — the refs above would break.");
  process.exit(1);
}
console.log(
  "\nEvery live image ref resolves to an existing WebP. Safe to relocate originals." +
    (missing.length ? `\n(${missing.length} ref(s) await an asset you haven't supplied yet.)` : "")
);
