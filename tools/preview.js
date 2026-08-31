/* Build a responsive preview: representative pages at phone, tablet and
 * desktop widths, written as WebP data URIs into a single HTML page.
 *
 *   node tools/preview.js > preview-shots.json
 *
 * Viewport-height shots rather than full-page: the point is to see how
 * each page composes at each size, not to read the whole thing.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const sharp = require("./node_modules/sharp");

const DIST = path.join(__dirname, "..", "dist");
const OUT = path.join(__dirname, "..", ".screens", "preview");
const PORT = 8811;

const PAGES = [
  ["index.html", "Home — the gateway"],
  ["digital.html", "Digital room"],
  ["craft.html", "Physical room"],
  ["work.html", "All work"],
  ["kala-topi.html", "Case study — Kala Topi"],
  ["contact.html", "Contact"],
];

const SIZES = [
  { name: "phone", width: 390, height: 844, out: 260 },
  { name: "tablet", width: 834, height: 1112, out: 380 },
  { name: "desktop", width: 1440, height: 900, out: 760 },
];

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
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, r));
  const roots = fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-"));
  const exe = path.join("/opt/pw-browsers", roots.sort().pop(), "chrome-linux", "chrome");
  const browser = await chromium.launch({ executablePath: exe });

  const shots = {};

  for (const size of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.width <= 540,
      isMobile: size.width <= 540,
      deviceScaleFactor: 2,
    });
    // Fonts are blocked in this sandbox, so shots would differ run to run
    // if we let them race. Blocking makes the preview deterministic; the
    // real site loads Cormorant and Syne from Google Fonts.
    await ctx.route(/fonts\.(googleapis|gstatic)|googletagmanager|google-analytics/, (r) => r.abort());

    for (const [file] of PAGES) {
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}" });
      await page.waitForTimeout(400);
      const buf = await page.screenshot();
      const webp = await sharp(buf).resize({ width: size.out * 2 }).webp({ quality: 72 }).toBuffer();
      shots[`${file}|${size.name}`] = "data:image/webp;base64," + webp.toString("base64");
      await page.close();
    }
    await ctx.close();
  }

  // The floorplan, open. Desktop only — the trigger is deliberately hidden
  // below 768px, where the burger menu is the way through.
  for (const size of [SIZES[2], SIZES[1]]) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
    });
    await ctx.route(/fonts\.(googleapis|gstatic)|googletagmanager|google-analytics/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/craft.html`, { waitUntil: "networkidle" });
    const trigger = page.locator(".plan-trigger");
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(600);
      const buf = await page.screenshot();
      const webp = await sharp(buf).resize({ width: size.out * 2 }).webp({ quality: 72 }).toBuffer();
      shots[`floorplan|${size.name}`] = "data:image/webp;base64," + webp.toString("base64");
    }
    await ctx.close();
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(shots));
  const bytes = Object.values(shots).reduce((n, s) => n + s.length, 0);
  console.error(`${Object.keys(shots).length} shots, ${(bytes / 1024 / 1024).toFixed(1)}MB of data URIs`);
})();
