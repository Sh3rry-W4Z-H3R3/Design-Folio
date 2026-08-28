/* Repoint raw jpg/png references at their .webp sibling.
 *
 *   node tools/rewrite-raw-refs.js          # dry run, prints what would change
 *   node tools/rewrite-raw-refs.js --write  # apply
 *
 * Only rewrites a reference when the .webp actually exists on disk, so a
 * missing conversion leaves the original ref intact rather than breaking it.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const WRITE = process.argv.includes("--write");

// Quoted refs and unquoted url() need different patterns. Plenty of filenames
// here contain parentheses ("Screenshot (13).png"), which a quoted ref handles
// fine — but inside an unquoted url() a paren really does close the token, so
// that pattern has to stay strict.
// Inline styles carry entity-encoded quotes — url(&quot;a.jpg&quot;) — which the
// browser decodes before fetching. Match that form too, and preserve the
// encoding on the way out so the attribute stays valid.
const RAW_REF_PATTERNS = [
  /(["'])([^"']*?\.(?:jpe?g|png))(["'])/gi,
  /(&quot;|&#34;)((?:(?!&quot;|&#34;)[^<>])*?\.(?:jpe?g|png))(&quot;|&#34;)/gi,
  /(url\(\s*)([^)"'\s&][^)"']*?\.(?:jpe?g|png))(\s*\))/gi,
];

let changed = 0;
let pages = 0;

for (const file of fs.readdirSync(DIST).filter((f) => f.endsWith(".html"))) {
  const full = path.join(DIST, file);
  const before = fs.readFileSync(full, "utf8");
  const hits = [];

  const rewrite = (match, open, ref, close) => {
    if (/^(https?:|data:|\/\/)/i.test(ref)) return match;

    // Resolve the same way a browser would: strip CSS backslash escapes and
    // percent-encoding before touching the filesystem.
    const decoded = decodeURIComponent(ref.replace(/\\(.)/g, "$1")).replace(/^\.\//, "");
    const webpOnDisk = decoded.replace(/\.(jpe?g|png)$/i, ".webp");
    if (!fs.existsSync(path.join(DIST, webpOnDisk))) return match;

    // Rewrite only the extension, preserving whatever escaping the original
    // ref used so CSS url() and HTML src keep working exactly as before.
    const newRef = ref.replace(/\.(jpe?g|png)$/i, ".webp");
    hits.push(`${ref}  ->  ${newRef}`);
    return open + newRef + close;
  };

  const after = RAW_REF_PATTERNS.reduce((html, re) => html.replace(re, rewrite), before);

  if (hits.length) {
    pages++;
    changed += hits.length;
    console.log(`\n${file}  (${hits.length})`);
    hits.forEach((h) => console.log("  " + h));
    if (WRITE) fs.writeFileSync(full, after);
  }
}

console.log(
  `\n${changed} refs across ${pages} pages${WRITE ? " — written." : " — dry run, pass --write to apply."}`
);
