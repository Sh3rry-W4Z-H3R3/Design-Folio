/* Behaviour checks for the shared chrome: mode resolution, the floating
 * chrome, the floorplan, and keyboard access.
 *
 *   node tools/behaviour.js
 *
 * These are the things screenshots cannot see — and after Phase 3b the
 * screenshots see even less, because the nav they used to frame every
 * page is gone. Anything asserted here needs a matching mutation in
 * selftest.js, or there is no evidence the check can fail.
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

  const url = (p) => `http://localhost:${port}/${p}`;

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

  // 5. The floating rail replaces the nav, at every width.
  {
    for (const [w, h, label] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(url("craft.html"));
      await page.waitForTimeout(300);

      check(`rail is present at ${label}`, (await page.locator(".rail").count()) === 1);
      check(`wordmark is visible at ${label}`, await page.locator(".mark").isVisible());
      check(
        `wordmark is inside the viewport at ${label}`,
        await page.evaluate(() => {
          const r = document.querySelector(".mark").getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth;
        })
      );
      await ctx.close();
    }
  }

  // 6. The old nav is gone everywhere — a leftover would mean two
  //     navigations disagreeing with each other.
  //
  //     Read from the source rather than loading 26 pages in a browser.
  //     This check sits inside every behaviour mutation the selftest runs,
  //     so a browser sweep here cost about two minutes per mutation and
  //     stretched the suite past twenty minutes — slow enough that it
  //     stops being run, which is worse than a slightly weaker check.
  //
  //     Nothing injects navigation at runtime any more (initMobileNav is
  //     gone), but "nothing does" is the sort of thing that quietly stops
  //     being true, so two representative pages are still checked as
  //     rendered: index.html, whose only <nav> is a footer, and craft.html,
  //     which had one of the 25 that were removed.
  {
    const DEAD_CLASS = /(?<![\w-])nav__(?:home|links|back|burger|mobile)(?![\w-])/;
    const offenders = [];
    for (const file of fs.readdirSync(DIST).filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(DIST, file), "utf8");
      const topNav = (html.match(/<nav\b[^>]*>/g) || []).filter(
        (tag) => !/class=["'][^"']*\bfooter-nav\b/.test(tag)
      );
      // footer-nav__left and friends must not trip the class test.
      if (topNav.length || DEAD_CLASS.test(html)) offenders.push(file);
    }
    check("no top nav in the source of any page", offenders.length === 0, offenders.join(", "));

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const rendered = [];
    for (const file of ["index.html", "craft.html"]) {
      await page.goto(url(file));
      await page.waitForTimeout(250);
      const bad = await page.evaluate(() => {
        const nav = [...document.querySelectorAll("nav")].filter(
          (n) => !n.classList.contains("footer-nav")
        );
        const dead = document.querySelectorAll(
          ".nav__home, .nav__links, .nav__back, .nav__burger, .nav__mobile"
        );
        return nav.length + dead.length;
      });
      if (bad) rendered.push(file);
    }
    check("nothing injects a nav at runtime", rendered.length === 0, rendered.join(", "));
    await ctx.close();
  }

  // 7. No duplicate cursor handling left behind on ANY page.
  //
  //    This check used to load craft.html alone and match on
  //    getElementById("cursor"). Six other pages were carrying their own
  //    mouseenter/mouseleave loops written a different way, and it saw
  //    none of them — a check narrow enough to pass is worse than no
  //    check, because it reads as coverage. It scans every page's inline
  //    scripts now, for the shapes that actually occurred.
  {
    const PATTERNS = [
      /cursor\.classList\.(?:add|remove)\(/,   // per-element grow loops
      /getElementById\(["']cursor["']\)/,       // the original shape
      /cursor(?:Icon)?\.style\.(?:left|top)\s*=/, // pinning it by hand
    ];
    const offenders = [];
    for (const file of fs.readdirSync(DIST).filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(DIST, file), "utf8");
      for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
        if (PATTERNS.some((p) => p.test(m[1]))) { offenders.push(file); break; }
      }
    }
    check("no inline cursor JS on any page", offenders.length === 0, offenders.join(", "));
  }

  // 7b. Removing those loops must not cost the behaviour they carried:
  //     three pages grew the cursor on things that are neither links nor
  //     buttons. They declare those in data-cursor-targets now, and this
  //     proves the declaration is actually wired up.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const [file, sel] of [
      ["side-quests.html", ".gallery-item"],
      ["kala-topi.html", ".tension-card"],
      ["index.html", ".panel"],
    ]) {
      await page.goto(url(file));
      await page.waitForTimeout(400);
      const grew = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return "no such element";
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        return document.getElementById("cursor").classList.contains("grow");
      }, sel);
      check(`${file} still grows the cursor on ${sel}`, grew === true, String(grew));
    }
    await ctx.close();
  }

  // 8. Floorplan: the wordmark opens it as a modal, it marks the current
  //    room, closes on Escape, and returns focus.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);

    const mark = page.locator(".mark");
    check("wordmark is the plan trigger", (await mark.getAttribute("aria-controls")) === "floorplan");
    check("wordmark starts collapsed", (await mark.getAttribute("aria-expanded")) === "false");

    await mark.click();
    await page.waitForTimeout(300);

    check("plan opens as a modal dialog", await page.evaluate(() => {
      const d = document.getElementById("floorplan");
      return !!d && d.open && d.matches(":modal");
    }));
    check("wordmark reports expanded", (await mark.getAttribute("aria-expanded")) === "true");

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

    // The cursor icons moved off the old nav and onto the plan. If they
    // are not here they are nowhere.
    check("plan carries the cursor icons", await page.evaluate(() => {
      const keys = [...document.querySelectorAll(".plan__room[data-cursor], .plan__door[data-cursor]")]
        .map((a) => a.dataset.cursor);
      return keys.includes("pot") && keys.includes("monitor");
    }));

    // A modal dialog makes the rest of the page inert, which is the
    // focus trap — verify rather than assume.
    check("page behind is inert while open", await page.evaluate(() => {
      const outside = document.querySelector("main a, footer a, .mark");
      outside.focus();
      return document.activeElement !== outside;
    }));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape closes the plan", await page.evaluate(() => !document.getElementById("floorplan").open));
    check("focus returns to the wordmark", await page.evaluate(() =>
      document.activeElement.classList.contains("mark")
    ));
    check("wordmark reports collapsed again", (await mark.getAttribute("aria-expanded")) === "false");
    await ctx.close();
  }

  // 9. The plan is the only navigation, so it has to work on a phone —
  //    it used to be hidden below 768px.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.evaluate(() => localStorage.setItem("sh.mode", "workshop"));
    await page.reload();
    await page.waitForTimeout(300);

    await page.locator(".mark").click();
    await page.waitForTimeout(300);
    check("plan opens at 390px", await page.evaluate(() => document.getElementById("floorplan").open));

    check("rooms are reachable at 390px", await page.evaluate(() =>
      [...document.querySelectorAll(".plan__room")].every((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
    ));

    // Stacked, not the positioned drawing: each band spans the panel.
    check("rooms stack into bands at 390px", await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".plan__cell")];
      if (cells.length < 2) return false;
      const tops = cells.map((c) => Math.round(c.getBoundingClientRect().top));
      // Every band starts below the one before it.
      return tops.every((t, i) => i === 0 || t > tops[i - 1]);
    }));

    check("plan does not overflow the viewport at 390px", await page.evaluate(() => {
      const r = document.querySelector(".plan__inner").getBoundingClientRect();
      return r.left >= -1 && r.right <= innerWidth + 1;
    }));
    await ctx.close();
  }

  // 10. Editorial mode keeps the navigation, as a plain menu. Before
  //     Phase 3b it fell back to the top nav — which no longer exists,
  //     so an editorial visitor would otherwise be stranded.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);
    check("editorial mode still has a trigger", (await page.locator(".mark").count()) === 1);

    await page.locator(".mark").click();
    await page.waitForTimeout(300);
    check("editorial plan is a plain list", (await page.locator(".plan__list").count()) === 1);
    check("editorial plan has no drawing", (await page.locator(".plan__box").count()) === 0);
    check("editorial menu lists every room", (await page.locator(".plan__list-link").count()) === 5);
    await ctx.close();
  }

  // 11. The back chip: on case studies, pointing at the room that lists
  //     them, and nowhere else.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const [file, href] of [
      ["canti.html", "craft.html"],
      ["alastair-smith.html", "digital.html"],
      // Exhibition work used to point at craft.html, which does not
      // list it. Deriving the chip from the room fixed that.
      ["blend.html", "exhibitions.html"],
    ]) {
      await page.goto(url(file));
      await page.waitForTimeout(250);
      const got = await page.getAttribute(".back-chip", "href");
      check(`${file} has a back chip to ${href}`, got === href, "got " + got);
    }

    for (const file of ["craft.html", "index.html", "work.html", "about.html"]) {
      await page.goto(url(file));
      await page.waitForTimeout(250);
      check(`${file} has no back chip`, (await page.locator(".back-chip").count()) === 0);
    }
    await ctx.close();
  }

  // 12. The rail floats over arbitrary page imagery, so its scrim has to
  //     be heavier than the dialog panel's — the panel dims the whole page
  //     behind it first, the rail cannot. Measured over craft.html's pale
  //     clay card, the panel's own tint gives 2.06:1 on the wordmark; the
  //     rail scrim gives 5.68:1. This asserts the rule that buys that.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);

    const alpha = await page.evaluate(() => {
      const bg = getComputedStyle(document.querySelector(".mark")).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((n) => parseFloat(n));
      return parts.length > 3 ? parts[3] : 1;
    });
    check(
      "rail carries an opaque enough scrim for light imagery",
      alpha !== null && alpha >= 0.4,
      "wordmark background alpha " + alpha
    );

    // The back chip floats in the same place and needs the same treatment.
    await page.goto(url("canti.html"));
    await page.waitForTimeout(300);
    const chipAlpha = await page.evaluate(() => {
      const el = document.querySelector(".back-chip");
      if (!el) return null;
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      const parts = m[1].split(",").map((n) => parseFloat(n));
      return parts.length > 3 ? parts[3] : 1;
    });
    check("back chip carries the same scrim", chipAlpha !== null && chipAlpha >= 0.4,
      "chip background alpha " + chipAlpha);
    await ctx.close();
  }

  // 13. The entrance beacon: on index.html the rail is the plan glyph
  //     alone in the top-right corner while the hero is on screen — the
  //     hero already says the name — and gathers into the wordmark pill
  //     once the hero has scrolled away.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("index.html"));
    await page.waitForTimeout(400);

    const hero = await page.evaluate(() => {
      const rail = document.querySelector(".rail");
      const glyph = document.querySelector(".mark__glyph");
      return {
        beacon: rail.classList.contains("rail--beacon"),
        stuck: rail.classList.contains("is-stuck"),
        nameWidth: document.querySelector(".mark__name").getBoundingClientRect().width,
        glyphRight: glyph.getBoundingClientRect().right,
        cells: glyph.querySelectorAll("rect").length,
      };
    });
    check("index rail is the entrance beacon", hero.beacon);
    check("beacon starts unstuck over the hero", !hero.stuck);
    check("hero state hides the second wordmark", hero.nameWidth === 0, "width " + hero.nameWidth);
    check("hero glyph sits in the right-hand corner", hero.glyphRight > 1440 * 0.85,
      "right edge at " + Math.round(hero.glyphRight));
    // The glyph is drawn from PLAN, so it has exactly one cell per room.
    check("glyph has one cell per room", hero.cells === 5, hero.cells + " cells");

    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(900);
    const stuck = await page.evaluate(() => {
      const rail = document.querySelector(".rail");
      const mark = document.querySelector(".mark");
      const bg = getComputedStyle(mark).backgroundColor.match(/[\d.]+/g) || [];
      return {
        stuck: rail.classList.contains("is-stuck"),
        nameWidth: document.querySelector(".mark__name").getBoundingClientRect().width,
        alpha: bg.length > 3 ? parseFloat(bg[3]) : 1,
      };
    });
    check("beacon sticks once the hero has gone", stuck.stuck);
    check("scrolled state shows the wordmark", stuck.nameWidth > 40, "width " + stuck.nameWidth);
    check("scrolled state is glass", stuck.alpha >= 0.4, "alpha " + stuck.alpha);

    // Every other page keeps the ordinary rail.
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);
    check("other pages keep the ordinary rail", await page.evaluate(() =>
      !document.querySelector(".rail").classList.contains("rail--beacon") &&
      document.querySelector(".mark__name").getBoundingClientRect().width > 40
    ));
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
