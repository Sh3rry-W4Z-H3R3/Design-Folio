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

    const mark = page.locator(".plan-btn");
    check("the plan button is the trigger", (await mark.getAttribute("aria-controls")) === "floorplan");
    // The wordmark is identity and a way home, not a hidden menu.
    check("wordmark goes home rather than opening the plan", await page.evaluate(() => {
      const w = document.querySelector(".mark");
      return w.tagName === "A" && /index\.html$/.test(w.getAttribute("href")) &&
        !w.hasAttribute("aria-controls");
    }));
    // Reading order left to right: wordmark, contact, plan.
    check("rail reads wordmark, contact, plan", await page.evaluate(() =>
      [...document.querySelectorAll(".rail > *")]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .map((e) => e.className.split(" ")[0])
        .join(",").endsWith("mark,hail,plan-btn")
    ));
    // One height for the row, so it reads as a single object.
    check("wordmark and contact are the same height", await page.evaluate(() => {
      const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
      return h(".mark") === h(".hail") && h(".mark") === h(".plan-btn");
    }));
    check("wordmark starts collapsed", (await mark.getAttribute("aria-expanded")) === "false");

    await mark.click();
    await page.waitForTimeout(300);

    check("plan opens as a modal dialog", await page.evaluate(() => {
      const d = document.getElementById("floorplan");
      return !!d && d.open && d.matches(":modal");
    }));
    check("plan button reports expanded", (await mark.getAttribute("aria-expanded")) === "true");

    // craft.html is the physical room, so that room should be marked.
    check("current room is marked", await page.evaluate(() => {
      const cur = document.querySelector('.plan__room[aria-current="page"]');
      return !!cur && cur.dataset.planRoom === "physical";
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
      const outside = document.querySelector("main a, footer a, .plan-btn");
      outside.focus();
      return document.activeElement !== outside;
    }));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape closes the plan", await page.evaluate(() => !document.getElementById("floorplan").open));
    check("focus returns to the plan button", await page.evaluate(() =>
      document.activeElement.classList.contains("plan-btn")
    ));
    check("plan button reports collapsed again", (await mark.getAttribute("aria-expanded")) === "false");
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

    await page.locator(".plan-btn").click();
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
    check("editorial mode still has a trigger", (await page.locator(".plan-btn").count()) === 1);

    await page.locator(".plan-btn").click();
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
  //
  //     The scrim lives on the rail itself now rather than on each
  //     control, because the row is one glass container. That is asserted
  //     here too: four stacked backdrop-filters is what it replaced, and
  //     nothing in the row's markup stops a later change putting them
  //     back one control at a time.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);

    const alphaOf = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(",").map((n) => parseFloat(n));
      return parts.length > 3 ? parts[3] : 1;
    }, sel);

    const alpha = await alphaOf(".rail");
    check(
      "rail carries an opaque enough scrim for light imagery",
      alpha !== null && alpha >= 0.4,
      "rail background alpha " + alpha
    );

    check("the rail is one glass pane, not one per control", await page.evaluate(() => {
      const rail = document.querySelector(".rail");
      const blurred = [rail, ...rail.querySelectorAll("*")].filter((el) => {
        const f = getComputedStyle(el);
        const v = f.backdropFilter || f.webkitBackdropFilter;
        return v && v !== "none";
      });
      return blurred.length === 1 && blurred[0] === rail;
    }));

    // Everything in the row is a pill, so the wordmark and the contact
    // button agree on their radius rather than one being a rectangle.
    check("wordmark and contact share the pill shape", await page.evaluate(() => {
      const r = (s) => getComputedStyle(document.querySelector(s)).borderTopLeftRadius;
      return r(".mark") === r(".hail") && parseFloat(r(".mark")) >= 16;
    }));

    // The back chip floats in the same row and rides the same pane.
    await page.goto(url("canti.html"));
    await page.waitForTimeout(300);
    const chipAlpha = await alphaOf(".rail");
    check("back chip rides the same scrim", chipAlpha !== null && chipAlpha >= 0.4,
      "rail background alpha " + chipAlpha);
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
      const glyph = document.querySelector(".plan-btn__glyph");
      return {
        beacon: rail.classList.contains("rail--beacon"),
        stuck: rail.classList.contains("is-stuck"),
        /* display:none rather than opacity:0 now: with the glass on the
           row itself, two invisible-but-present controls would hold open
           an empty pill the width of the name. */
        nameWidth: getComputedStyle(document.querySelector(".mark")).display === "none"
          ? 0
          : document.querySelector(".mark").getBoundingClientRect().width,
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
      const bg = getComputedStyle(rail).backgroundColor.match(/[\d.]+/g) || [];
      const mk = document.querySelector(".mark");
      return {
        stuck: rail.classList.contains("is-stuck"),
        nameWidth: getComputedStyle(mk).display === "none" ? 0 : mk.getBoundingClientRect().width,
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

  // 14. Every room actually wears its own accent.
  //
  //     side-quests.html carried data-room="play" and then overrode
  //     --accent to the digital pink in its own :root, so the Play room
  //     had never once been gold. about.html and contact.html declared no
  //     room at all. Nothing looked broken — a page with a consistent
  //     wrong accent looks designed — which is exactly why it needs
  //     asserting rather than eyeballing.
  {
    const ROOMS = {
      "craft.html": ["physical", "#6dbf9e"],
      "digital.html": ["digital", "#e8547a"],
      "exhibitions.html": ["exhibition", "#276048"],
      "side-quests.html": ["play", "#c8b882"],
      "about.html": ["office", "#f0919f"],
      "contact.html": ["office", "#f0919f"],
    };
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const [file, [room, accent]] of Object.entries(ROOMS)) {
      await page.goto(url(file));
      await page.waitForTimeout(200);
      const got = await page.evaluate(() => {
        const d = document.documentElement;
        return {
          room: d.getAttribute("data-room"),
          accent: getComputedStyle(d).getPropertyValue("--accent").trim().toLowerCase(),
        };
      });
      check(`${file} declares its room`, got.room === room, "got " + got.room);
      check(`${file} wears the ${room} accent`, got.accent === accent,
        "expected " + accent + ", got " + got.accent);
    }
    await ctx.close();
  }

  // 15. The contact pill is the one thing on the page asking to be
  //      pressed, so it is filled rather than more glass — and the fill
  //      has to carry legible text in every room, including the light one.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const file of ["craft.html", "exhibitions.html", "side-quests.html"]) {
      await page.goto(url(file));
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const el = document.querySelector(".hail");
        if (!el) return null;
        const cs = getComputedStyle(el);
        const lum = (c) => {
          const m = (c.match(/[\d.]+/g) || []).map(Number);
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
        };
        const bg = lum(cs.backgroundColor), fg = lum(cs.color);
        return {
          filled: !/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor),
          ratio: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05),
        };
      });
      check(`${file} contact pill is filled, not glass`, r !== null && r.filled);
      // The pill keeps one colour in every room precisely so it stays
      // recognisable, so this must hold on the light room too.
      check(`${file} contact pill text passes AA`, r !== null && r.ratio >= 4.5,
        r ? r.ratio.toFixed(2) + ":1" : "no pill");
    }
    await ctx.close();
  }

  // 16. The doors sit over the rooms they open into. That is the whole
  //      claim the drawing makes — that a plan tells you where a door
  //      leads before you read anything — and it is a claim about
  //      coordinates, which nobody re-checks by eye after moving a wall.
  //      The facade also has to be the TOP band: with it along the bottom
  //      the two doors sat as far from their own rooms as the sheet
  //      allowed, which is what this replaced.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.locator(".plan-btn").click();
    await page.waitForTimeout(400);

    const geo = await page.evaluate(() => {
      const box = (s) => {
        const el = document.querySelector(s);
        return el ? el.getBoundingClientRect() : null;
      };
      const facade = box(".plan__facade");
      const rooms = box(".plan__rooms");
      const pair = [...document.querySelectorAll(".plan__door")].map((d) => {
        const r = d.getBoundingClientRect();
        const room = document.querySelector(
          '.plan__room[data-plan-room="' + d.dataset.planRoom + '"]'
        );
        const rr = room ? room.getBoundingClientRect() : null;
        return {
          id: d.dataset.planRoom,
          over: !!rr && r.left >= rr.left - 1 && r.right <= rr.right + 1,
          above: !!rr && r.bottom <= rr.top + 2,
        };
      });
      return { facadeTop: facade && facade.top, roomsTop: rooms && rooms.top, pair };
    });

    check("the facade is the top band", geo.facadeTop !== null && geo.roomsTop !== null &&
      geo.facadeTop < geo.roomsTop, `facade ${Math.round(geo.facadeTop)}, rooms ${Math.round(geo.roomsTop)}`);
    check("there are two doors", geo.pair.length === 2, geo.pair.length + " doors");
    for (const d of geo.pair) {
      check(`the ${d.id} door stands over the ${d.id} room`, d.over);
      check(`the ${d.id} door stands above it, not in it`, d.above);
    }
    await ctx.close();
  }

  // 17. Room tokens are keyed on a bare [data-room], so ANY element
  //      carrying that attribute switches the whole set for its subtree.
  //      The plan's links used to carry it, and the exhibition cell drew
  //      its name in the light room's near-black on the dark glass panel:
  //      the title had not gone missing, it was painted in the gallery's
  //      ink on the workshop's wall. They carry data-plan-room now. This
  //      asserts the outcome — every room name legible — rather than the
  //      attribute, so it still holds if the mechanism changes again.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // Once from a dark room and once from the light one: the panel and
    // its scrim have to be lit the same way in both, and the exhibition
    // page is where they were not.
    for (const file of ["craft.html", "exhibitions.html"]) {
      await page.goto(url(file));
      await page.locator(".plan-btn").click();
      await page.waitForTimeout(400);
      const worst = await page.evaluate(() => {
        const rgba = (c) => {
          const m = (c.match(/[\d.]+/g) || []).map(Number);
          return [m[0] || 0, m[1] || 0, m[2] || 0, m.length > 3 ? m[3] : 1];
        };
        const over = (top, bottom) => {
          const a = top[3];
          return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
        };
        const lum = (c) => {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        /* The real ground under a room name is three translucent layers:
           the page, the dialog's ::backdrop over it, and the panel's own
           tint over that. Reading the body's colour alone would have
           called the light room legible while its panel was in fact dark
           — which is exactly the bug this is here to catch. */
        const dlg = document.querySelector(".plan");
        const page_ = rgba(getComputedStyle(document.body).backgroundColor);
        const back = rgba(getComputedStyle(dlg, "::backdrop").backgroundColor);
        const pane = rgba(getComputedStyle(document.querySelector(".plan__inner")).backgroundColor);
        const scrim = lum(over(pane, over(back, page_)));
        let low = Infinity, who = "";
        document.querySelectorAll(".plan__room-name").forEach((n) => {
          const fg = lum(rgba(getComputedStyle(n).color));
          const ratio = (Math.max(scrim, fg) + 0.05) / (Math.min(scrim, fg) + 0.05);
          if (ratio < low) { low = ratio; who = n.textContent; }
        });
        return { low, who, seen: document.querySelectorAll(".plan__room-name").length };
      });
      /* `seen` is checked as well as the ratio. The first version of this
         handed a colour STRING to a luminance function expecting a
         triple, which made every ratio NaN — and NaN < Infinity is false,
         so `low` stayed Infinity and the check passed against two
         deliberately broken builds. A comparison that no measurement can
         lose is not a check. */
      check(`${file}: every room name reads on the plan`,
        worst.seen === 5 && Number.isFinite(worst.low) && worst.low >= 4.5,
        `${worst.seen} names, worst ${worst.who} at ${worst.low.toFixed(2)}:1`);
      await page.keyboard.press("Escape");
    }
    await ctx.close();
  }

  // 18. showModal() promotes the dialog into the top layer, which paints
  //      above every z-index on the page — including the custom cursor's
  //      9999. The dot never stopped tracking; it was behind the overlay,
  //      so the plan was the one screen on the site with no pointer of its
  //      own, and the system hand was all that showed.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(200);

    check("the cursor starts on the body", await page.evaluate(() =>
      document.getElementById("cursor").parentElement === document.body));

    await page.locator(".plan-btn").click();
    await page.waitForTimeout(400);
    check("the cursor joins the dialog in the top layer", await page.evaluate(() => {
      const dot = document.getElementById("cursor");
      const dlg = document.querySelector(".plan");
      return dot.parentElement === dlg && getComputedStyle(dot).display !== "none";
    }));

    // And the system hand stays hidden in there, which is what made the
    // absence obvious: the browser gives links their own cursor, and an
    // inherited `cursor: none` on body loses to it.
    check("the plan's rooms show no system cursor", await page.evaluate(() =>
      [...document.querySelectorAll(".plan__room, .plan__door")]
        .every((a) => getComputedStyle(a).cursor === "none")));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("the cursor goes back to the body on close", await page.evaluate(() =>
      document.getElementById("cursor").parentElement === document.body));
    await ctx.close();
  }

  // 19. Below 768px the pages hide the custom cursor. base.css suppresses
  //      the system one by pointer type, which does not follow width — so
  //      a laptop window dragged under 768px had NO pointer at all. Both
  //      halves of that decision live in chrome.css now. Asserted as
  //      "something is pointing", not as which rule does it.
  {
    const ctx = await browser.newContext({ viewport: { width: 700, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url("craft.html"));
    await page.waitForTimeout(300);
    check("a narrow window still has a pointer", await page.evaluate(() => {
      const dot = document.getElementById("cursor");
      const custom = dot && getComputedStyle(dot).display !== "none";
      const system = getComputedStyle(document.body).cursor !== "none";
      // Exactly one of them, or the page has two pointers or none.
      return custom !== system;
    }));
    await ctx.close();
  }

  // 20. THE CASE STUDY SPINE (Edward Wairumbi's review).
  //      Six beats, in order, and the order is the whole point: the
  //      block this replaced named its four beats Problem, Insight,
  //      Design Intent and Outcome, which say what KIND of thing each
  //      card is but never why the next one had to happen.
  //
  //      Beats declare themselves with data-case-beat rather than by
  //      class, so a page with its own component for a beat — Kala
  //      Topi's tensions, Tarebook's mid-build pivot — still takes part
  //      in the spine instead of being flattened into identical markup.
  {
    /* All eighteen case studies. Listed rather than globbed: a page that
       silently stops carrying the spine should fail here, and a glob over
       whatever happens to be on disk would just stop checking it. */
    const SPINE = [
      "alastair-smith.html", "andras.html", "blend.html", "canti.html",
      "cherry-vision.html", "clydeside.html", "crafted-by-design.html",
      "cycle-arts.html", "graduate-in-residence.html", "greene-king.html",
      "just-rite.html", "kala-topi.html", "multanni.html", "origin.html",
      "sim-glasgow.html", "tarebook.html", "thudpuk.html", "westgarth.html",
    ];
    const ORDER = ["ps", "hard", "turn", "landed", "unblocked"];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    for (const file of SPINE) {
      await page.goto(url(file));
      await page.waitForTimeout(250);

      const got = await page.evaluate(() => {
        const beats = [...document.querySelectorAll("[data-case-beat]")];
        const ps = document.querySelector('[data-case-beat="ps"]');
        /* Four hero shapes across the eighteen: .hero, .project-hero, a
           bare <header>, and westgarth's <main class="quick">. Naming
           them beats a positional guess, and a page that grows a fifth
           should fail here rather than be quietly skipped. */
        const hero = document.querySelector(".hero, .project-hero, header, main.quick");
        // "Directly under the hero" means: before any body section or
        // full-bleed image. The old block was buried below the fold on
        // two of the six pages that had it — placement is what rots.
        // Prose sections only. A full-bleed image between the hero and
        // the pair is hero furniture — the hook, then the claim — and
        // counting it as "body" would fail pages that are doing the
        // right thing. What must not come first is an argument.
        const firstBody = document.querySelector(
          ".case-section, .premise, .tensions, [data-case-beat='hard']"
        );
        const pos = (a, b) =>
          a && b ? a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING : false;
        const words = (sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent.trim().split(/\s+/).length : -1;
        };
        return {
          order: beats.map((b) => b.getAttribute("data-case-beat")),
          psCount: document.querySelectorAll('[data-case-beat="ps"]').length,
          afterHero: pos(hero, ps),
          beforeBody: pos(ps, firstBody),
          problem: words(".case-ps__cell--problem .case-ps__text"),
          solution: words(".case-ps__cell--solution .case-ps__text"),
          // DOM order is necessary but not sufficient: a page could put
          // the pair first and still bury it under two screens of hero.
          // Measured, not proxied.
          screensDown: ps ? (ps.getBoundingClientRect().top + scrollY) / innerHeight : 99,
        };
      });

      check(`${file} carries exactly one problem/solution pair`, got.psCount === 1,
        got.psCount + " found");
      check(`${file} states it before any argument`,
        got.afterHero && got.beforeBody,
        `afterHero ${got.afterHero}, beforeBody ${got.beforeBody}`);
      /* Two screens. Edward's note was "START with problem and solution
         statements" — a pair a reviewer has to hunt for is not a start.
         Tarebook originally sat at 1.97 screens behind its full-bleed
         hero image, which passed this rule while plainly failing its
         intent, so the pair was moved above that image rather than the
         threshold being moved above the pair. */
      check(`${file} states it within two screens`, got.screensDown <= 2,
        got.screensDown.toFixed(2) + " screens down");
      /* One sentence each. Edward asked for a SIMPLE problem and
         solution statement; the cards this replaced ran about eighty
         words apiece, which is an essay where a claim was wanted. */
      check(`${file} problem is one sentence`, got.problem > 0 && got.problem <= 30,
        got.problem + " words");
      check(`${file} solution is one sentence`, got.solution > 0 && got.solution <= 30,
        got.solution + " words");
      /* The order check is what enforces "revisit the journey before
         showcasing the final works" mechanically rather than by memory:
         landed cannot precede turn. */
      const seen = got.order.filter((b) => ORDER.includes(b));
      const ranks = seen.map((b) => ORDER.indexOf(b));
      check(`${file} runs its beats in order`,
        seen.length === 5 && ranks.every((r, i) => i === 0 || r > ranks[i - 1]),
        seen.join(" → "));
    }
    await ctx.close();
  }

  // 21. The spine is shared CSS reading room tokens, NOT the inline
  //      copies it replaced. Those hardcoded `background: #0e0e0e` in
  //      six separate pages, and Cycle Arts is in the EXHIBITION room,
  //      which is light — a dark panel there is invisible on invisible.
  //      Measured in the light room and a dark one.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // One page per room: physical, the light exhibition room, digital,
    // office-adjacent and play all resolve different token sets, and the
    // light room is where a hardcoded dark panel would hide.
    for (const file of ["canti.html", "cycle-arts.html", "tarebook.html",
                        "crafted-by-design.html", "clydeside.html"]) {
      await page.goto(url(file));
      await page.waitForTimeout(250);
      const worst = await page.evaluate(() => {
        const rgba = (c) => {
          const m = (c.match(/[\d.]+/g) || []).map(Number);
          return [m[0] || 0, m[1] || 0, m[2] || 0, m.length > 3 ? m[3] : 1];
        };
        const over = (t, b) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
        const lum = (c) => {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const pageBg = rgba(getComputedStyle(document.body).backgroundColor);
        let low = Infinity, who = "", seen = 0;
        document.querySelectorAll("[data-case-beat]").forEach((beat) => {
          beat.querySelectorAll("p, h2, span").forEach((el) => {
            if (!el.textContent.trim()) return;
            // Composite the element's own ground over the page's.
            let ground = pageBg, node = el;
            while (node && node !== document.body) {
              const bg = rgba(getComputedStyle(node).backgroundColor);
              if (bg[3] > 0) { ground = over(bg, pageBg); break; }
              node = node.parentElement;
            }
            const ratio = (Math.max(lum(ground), lum(rgba(getComputedStyle(el).color))) + 0.05) /
              (Math.min(lum(ground), lum(rgba(getComputedStyle(el).color))) + 0.05);
            seen++;
            if (ratio < low) { low = ratio; who = el.textContent.trim().slice(0, 32); }
          });
        });
        return { low, who, seen };
      });
      check(`${file}: every spine beat reads on its ground`,
        worst.seen > 10 && Number.isFinite(worst.low) && worst.low >= 4.5,
        `${worst.seen} elements, worst "${worst.who}" at ${worst.low.toFixed(2)}:1`);
    }
    await ctx.close();
  }

  // 22. THE CONE — the spine's one piece of motion.
  //      The check that matters is not that it animates. It is that the
  //      page is READABLE WITHOUT IT. Every rule that hides a beat is
  //      gated behind a class only case.js sets, so no-JS, reduced
  //      motion and editorial mode all get plain text. Get that
  //      backwards and the site's first frame is empty, waiting on an
  //      observer that may never run — which is the single most common
  //      way a scroll reveal ships broken.
  {
    // (a) JavaScript off entirely.
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    });
    const page = await ctx.newPage();
    await page.goto(url("canti.html"));
    await page.waitForTimeout(200);
    const noJs = await page.$$eval("[data-case-beat] p, [data-case-beat] h2", (els) =>
      els.filter((e) => e.textContent.trim())
         .map((e) => parseFloat(getComputedStyle(e).opacity))
    );
    check("with JS off every beat is still readable",
      noJs.length > 6 && noJs.every((o) => o > 0.9),
      `${noJs.length} elements, min opacity ${Math.min(...noJs)}`);
    await ctx.close();
  }
  {
    // (b) Reduced motion: the script bails, nothing is hidden, no rail.
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(url("canti.html"));
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
      fx: document.documentElement.classList.contains("case-fx"),
      rail: !!document.querySelector(".case-rail"),
      min: Math.min(...[...document.querySelectorAll("[data-case-beat] p, [data-case-beat] h2")]
        .filter((e) => e.textContent.trim())
        .map((e) => parseFloat(getComputedStyle(e).opacity))),
    }));
    check("reduced motion leaves the spine alone", !r.fx && !r.rail && r.min > 0.9,
      `fx ${r.fx}, rail ${r.rail}, min opacity ${r.min}`);
    await ctx.close();
  }
  {
    // (c) Workshop: the rail exists, and anything already on screen is
    //     lit at load rather than fading in under a reader who is
    //     already looking at it.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    /* Sample every frame from before the document runs. Reading the
       settled state instead is what the first version of this check did,
       and it could not fail: by the time it looked, the observer had lit
       everything in view regardless of whether the boot pass existed.
       The fault being tested is a DIP — text painted, then animated away
       and back — so the measurement has to be the minimum across frames,
       not the value at the end. */
    await page.addInitScript(() => {
      window.__dip = 1;
      addEventListener("DOMContentLoaded", () => {
        let n = 0;
        (function sample() {
          const el = document.querySelector("[data-case-beat] .case-ps__text");
          if (el && el.getBoundingClientRect().top < innerHeight) {
            window.__dip = Math.min(window.__dip, parseFloat(getComputedStyle(el).opacity));
          }
          if (++n < 40) requestAnimationFrame(sample);
        })();
      });
    });

    await page.goto(url("westgarth.html"));
    await page.waitForTimeout(700);
    const boot = await page.evaluate(() => {
      const inView = [...document.querySelectorAll("[data-case-beat]")]
        .filter((b) => b.getBoundingClientRect().top < innerHeight * 0.9);
      return {
        fx: document.documentElement.classList.contains("case-fx"),
        rail: !!document.querySelector(".case-rail"),
        booted: !document.documentElement.classList.contains("case-fx-boot"),
        inView: inView.length,
        allLit: inView.every((b) => b.classList.contains("is-lit")),
      };
    });
    check("workshop arms the cone", boot.fx && boot.rail);
    check("the boot guard is released", boot.booted);
    check("beats already on screen are lit at load", boot.inView > 0 && boot.allLit,
      `${boot.inView} in view`);
    const dip = await page.evaluate(() => window.__dip);
    check("an in-view beat never fades in under the reader", dip > 0.9,
      "min opacity across the first 40 frames: " + dip);

    // (d) The fire reads scroll position.
    const before = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector(".case-rail__fire")).height));
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight * 0.6));
    await page.waitForTimeout(300);
    const after = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector(".case-rail__fire")).height));
    check("the fire tracks the scroll", before < 5 && after > 100,
      `${before}px -> ${after}px`);
    await ctx.close();
  }

  // 23. THE LIGHT ROOM, AFTER THE "TOO WHITE" REPORT.
  //      Three properties, each one a thing that was wrong.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url("exhibitions.html"));
    await page.waitForTimeout(300);

    const lum = (c) => {
      const [r, g, b] = (c.match(/\d+/g) || []).slice(0, 3).map(Number);
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

    const tok = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const hex = (n) => {
        const el = document.createElement("span");
        el.style.color = cs.getPropertyValue(n).trim();
        document.body.appendChild(el);
        const c = getComputedStyle(el).color;
        el.remove();
        return c;
      };
      return { bg: hex("--bg"), fg: hex("--fg"), accent: hex("--accent"),
               surface: hex("--surface"), surface2: hex("--surface-2"),
               line: hex("--line") };
    });

    /* (a) The panels must be DARKER than the wall. They were lighter —
       #fbf8f2 sitting on #f2ece1 — which is what made the room read as a
       white-out: every surface within a few percent of every other. */
    check("the light room's panels sit darker than its wall",
      lum(tok.surface) < lum(tok.bg) && lum(tok.surface2) < lum(tok.surface),
      `bg ${tok.bg}, surface ${tok.surface}, surface-2 ${tok.surface2}`);

    /* (b) The accent has to carry text on all three of this room's
       grounds. --mint is 1.86:1 here, which is why the room gets a
       deepened green of its own rather than borrowing the palette's. */
    for (const [name, ground] of [["wall", tok.bg], ["surface", tok.surface], ["surface-2", tok.surface2]]) {
      const r = ratio(tok.accent, ground);
      check(`the light room's accent reads on its ${name}`, r >= 4.5, r.toFixed(2) + ":1");
    }

    /* (c) The hairlines have to be visible against the wall, or the
       structure disappears and everything floats. */
    check("the light room's hairlines are visible",
      ratio(tok.line, tok.bg) >= 1.4, ratio(tok.line, tok.bg).toFixed(2) + ":1");
    await ctx.close();
  }

  // 24. THE CHROME IS THE SAME OBJECT IN EVERY ROOM.
  //      The rail and the floorplan used to invert with the exhibition
  //      room, which gave that one page a pale nav on a pale ground. A
  //      visitor learns the navigation once; it should not change
  //      identity underneath them when they walk into a different room.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const seen = {};
    for (const file of ["craft.html", "exhibitions.html", "cycle-arts.html", "digital.html"]) {
      await page.goto(url(file));
      await page.waitForTimeout(300);
      seen[file] = await page.evaluate(() => {
        const rail = document.querySelector(".rail");
        const mark = document.querySelector(".mark__name");
        return {
          rail: getComputedStyle(rail).backgroundColor,
          fg: getComputedStyle(mark).color,
        };
      });
    }
    const vals = Object.values(seen);
    check("every page paints the rail the same", vals.every((v) => v.rail === vals[0].rail),
      Object.entries(seen).map(([f, v]) => `${f} ${v.rail}`).join(" | "));
    check("every page paints the wordmark the same", vals.every((v) => v.fg === vals[0].fg),
      Object.entries(seen).map(([f, v]) => `${f} ${v.fg}`).join(" | "));

    /* And it has to actually be dark once composited over a light page,
       not merely declared dark. A 55% black veil reads near-black over a
       dark ground and mid-grey over cream — same rule, two different
       objects, which is exactly what was reported. */
    await page.goto(url("exhibitions.html"));
    await page.waitForTimeout(300);
    const composited = await page.evaluate(() => {
      const rgba = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const rail = rgba(getComputedStyle(document.querySelector(".rail")).backgroundColor);
      const page_ = rgba(getComputedStyle(document.body).backgroundColor);
      const a = rail.length > 3 ? rail[3] : 1;
      return [0, 1, 2].map((i) => Math.round(rail[i] * a + page_[i] * (1 - a)));
    });
    check("the rail is still dark once composited over the light room",
      Math.max(...composited) < 70, "rgb(" + composited.join(", ") + ")");
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
