/* Load every page in a real browser and report what breaks.
 *
 *   node tools/smoke.js                 # all pages
 *   node tools/smoke.js cycle-arts      # just pages matching a substring
 *
 * Checks per page: failed network requests (404s on images, CSS, JS),
 * console errors, and uncaught page exceptions. Serves dist/ over HTTP
 * rather than file:// so relative paths resolve the way they will in
 * production. Exits non-zero if anything failed.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DIST = path.join(__dirname, "..", "dist");
const PORT = 8788;
const filter = process.argv[2];

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
  ".xml": "application/xml", ".txt": "text/plain", ".json": "application/json",
  ".woff2": "font/woff2", ".glb": "model/gltf-binary",
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DIST, rel);
  // Keep the served tree inside dist/ even if a page requests ../
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));

  const pages = fs
    .readdirSync(DIST)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase()))
    .sort();

  // The preinstalled browsers are versioned (chromium-1194/…); PLAYWRIGHT_BROWSERS_PATH
  // points at the root, so find the binary rather than hardcoding a version.
  const roots = fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-"));
  const exe = path.join("/opt/pw-browsers", roots.sort().pop(), "chrome-linux", "chrome");
  const browser = await chromium.launch({ executablePath: exe });
  const results = [];

  for (const file of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const failed = [];
    const errors = [];

    page.on("requestfailed", (r) => failed.push(`${r.url().replace(`http://localhost:${PORT}/`, "")} (${r.failure()?.errorText})`));
    page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.url().replace(`http://localhost:${PORT}/`, "")} (${r.status()})`); });
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));

    try {
      await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
    } catch (e) {
      errors.push(`navigation: ${e.message}`);
    }

    // Ignore third-party analytics/fonts — not what this harness is for, and
    // in a sandboxed runner they fail on the proxy regardless of site health.
    const THIRD_PARTY = /ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|googletagmanager|google-analytics|fonts\.(googleapis|gstatic)/i;
    const local = failed.filter((f) => !/^https?:\/\//.test(f) && !THIRD_PARTY.test(f));
    const realErrors = errors.filter((e) => !THIRD_PARTY.test(e));
    results.push({ file, failed: local, errors: realErrors });
    await ctx.close();
  }

  await browser.close();
  server.close();

  let bad = 0;
  for (const r of results) {
    if (!r.failed.length && !r.errors.length) continue;
    bad++;
    console.log(`\n✗ ${r.file}`);
    [...new Set(r.failed)].forEach((f) => console.log(`    404  ${f}`));
    [...new Set(r.errors)].forEach((e) => console.log(`    err  ${e.slice(0, 160)}`));
  }

  console.log(`\n${results.length - bad}/${results.length} pages clean.`);
  process.exit(bad ? 1 : 0);
})();
