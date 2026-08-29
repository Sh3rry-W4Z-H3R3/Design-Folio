/* Behaviour checks for the shared chrome: mode resolution, the mobile
 * menu, and keyboard access.
 *
 *   node tools/behaviour.js
 *
 * These are the things screenshots cannot see.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DIST = path.join(__dirname, "..", "dist");
const PORT = 8799;
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".svg": "image/svg+xml" };

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

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const roots = fs.readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-"));
  const exe = path.join("/opt/pw-browsers", roots.sort().pop(), "chrome-linux", "chrome");
  const browser = await chromium.launch({ executablePath: exe });
  const url = (p) => `http://localhost:${PORT}/${p}`;

  // 1. Desktop, fine pointer, motion allowed -> workshop.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("digital.html"));
    const mode = await page.getAttribute("html", "data-mode");
    check("desktop resolves to workshop", mode === "workshop", "got " + mode);
    const room = await page.getAttribute("html", "data-room");
    check("digital.html declares its room", room === "digital", "got " + room);
    await ctx.close();
  }

  // 2. Touch device -> editorial.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(url("digital.html"));
    const mode = await page.getAttribute("html", "data-mode");
    check("coarse pointer resolves to editorial", mode === "editorial", "got " + mode);
    await ctx.close();
  }

  // 3. Reduced motion -> editorial.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(url("digital.html"));
    const mode = await page.getAttribute("html", "data-mode");
    check("reduced motion resolves to editorial", mode === "editorial", "got " + mode);
    await ctx.close();
  }

  // 4. A stored choice beats the environment.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(url("digital.html"));
    await page.evaluate(() => localStorage.setItem("sh.mode", "workshop"));
    await page.reload();
    const mode = await page.getAttribute("html", "data-mode");
    check("stored choice overrides environment", mode === "workshop", "got " + mode);
    await ctx.close();
  }

  // 5. Mobile menu: opens, traps focus, closes on Escape.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);

    const burger = page.locator(".nav__burger");
    check("burger is present on mobile", await burger.count() === 1);
    check("burger is visible on mobile", await burger.isVisible());

    await burger.click();
    await page.waitForTimeout(400);
    check("menu opens", await page.locator(".nav__mobile.open").count() === 1);
    check("aria-expanded set", (await burger.getAttribute("aria-expanded")) === "true");
    check("scroll locked while open", await page.evaluate(() => document.body.classList.contains("nav-open")));

    const focusInMenu = await page.evaluate(() => !!document.activeElement.closest(".nav__mobile"));
    check("focus moves into the menu", focusInMenu);

    // Menu links should mirror the desktop nav, not a hardcoded list.
    const [deskCount, mobCount] = await page.evaluate(() => [
      document.querySelectorAll("nav .nav__links a").length,
      document.querySelectorAll(".nav__mobile > a").length,
    ]);
    check("menu mirrors the desktop nav", deskCount === mobCount, deskCount + " desktop vs " + mobCount + " mobile");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("Escape closes the menu", await page.locator(".nav__mobile.open").count() === 0);
    check("focus returns to the burger", await page.evaluate(() => document.activeElement.classList.contains("nav__burger")));
    await ctx.close();
  }

  // 6. No duplicate cursor handling left behind on a migrated page.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(200);
    const usesInline = await page.evaluate(() =>
      [...document.querySelectorAll("script:not([src])")].some((s) => /getElementById\(["']cursor["']\)/.test(s.textContent))
    );
    check("inline cursor JS removed", !usesInline);
    await ctx.close();
  }

  // 7. Floorplan: opens as a modal, marks the current room, closes on
  //    Escape, and returns focus.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);

    const trigger = page.locator(".plan-trigger");
    check("floorplan trigger present in workshop mode", (await trigger.count()) === 1);

    await trigger.click();
    await page.waitForTimeout(300);

    check("plan opens as a modal dialog", await page.evaluate(() => {
      const d = document.getElementById("floorplan");
      return !!d && d.open && d.matches(":modal");
    }));

    // craft.html is the physical room, so that room should be marked.
    check("current room is marked", await page.evaluate(() => {
      const cur = document.querySelector('.plan__room[aria-current="page"]');
      return !!cur && cur.dataset.room === "physical";
    }), "expected physical");

    check("every room is a real link", await page.evaluate(() =>
      [...document.querySelectorAll(".plan__room")].every((a) => a.tagName === "A" && a.getAttribute("href"))
    ));

    check("doors are real links", await page.evaluate(() =>
      [...document.querySelectorAll(".plan__door")].every((a) => a.tagName === "A" && a.getAttribute("href"))
    ));

    // A modal dialog makes the rest of the page inert, which is the
    // focus trap — verify rather than assume.
    check("page behind is inert while open", await page.evaluate(() => {
      const outside = document.querySelector("nav .nav__links a");
      outside.focus();
      return document.activeElement !== outside;
    }));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape closes the plan", await page.evaluate(() => !document.getElementById("floorplan").open));
    check("focus returns to the trigger", await page.evaluate(() =>
      document.activeElement.classList.contains("plan-trigger")
    ));
    await ctx.close();
  }

  // 8. No floorplan in editorial mode — that mode is the opt-out.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);
    check("no floorplan trigger in editorial mode", (await page.locator(".plan-trigger").count()) === 0);
    await ctx.close();
  }

  await browser.close();
  server.close();

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`  ${r.pass ? "ok  " : "FAIL"} ${r.name}${r.detail && !r.pass ? "  (" + r.detail + ")" : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} behaviour checks passed.`);
  process.exit(failed ? 1 : 0);
})();
