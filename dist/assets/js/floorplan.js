/* ─── FLOORPLAN NAVIGATION ───────────────────────────────────────────
   The workshop's plan IS the site's navigation. There is no nav bar in a
   workshop — there is a building you move through.

   Three decisions worth knowing before changing anything here:

   1. The rooms are REAL LINKS positioned as rectangles — not an SVG
      drawing with a hidden list underneath. One set of elements is both
      the picture and the semantics, so keyboard order, focus, hit areas
      and screen-reader output all come out right by construction
      instead of having to be kept in sync with a decorative layer.

   2. The plan is a <dialog> opened with showModal(), which gives focus
      trapping, Escape, inertness of the page behind, and the top layer
      for free. Hand-rolling those is how nav overlays end up subtly
      broken for keyboard users.

   3. It renders in BOTH modes, because it is now the only navigation the
      pages carry. In workshop mode it is the drawing; in editorial mode
      the same dialog renders as a plain menu, since a hurried hiring
      manager has explicitly opted out of the tour — but not out of
      being able to get around.

   PLAN below is the only thing that needs to change when Sherjeel's
   sketch arrives: coordinates are percentages of the plan box, so the
   geometry can be redrawn without touching any behaviour.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var root = document.documentElement;
  var workshop = root.getAttribute("data-mode") === "workshop";

  /* Placeholder geometry — a building read from the front.
     Top: the facade the visitor arrives at, with its two doors. Below it,
     the two rooms those doors open into. Bottom band: the smaller rooms.

     The doors sit directly above the rooms they lead to, which is the
     whole point of drawing a plan rather than listing links — the left
     door is over Industrial, the right one over Digital, so the drawing
     says where each one goes before anything is read. */
  var PLAN = {
    rooms: [
      {
        id: "physical",
        name: "Industrial",
        sub: "Physical & making",
        href: "craft.html",
        x: 0, y: 0, w: 54, h: 60,
        size: "main",
        cursor: "pot",
      },
      {
        id: "digital",
        name: "Digital",
        sub: "UI, web & brand",
        href: "digital.html",
        x: 54, y: 0, w: 46, h: 60,
        size: "main",
        cursor: "monitor",
      },
      {
        id: "exhibition",
        name: "Exhibition",
        sub: "Shows & installs",
        href: "exhibitions.html",
        x: 0, y: 60, w: 34, h: 40,
      },
      {
        id: "play",
        name: "Play",
        sub: "Side quests",
        href: "side-quests.html",
        x: 34, y: 60, w: 32, h: 40,
      },
      {
        id: "office",
        name: "Office",
        sub: "About & contact",
        href: "about.html",
        x: 66, y: 60, w: 34, h: 40,
      },
    ],
    // The facade strip, with the two doors cut into it.
    doors: [
      { room: "physical", label: "Physical door", href: "craft.html", x: 16, w: 16, cursor: "pot" },
      { room: "digital", label: "Digital door", href: "digital.html", x: 68, w: 16, cursor: "monitor" },
    ],
    entrance: { name: "Front of shop", href: "index.html" },
    index: { name: "Every project", href: "work.html" },
  };

  // The page's room, so the plan can show where the visitor is standing.
  var here = root.getAttribute("data-room");

  // Which room a page belongs to when it has no data-room of its own.
  var CURRENT_BY_PAGE = {
    "about.html": "office",
    "contact.html": "office",
  };
  var page = location.pathname.split("/").pop() || "index.html";
  var current = here || CURRENT_BY_PAGE[page] || null;

  /* Pages that ARE a room rather than sitting inside one. Everything else
     carrying a data-room is a case study, and gets a back chip pointing
     at the room that lists it.

     Deriving the back link from the room — rather than from the old
     .nav__back markup — corrects three pages: blend, cherry-vision and
     crafted-by-design are exhibition work but their old back link went to
     craft.html, which does not list them. */
  var ROOM_PAGES = {};
  PLAN.rooms.forEach(function (r) { ROOM_PAGES[r.href] = r; });
  ROOM_PAGES["contact.html"] = ROOM_PAGES["about.html"];
  ROOM_PAGES[PLAN.entrance.href] = null;
  ROOM_PAGES[PLAN.index.href] = null;

  function roomById(id) {
    for (var i = 0; i < PLAN.rooms.length; i++) {
      if (PLAN.rooms[i].id === id) return PLAN.rooms[i];
    }
    return null;
  }

  // A case study is a page with a room that is not itself a room page.
  var parent = null;
  if (current && !Object.prototype.hasOwnProperty.call(ROOM_PAGES, page)) {
    parent = roomById(current);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* Percentages go on as custom properties rather than as `left`/`top`
     directly. An inline `left` can only be beaten with !important, but a
     custom property is just a value the stylesheet may choose to use —
     which is what lets the narrow-screen rules restack the rooms without
     fighting the geometry. */
  function place(node, box) {
    node.style.setProperty("--x", box.x + "%");
    if (box.y != null) node.style.setProperty("--y", box.y + "%");
    node.style.setProperty("--w", box.w + "%");
    if (box.h != null) node.style.setProperty("--h", box.h + "%");
  }

  /* Every element in here that stands for a room carries data-PLAN-room,
     not data-room. They are two different statements: data-room on <html>
     says "this page is in that room" and switches the whole token set;
     data-plan-room says "this link leads there" and must not.

     The distinction was learned the hard way. rooms.css matches on a bare
     [data-room="exhibition"], so a plan link carrying data-room turned the
     light room's tokens on for its own subtree — and the Exhibition cell
     drew its name in #1a1815 on the dark glass panel. The title had not
     gone missing; it was being painted in the gallery's ink on the
     workshop's wall. */
  function drawing() {
    var box = el("div", "plan__box");
    var list = el("ul", "plan__rooms");

    PLAN.rooms.forEach(function (r) {
      var li = el("li", "plan__cell" + (r.size === "main" ? " plan__cell--main" : ""));
      place(li, r);

      var a = el("a", "plan__room");
      a.href = r.href;
      a.dataset.planRoom = r.id;
      // The monitor/pot cursor icons used to live on the top nav's links.
      // With the nav gone they live here, where they are arguably more at
      // home: hovering the room shows the room's tool.
      if (r.cursor) a.dataset.cursor = r.cursor;
      a.appendChild(el("span", "plan__room-name", r.name));
      a.appendChild(el("span", "plan__room-sub", r.sub));

      if (r.id === current) {
        a.setAttribute("aria-current", "page");
        var youAreHere = el("span", "plan__here");
        youAreHere.appendChild(el("span", "plan__here-dot"));
        youAreHere.appendChild(el("span", "plan__here-label", "You are here"));
        a.appendChild(youAreHere);
      }

      li.appendChild(a);
      list.appendChild(li);
    });

    // Facade strip across the top, with the two doors cut into it, each
    // sitting directly above the room it opens into. Decorative
    // duplication of the two main rooms, so narrow screens drop it
    // rather than repeating those links in the stack.
    var facade = el("div", "plan__facade");
    facade.setAttribute("aria-hidden", "true");
    facade.appendChild(el("span", "plan__facade-sign", "Sherjeel Hussain"));
    PLAN.doors.forEach(function (d) {
      var a = el("a", "plan__door");
      a.href = d.href;
      // Each door carries the colour of the room it opens into, not the
      // room the visitor happens to be standing in.
      a.dataset.planRoom = d.room;
      if (d.cursor) a.dataset.cursor = d.cursor;
      // The facade is aria-hidden, so these links must leave the tab
      // order too — a focusable element inside aria-hidden content is an
      // accessibility fault, and the rooms above already carry them.
      a.tabIndex = -1;
      place(a, d);
      a.appendChild(el("span", "sr-only", d.label));
      facade.appendChild(a);
    });
    // Appended first, because it is drawn first: source order and reading
    // order agree, so the next person to open this file is not misled.
    box.appendChild(facade);
    box.appendChild(list);
    return box;
  }

  /* Editorial mode: the same rooms, as an ordinary menu. No drawing, no
     doors, no "you are here" pulse — the fast version of the same map. */
  function menu() {
    var list = el("ul", "plan__list");
    PLAN.rooms.forEach(function (r) {
      var li = el("li");
      var a = el("a", "plan__list-link");
      a.href = r.href;
      a.dataset.planRoom = r.id;
      a.appendChild(el("span", "plan__room-name", r.name));
      a.appendChild(el("span", "plan__room-sub", r.sub));
      if (r.id === current) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      list.appendChild(li);
    });
    return list;
  }

  function build() {
    var dlg = el("dialog", "plan");
    dlg.id = "floorplan";
    dlg.setAttribute("aria-label", workshop ? "Workshop floorplan" : "Site navigation");

    var inner = el("div", "plan__inner glass");

    var head = el("div", "plan__head");
    head.appendChild(el("p", "plan__eyebrow", workshop ? "The workshop" : "Go to"));
    var close = el("button", "plan__close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "<span></span><span></span>";
    head.appendChild(close);
    inner.appendChild(head);

    inner.appendChild(workshop ? drawing() : menu());

    // Everything the plan can't hold as a room.
    var extra = el("div", "plan__extra");
    [PLAN.entrance, PLAN.index].forEach(function (link) {
      var a = el("a", "plan__extra-link", link.name);
      a.href = link.href;
      extra.appendChild(a);
    });
    inner.appendChild(extra);

    dlg.appendChild(inner);
    document.body.appendChild(dlg);

    // showModal() handles Escape and focus trapping; this only needs to
    // deal with the backdrop click, which the platform does not. The
    // dialog fills the viewport, so "clicked the backdrop" is a click
    // that landed on the dialog itself rather than on its panel.
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
    close.addEventListener("click", function () {
      dlg.close();
    });

    return dlg;
  }

  /* The mark's plan glyph, drawn from PLAN rather than hand-lettered as a
     path. It is the same building as the dialog, one twentieth the size,
     so the two cannot drift apart when the geometry is redrawn — and each
     cell carries its data-plan-room, which is what lets it light in its own
     room's colour.

     Percentages map straight onto a 100x100 viewBox, so no arithmetic is
     needed to keep them in step. */
  function glyph() {
    var cells = PLAN.rooms.map(function (r) {
      return (
        '<rect data-plan-room="' + r.id + '"' +
        ' x="' + r.x + '" y="' + r.y + '"' +
        ' width="' + r.w + '" height="' + r.h + '"' +
        ' vector-effect="non-scaling-stroke"><title>' + r.name + "</title></rect>"
      );
    });
    return (
      '<svg class="plan-btn__glyph" viewBox="-2 -2 104 104" aria-hidden="true" focusable="false">' +
      cells.join("") +
      "</svg>"
    );
  }

  /* The floating rail, reading left to right: the wordmark, quick
     contact, and the plan. Three separate controls rather than a wordmark
     that secretly opens a menu — the name is identity and goes home, the
     plan glyph is navigation and says so by being a drawing of the
     building. On a case study a back chip leads the row. */
  function rail(dlg) {
    /* One glass container, not four. Each control used to carry .glass of
       its own, which meant four stacked backdrop-filters — and blur over
       blur over blur reads as smear rather than as glass. The row is one
       object now: the shell is the glass, and the controls sit inside it. */
    var bar = el("div", "rail glass");

    /* ── back to the room, on case studies ───────────────── */
    if (parent) {
      var chip = el("a", "back-chip");
      chip.href = parent.href;
      chip.dataset.planRoom = parent.id;
      chip.innerHTML =
        '<svg class="back-chip__arrow" viewBox="0 0 12 9" aria-hidden="true" focusable="false">' +
        '<path d="M11.5 4.5H1M4.5 1 1 4.5 4.5 8" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
        "</svg>";
      chip.appendChild(el("span", null, parent.name));
      // The label is hidden on narrow screens and the arrow carries no
      // text, so the chip needs a name of its own.
      chip.setAttribute("aria-label", "Back to " + parent.name);
      bar.appendChild(chip);
    }

    /* ── the wordmark ────────────────────────────────────── */
    var mark = el("a", "mark");
    mark.href = PLAN.entrance.href;
    mark.innerHTML = '<span class="mark__name">Sherjeel <em>Hussain</em></span>';
    mark.setAttribute("aria-label", "Sherjeel Hussain — front of shop");
    bar.appendChild(mark);

    /* ── quick contact ───────────────────────────────────── */
    if (page !== "contact.html") {
      var say = el("a", "hail");
      say.href = "contact.html";
      say.innerHTML =
        '<svg class="hail__glyph" viewBox="0 0 14 12" aria-hidden="true" focusable="false">' +
        '<rect x="0.6" y="0.6" width="12.8" height="10.8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
        '<path d="M1 2.2 7 6.6l6-4.4" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
        "</svg>";
      say.appendChild(el("span", null, "Contact"));
      // The word is hidden on narrow screens, so the link needs a name
      // that does not depend on it.
      say.setAttribute("aria-label", "Contact Sherjeel");
      bar.appendChild(say);
    }

    /* ── the plan ────────────────────────────────────────── */
    var nav = el("button", "plan-btn");
    nav.type = "button";
    nav.setAttribute("aria-haspopup", "dialog");
    nav.setAttribute("aria-controls", "floorplan");
    nav.setAttribute("aria-expanded", "false");
    nav.setAttribute(
      "aria-label",
      workshop ? "Open the workshop floorplan" : "Open the menu"
    );
    nav.innerHTML = glyph();
    // Last, so the plan sits in the corner itself.
    bar.appendChild(nav);

    /* The entrance page carries its own identity in the hero, so the rail
       does not repeat it: there the wordmark and contact wait until the
       hero has scrolled away, and the plan stands alone in the corner,
       larger, reading as a building rather than an icon. */
    if (page === PLAN.entrance.href) {
      bar.classList.add("rail--beacon");
      var hero = document.querySelector("header");
      if (hero && typeof IntersectionObserver === "function") {
        new IntersectionObserver(
          function (entries) {
            bar.classList.toggle("is-stuck", !entries[0].isIntersecting);
          },
          { rootMargin: "-32px 0px 0px 0px" }
        ).observe(hero);
      } else {
        // No observer: show the full rail rather than leaving the page
        // with navigation that only appears under a condition we cannot
        // detect.
        bar.classList.add("is-stuck");
      }
    }

    document.body.appendChild(bar);

    /* showModal() promotes the dialog into the TOP LAYER, which is painted
       above every z-index on the page — including the custom cursor's
       9999. The dot did not stop tracking; it was simply behind the
       overlay, so the plan was the one screen on the site with no pointer
       of its own. Moving the two nodes into the dialog puts them in the
       same layer as the thing they have to sit on top of.

       They are position:fixed and the dialog carries no transform, so
       their coordinates do not change with the move — no re-anchoring,
       and nothing for chrome.js to know about. */
    var carried = [];
    function carry(into) {
      ["cursor", "cursorIcon"].forEach(function (id) {
        var n = document.getElementById(id);
        if (n) into.appendChild(n);
      });
    }

    nav.addEventListener("click", function () {
      if (typeof dlg.showModal === "function") {
        carried = [document.getElementById("cursor"), document.getElementById("cursorIcon")];
        dlg.showModal();
        carry(dlg);
      } else {
        dlg.setAttribute("open", "");
      }
      nav.setAttribute("aria-expanded", "true");
    });

    // Returning focus to the trigger after close is not automatic when
    // the dialog is closed by Escape.
    dlg.addEventListener("close", function () {
      // Back to the body, or the next page-level hover would be updating
      // a node inside a closed dialog — display:none, and invisible.
      carried.forEach(function (n) {
        if (n) document.body.appendChild(n);
      });
      nav.setAttribute("aria-expanded", "false");
      nav.focus();
    });
  }

  function init() {
    if (document.querySelector(".rail")) return;
    rail(build());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
