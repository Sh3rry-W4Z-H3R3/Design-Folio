/* Internal links must resolve, case-sensitively.
 *
 *   node tools/link-check.js
 *
 * Cloudflare and Netlify both serve from case-sensitive storage, so a
 * link to /SideQuests.html when the file is side-quests.html is a 404 in
 * production even though it works on a case-insensitive local disk.
 * This was previously an inline snippet; it earns a file so verify.js
 * can run it.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const onDisk = new Set(fs.readdirSync(DIST));
const pages = fs.readdirSync(DIST).filter((f) => f.endsWith(".html"));

let bad = 0;
for (const p of pages) {
  const html = fs.readFileSync(path.join(DIST, p), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  for (const m of html.matchAll(/href\s*=\s*"([^"]+\.html[^"]*)"/gi)) {
    let h = m[1];
    if (/^https?:/i.test(h)) {
      if (!h.includes("sherjeelhussain.com")) continue;
      h = h.split("sherjeelhussain.com/")[1] || "";
    }
    const f = decodeURIComponent(h.split("#")[0].replace(/^\.\//, ""));
    if (f && !onDisk.has(f)) {
      console.log(`  FAIL ${p} -> ${m[1]}`);
      bad++;
    }
  }
}

console.log(`\n${bad ? bad + " broken internal link(s)." : "All internal links resolve (case-sensitive)."}`);
process.exit(bad ? 1 : 0);
