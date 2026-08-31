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
/* Port 0 asks the OS for a free one. A fixed port means a single
   orphaned run — a timeout, a killed process — blocks every run after it
   with EADDRINUSE, which is a confusing failure for a suite whose whole
   job is to be trusted. The real port is read back after listen(). */
const PORT = 0;
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
  const port = server.address().port;

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

  /* Pages link Google Fonts and a gtag snippet. Neither is reachable from
     the sandbox this runs in, and every page load sat waiting on them:
     three page loads took 37.8s as-is and 0.26s with them blocked. The
     harness is testing this site, not Google's uptime, so anything leaving
     localhost is refused outright. It also makes runs deterministic —
     nothing here should depend on a third party being up. */
  const _newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const ctx = await _newContext(opts);
    await ctx.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === "localhost" || host === "127.0.0.1") return route.continue();
      // Fulfil with an empty stub rather than aborting. An abort logs
      // "Failed to load resource: net::ERR_FAILED" to the console, which
      // smoke.js would then report as this site's error — and filtering
      // that message out by text would also hide a genuine one.
      const TYPE = { stylesheet: "text/css", script: "text/javascript", font: "font/woff2" };
      return route.fulfill({
        status: 200,
        contentType: TYPE[route.request().resourceType()] || "text/plain",
        body: "",
      });
    });
    return ctx;
  };

  const results = [];

  for (const file of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const failed = [];
    const errors = [];

    page.on("requestfailed", (r) => {
      // Requests to third parties are aborted on purpose (see the route
      // above), so they are not this site's failures.
      if (new URL(r.url()).hostname !== "localhost") return;
      failed.push(`${r.url().replace(`http://localhost:${port}/`, "")} (${r.failure()?.errorText})`);
    });
    page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.url().replace(`http://localhost:${port}/`, "")} (${r.status()})`); });
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));

    try {
      await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
    } catch (e) {
      errors.push(`navigation: ${e.message}`);
    }

    // Ignore third-party analytics/fonts — not what this harness is for, and
    // in a sandboxed runner they fail on the proxy regardless of site health.
    const THIRD_PARTY = /ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|googletagmanager|google-analytics|fonts\.(googleapis|gstatic)/i;
    // favicon.ico is requested by the browser, not by the page. The site has
    // no favicon yet, but that is a design asset to add, not a page defect.
    const local = failed.filter(
      (f) => !/^https?:\/\//.test(f) && !THIRD_PARTY.test(f) && !/favicon\.ico/.test(f)
    );
    const faviconOnly = failed.length && local.length === 0;
    const realErrors = errors.filter(
      (e) => !THIRD_PARTY.test(e) && !(faviconOnly && /404/.test(e))
    );
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
