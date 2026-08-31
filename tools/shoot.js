/* Full-page screenshots of every page, for before/after regression checks.
 *
 *   node tools/shoot.js baseline     # write .screens/baseline/
 *   node tools/shoot.js after        # write .screens/after/
 *   node tools/shoot.js diff         # compare the two, report pixel deltas
 *
 * Shoots at desktop and mobile widths. Fonts come from Google and are blocked
 * in sandboxed runners, so we stub them to a local fallback — otherwise every
 * shot differs by whether the webfont happened to load in time.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOTS = path.join(ROOT, ".screens");
/* Port 0 asks the OS for a free one. A fixed port means a single
   orphaned run — a timeout, a killed process — blocks every run after it
   with EADDRINUSE, which is a confusing failure for a suite whose whole
   job is to be trusted. The real port is read back after listen(). */
const PORT = 0;
const mode = process.argv[2] || "baseline";

const WIDTHS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".xml": "application/xml",
  ".txt": "text/plain", ".json": "application/json", ".woff2": "font/woff2",
};

function serve() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
}

async function shoot(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const server = serve();
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

  const pages = fs.readdirSync(DIST).filter((f) => f.endsWith(".html")).sort();

  for (const { name, width, height } of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Block webfonts + analytics so shots are deterministic regardless of network.
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager|google-analytics/, (r) => r.abort());

    for (const file of pages) {
      const page = await ctx.newPage();
      try {
        await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
        // Freeze animation and hide the cursor follower, which tracks the mouse.
        await page.addStyleTag({
          content: `*,*::before,*::after{animation:none!important;transition:none!important}
                    .cursor,.cursor-icon{display:none!important}`,
        });
        await page.waitForTimeout(250);
        await page.screenshot({
          path: path.join(outDir, `${file.replace(/\.html$/, "")}--${name}.png`),
          fullPage: true,
        });
      } catch (e) {
        console.log(`  ! ${file} @${name}: ${e.message.split("\n")[0]}`);
      }
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`Shot ${pages.length} pages × ${WIDTHS.length} widths -> ${path.relative(ROOT, outDir)}`);
}

function diff() {
  const a = path.join(SHOTS, "baseline");
  const b = path.join(SHOTS, "after");
  if (!fs.existsSync(a) || !fs.existsSync(b)) {
    console.error("Need both .screens/baseline and .screens/after — run shoot first.");
    process.exit(1);
  }

  const files = fs.readdirSync(a).filter((f) => f.endsWith(".png"));
  const rows = [];

  for (const f of files) {
    const pb = path.join(b, f);
    if (!fs.existsSync(pb)) { rows.push({ f, note: "missing in after" }); continue; }

    const i1 = PNG.sync.read(fs.readFileSync(path.join(a, f)));
    const i2 = PNG.sync.read(fs.readFileSync(pb));

    if (i1.width !== i2.width || i1.height !== i2.height) {
      rows.push({ f, note: `size ${i1.width}×${i1.height} -> ${i2.width}×${i2.height}` });
      continue;
    }

    let differing = 0;
    for (let i = 0; i < i1.data.length; i += 4) {
      // Ignore imperceptible per-channel drift; we're hunting layout changes.
      if (
        Math.abs(i1.data[i] - i2.data[i]) > 4 ||
        Math.abs(i1.data[i + 1] - i2.data[i + 1]) > 4 ||
        Math.abs(i1.data[i + 2] - i2.data[i + 2]) > 4
      ) differing++;
    }
    const pct = (differing / (i1.width * i1.height)) * 100;
    if (pct > 0.05) rows.push({ f, note: `${pct.toFixed(2)}% pixels differ` });
  }

  if (!rows.length) {
    console.log(`No visual change across ${files.length} shots.`);
    return;
  }
  console.log(`\n${rows.length} of ${files.length} shots changed:`);
  rows.forEach((r) => console.log(`  ${r.f.padEnd(46)} ${r.note}`));
}

if (mode === "diff") diff();
else shoot(path.join(SHOTS, mode)).catch((e) => { console.error(e); process.exit(1); });
