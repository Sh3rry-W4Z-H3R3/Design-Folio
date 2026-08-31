/* Responsive audit across the widths people actually use.
 *
 *   node tools/responsive.js              # all pages, all widths
 *   node tools/responsive.js craft        # pages matching a substring
 *
 * Reports, per page and width:
 *   OVERFLOW  — the document scrolls sideways, and which elements cause it
 *   TAP       — interactive targets under 24px, which are hard to hit
 *   CLIP      — text wider than its container (usually an unbroken string)
 *
 * Overflow is the one that matters most: a page that scrolls sideways on a
 * phone feels broken before anyone reads a word of it.
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

// Real device widths, plus the awkward ones between breakpoints where
// layouts usually fail.
const WIDTHS = [320, 360, 390, 430, 540, 768, 834, 1024, 1280, 1440, 1920];

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".xml": "application/xml",
  ".ico": "image/x-icon", ".txt": "text/plain", ".json": "application/json",
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

// Runs in the page. Returns the offenders, not just a count, so the
// output says what to fix rather than that something is wrong.
function probe() {
  const docW = document.documentElement.clientWidth;
  const out = { scrollW: document.documentElement.scrollWidth, docW, overflow: [], tap: [], clip: [] };

  const describe = (e) => {
    const cls = typeof e.className === "string" ? e.className.trim().split(/\s+/)[0] : "";
    return e.tagName.toLowerCase() + (e.id ? "#" + e.id : cls ? "." + cls : "");
  };

  const all = document.body.querySelectorAll("*");

  for (const e of all) {
    const st = getComputedStyle(e);
    if (st.display === "none" || st.visibility === "hidden") continue;
    const r = e.getBoundingClientRect();
    if (!r.width && !r.height) continue;

    // Sideways overflow. Fixed-position things (menus, cursors) sit
    // outside the flow and don't cause document scroll, so skip them.
    if (st.position !== "fixed" && r.right > docW + 1) {
      // Only report the outermost offender: a wide parent makes every
      // child look wide too, and the parent is what needs fixing.
      const parent = e.parentElement;
      const parentWide = parent && parent.getBoundingClientRect().right > docW + 1;
      if (!parentWide) out.overflow.push({ el: describe(e), right: Math.round(r.right) });
    }

    // Text that can't fit its box — usually an unbroken URL or filename.
    // Requires actual text: decorative empty spans (door handles, rules,
    // icon holders) legitimately report a scrollWidth of their own.
    if (
      e.children.length === 0 &&
      e.textContent.trim() &&
      e.scrollWidth > e.clientWidth + 2 &&
      st.overflowX !== "auto" &&
      st.overflowX !== "scroll"
    ) {
      out.clip.push({ el: describe(e), by: Math.round(e.scrollWidth - e.clientWidth) });
    }

    // Touch targets. Only on narrow viewports, where fingers are the
    // input. Links inside a paragraph are excluded — inline text links
    // are not expected to be 24px tall.
    if (docW <= 540 && (e.tagName === "A" || e.tagName === "BUTTON")) {
      const inline = st.display === "inline" || (e.closest("p") && e.tagName === "A");
      if (!inline && (r.height < 24 || r.width < 24) && r.height > 0) {
        out.tap.push({ el: describe(e), size: Math.round(r.width) + "x" + Math.round(r.height) });
      }
    }
  }

  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((o) => !seen.has(o[key]) && seen.add(o[key]));
  };
  out.overflow = dedupe(out.overflow, "el").slice(0, 6);
  out.clip = dedupe(out.clip, "el").slice(0, 6);
  out.tap = dedupe(out.tap, "el").slice(0, 6);
  return out;
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const port = server.address().port;
  const roots = fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-"));
  const exe = path.join("/opt/pw-browsers", roots.sort().pop(), "chrome-linux", "chrome");
  const browser = await chromium.launch({ executablePath: exe });

  const pages = fs
    .readdirSync(DIST)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase()))
    .sort();

  const findings = [];

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      hasTouch: w <= 540,
      isMobile: w <= 540,
    });
    await ctx.route(/fonts\.(googleapis|gstatic)|googletagmanager|google-analytics/, (r) => r.abort());

    for (const file of pages) {
      const page = await ctx.newPage();
      try {
        await page.goto(`http://localhost:${port}/${file}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(120);
        const r = await page.evaluate(probe);
        if (r.scrollW > r.docW + 1 || r.clip.length || r.tap.length) {
          findings.push({ file, w, ...r });
        }
      } catch (e) {
        findings.push({ file, w, error: e.message.split("\n")[0] });
      }
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();
  server.close();

  // Group by page so the output reads as a to-do list.
  const byPage = {};
  findings.forEach((f) => (byPage[f.file] = byPage[f.file] || []).push(f));

  let overflowPages = 0;
  for (const [file, rows] of Object.entries(byPage)) {
    console.log("\n" + file);
    const of = rows.filter((r) => r.scrollW > r.docW + 1);
    if (of.length) {
      overflowPages++;
      console.log("  OVERFLOW at " + of.map((r) => r.w).join(", ") + "px");
      of[0].overflow.forEach((o) => console.log(`      ${o.el} extends to ${o.right}px`));
    }
    const clip = rows.filter((r) => r.clip && r.clip.length);
    if (clip.length) {
      console.log("  CLIPPED TEXT at " + clip.map((r) => r.w).join(", ") + "px");
      clip[0].clip.forEach((c) => console.log(`      ${c.el} overflows by ${c.by}px`));
    }
    const tap = rows.filter((r) => r.tap && r.tap.length);
    if (tap.length) {
      console.log("  SMALL TAP TARGETS at " + tap.map((r) => r.w).join(", ") + "px");
      tap[0].tap.forEach((t) => console.log(`      ${t.el} is ${t.size}`));
    }
  }

  console.log(
    `\n${pages.length} pages × ${WIDTHS.length} widths. ` +
      `${Object.keys(byPage).length} page(s) with findings, ${overflowPages} with sideways overflow.`
  );
})();
