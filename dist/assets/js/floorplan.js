/* ─── FLOORPLAN NAVIGATION ───────────────────────────────────────────
   The workshop's plan, used as the site's navigation in workshop mode.

   Two decisions worth knowing before changing anything here:

   1. The rooms are REAL LINKS positioned as rectangles — not an SVG
      drawing with a hidden list underneath. One set of elements is both
      the picture and the semantics, so keyboard order, focus, hit areas
      and screen-reader output all come out right by construction
      instead of having to be kept in sync with a decorative layer.

   2. The plan is a <dialog> opened with showModal(), which gives focus
      trapping, Escape, inertness of the page behind, and the top layer
      for free. Hand-rolling those is how nav overlays end up subtly
      broken for keyboard users.

   PLAN below is the only thing that needs to change when Sherjeel's
   sketch arrives: coordinates are percentages of the plan box, so the
   geometry can be redrawn without touching any behaviour.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var root = document.documentElement;

  /* Placeholder geometry — a building read from the front.
     Top band: the two main rooms. Middle band: the smaller rooms.
     Bottom: the facade the visitor arrives at, with its two doors. */
  var PLAN = {
    rooms: [
      {
        id: "physical",
        name: "Industrial",
        sub: "Physical & making",
        href: "craft.html",
        x: 0, y: 0, w: 54, h: 60,
        size: "main",
      },
      {
        id: "digital",
        name: "Digital",
        sub: "UI, web & brand",
        href: "digital.html",
        x: 54, y: 0, w: 46, h: 60,
        size: "main",
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
      { room: "physical", label: "Physical door", href: "craft.html", x: 16, w: 16 },
      { room: "digital", label: "Digital door", href: "digital.html", x: 68, w: 16 },
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

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function build() {
    var dlg = el("dialog", "plan");
    dlg.id = "floorplan";
    dlg.setAttribute("aria-label", "Workshop floorplan");

    var inner = el("div", "plan__inner");

    var head = el("div", "plan__head");
    head.appendChild(el("p", "plan__eyebrow", "The workshop"));
    var close = el("button", "plan__close");
    close.type = "button";
    close.setAttribute("aria-label", "Close floorplan");
    close.innerHTML = "<span></span><span></span>";
    head.appendChild(close);
    inner.appendChild(head);

    // The plan itself: a list, drawn as a building.
    var box = el("div", "plan__box");
    var list = el("ul", "plan__rooms");

    PLAN.rooms.forEach(function (r) {
      var li = el("li", "plan__cell" + (r.size === "main" ? " plan__cell--main" : ""));
      li.style.left = r.x + "%";
      li.style.top = r.y + "%";
      li.style.width = r.w + "%";
      li.style.height = r.h + "%";

      var a = el("a", "plan__room");
      a.href = r.href;
      a.dataset.room = r.id;
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

    box.appendChild(list);

    // Facade strip along the bottom, with the two doors.
    var facade = el("div", "plan__facade");
    facade.appendChild(el("span", "plan__facade-sign", "Sherjeel Hussain"));
    PLAN.doors.forEach(function (d) {
      var a = el("a", "plan__door");
      a.href = d.href;
      // Each door carries the colour of the room it opens into, not the
      // room the visitor happens to be standing in.
      a.dataset.room = d.room;
      a.style.left = d.x + "%";
      a.style.width = d.w + "%";
      a.appendChild(el("span", "sr-only", d.label));
      facade.appendChild(a);
    });
    box.appendChild(facade);
    inner.appendChild(box);

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
    // deal with the backdrop click, which the platform does not.
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
    close.addEventListener("click", function () {
      dlg.close();
    });

    return dlg;
  }

  function init() {
    // Workshop mode only. In editorial mode the ordinary nav and the
    // mobile menu do the job, and a floorplan would be the tour that
    // someone in that mode has explicitly opted out of.
    if (root.getAttribute("data-mode") !== "workshop") return;

    var nav = document.querySelector("nav:not(.footer-nav)");
    if (!nav || nav.querySelector(".plan-trigger")) return;

    var dlg = build();

    var trigger = el("button", "plan-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "floorplan");
    trigger.setAttribute("aria-label", "Open the workshop floorplan");
    trigger.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<rect x="0.75" y="0.75" width="14.5" height="14.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
      '<path d="M6.5 1v6.5M0.75 7.5H16M10 7.5V16" stroke="currentColor" stroke-width="1.2"/>' +
      "</svg><span>Plan</span>";

    // Before the burger, so the burger stays the last item on mobile.
    var burger = nav.querySelector(".nav__burger");
    if (burger) nav.insertBefore(trigger, burger);
    else nav.appendChild(trigger);

    trigger.addEventListener("click", function () {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    });

    // Returning focus to the trigger after close is not automatic when
    // the dialog is closed by Escape.
    dlg.addEventListener("close", function () {
      trigger.focus();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
