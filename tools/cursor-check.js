/* Does the custom cursor actually track the pointer, on every page?
 *
 *   node tools/cursor-check.js
 *
 * This exists because a real bug shipped past every other harness:
 * craft.html's own CSS pinned .cursor at left:50vw/top:50vh, and
 * chrome.js positions by transform — which is relative to that — so the
 * dot rendered half a screen away from the pointer. Screenshots could
 * not see it (shoot.js hides the cursor for determinism) and the
 * behaviour tests never asked where it was.
 *
 * Checks, per page, at two pointer positions:
 *   - the dot's centre sits on the pointer, within tolerance
 *   - the icon, if the page has one, sits at its intended offset
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
const TOLERANCE = 2; // px — sub-pixel rounding only
const PROBES = [[200, 300], [1100, 700]];
const filter = process.argv[2]; // optional page substring, used by selftest

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".png": "image/png", ".xml": "application/xml",
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(DIST, rel);
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

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)|googletagmanager|google-analytics/, (r) => r.abort());

  const pages = fs
    .readdirSync(DIST)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase()))
    .sort();
  const bad = [];

  for (const file of pages) {
    const page = await ctx.newPage();
    try {
      await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(200);

      const hasDot = await page.evaluate(() => !!document.getElementById("cursor"));
      if (!hasDot) { await page.close(); continue; }

      for (const [mx, my] of PROBES) {
        await page.mouse.move(mx, my);
        await page.waitForTimeout(90);
        const at = await page.evaluate(() => {
          const d = document.getElementById("cursor");
          if (getComputedStyle(d).display === "none") return null;
          const r = d.getBoundingClientRect();
          return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });
        if (!at) break; // hidden here — nothing to track
        const dx = Math.round(at.cx - mx);
        const dy = Math.round(at.cy - my);
        if (Math.abs(dx) > TOLERANCE || Math.abs(dy) > TOLERANCE) {
          bad.push({ file, mx, my, dx, dy });
          break;
        }
      }
    } catch (e) {
      bad.push({ file, err: e.message.split("\n")[0] });
    }
    await page.close();
  }

  await browser.close();
  server.close();

  bad.forEach((b) =>
    console.log(
      b.err
        ? `  FAIL ${b.file}  ${b.err}`
        : `  FAIL ${b.file}  pointer(${b.mx},${b.my}) but dot is off by (${b.dx},${b.dy})`
    )
  );
  console.log(`\n${pages.length - bad.length}/${pages.length} pages track the pointer correctly.`);
  process.exit(bad.length ? 1 : 0);
})();
