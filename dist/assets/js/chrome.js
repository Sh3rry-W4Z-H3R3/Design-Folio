/* ─── CHROME ─────────────────────────────────────────────────────────
   Custom cursor, mobile menu, and the workshop/editorial mode switch.

   Replaces mobile-nav.js and the ~35 lines of cursor JS that were
   copy-pasted into all 26 pages.

   Loaded with `defer` from every page. Reads the mode that the inline
   head snippet already resolved — it never decides the mode itself,
   because by the time this runs the page has painted.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var root = document.documentElement;
  var STORE = "sh.mode";
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── CUSTOM CURSOR ────────────────────────────────────────
     Workshop mode, real pointers, and only when motion is welcome.
     The dot follows via transform rather than top/left so it moves on
     the compositor instead of forcing layout on every mouse event. */
  function initCursor() {
    if (!fine || reduced || root.getAttribute("data-mode") !== "workshop") return;

    var dot = document.getElementById("cursor");
    var icon = document.getElementById("cursorIcon");
    if (!dot) return;

    var ICONS = {
      monitor:
        '<svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">' +
        '<rect x="1" y="1" width="26" height="17" rx="2" stroke="currentColor" stroke-width="1.5"/>' +
        '<rect x="9" y="18" width="10" height="2" fill="currentColor" opacity=".5"/>' +
        '<rect x="6" y="20" width="16" height="1.5" fill="currentColor" opacity=".5"/>' +
        '<circle cx="14" cy="9.5" r="1.5" fill="currentColor" opacity=".4"/>' +
        "</svg><span>Digital</span>",
      pot:
        '<svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">' +
        '<path d="M7 4C5 4 2 7 2 13C2 19 5 23 11 23C17 23 20 19 20 13C20 7 17 4 15 4Z" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M7 4C8 2 10 1 11 1C12 1 14 2 15 4" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M5 10C3 9.5 2.5 8 3 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
        "</svg><span>Craft</span>",
    };

    var x = 0, y = 0, queued = false;

    function paint() {
      queued = false;
      dot.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
      if (icon) icon.style.transform = "translate(" + x + "px," + y + "px) translate(10px,-50%)";
    }

    document.addEventListener(
      "mousemove",
      function (e) {
        x = e.clientX;
        y = e.clientY;
        if (!queued) {
          queued = true;
          requestAnimationFrame(paint);
        }
      },
      { passive: true }
    );

    // Icons are keyed by a data-cursor attribute on the link.
    document.querySelectorAll("[data-cursor]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        dot.classList.add("grow");
        if (icon && ICONS[el.dataset.cursor]) {
          icon.innerHTML = ICONS[el.dataset.cursor];
          icon.classList.add("visible");
        }
      });
      el.addEventListener("mouseleave", function () {
        dot.classList.remove("grow");
        if (icon) icon.classList.remove("visible");
      });
    });

    // Every other link just grows the dot.
    document.querySelectorAll("a:not([data-cursor]), button").forEach(function (el) {
      el.addEventListener("mouseenter", function () { dot.classList.add("grow"); });
      el.addEventListener("mouseleave", function () { dot.classList.remove("grow"); });
    });

    // Leaving the window should take the dot with it, or it sticks at
    // the last known position over the page edge.
    document.addEventListener("mouseleave", function () { dot.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { dot.style.opacity = ""; });
  }

  /* ── MOBILE MENU ──────────────────────────────────────────
     Built from the page's own nav links rather than a hardcoded list,
     so a page that gains or loses a nav item stays consistent — the old
     mobile-nav.js had the menu hardcoded and had already drifted from
     the desktop nav. */
  function initMobileNav() {
    var navLinks = document.querySelector("nav .nav__links");
    if (!navLinks) return;
    var nav = navLinks.closest("nav");
    if (!nav || nav.querySelector(".nav__burger")) return;

    var burger = document.createElement("button");
    burger.className = "nav__burger";
    burger.type = "button";
    burger.setAttribute("aria-label", "Open menu");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-controls", "navMobile");
    burger.innerHTML = "<span></span><span></span><span></span>";
    nav.appendChild(burger);

    var overlay = document.createElement("div");
    overlay.className = "nav__mobile";
    overlay.id = "navMobile";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Site navigation");

    // Mirror the desktop nav.
    navLinks.querySelectorAll("a").forEach(function (a) {
      var copy = document.createElement("a");
      copy.href = a.getAttribute("href");
      copy.textContent = a.textContent.trim();
      if (a.classList.contains("active") || a.getAttribute("aria-current") === "page") {
        copy.setAttribute("aria-current", "page");
      }
      overlay.appendChild(copy);
    });

    // Carry the footer's social links through, if the page has them.
    var socials = document.querySelectorAll('.footer-nav a[target="_blank"]');
    if (socials.length) {
      var row = document.createElement("div");
      row.className = "nav__mobile__socials";
      socials.forEach(function (a) {
        var copy = document.createElement("a");
        copy.href = a.href;
        copy.target = "_blank";
        copy.rel = "noopener";
        copy.textContent = a.textContent.trim();
        row.appendChild(copy);
      });
      overlay.appendChild(row);
    }

    document.body.appendChild(overlay);

    var lastFocus = null;

    function close() {
      burger.classList.remove("open");
      overlay.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
      root.classList.remove("nav-open");
      document.body.classList.remove("nav-open");
      if (lastFocus) lastFocus.focus();
    }

    function open() {
      lastFocus = document.activeElement;
      burger.classList.add("open");
      overlay.classList.add("open");
      burger.setAttribute("aria-expanded", "true");
      burger.setAttribute("aria-label", "Close menu");
      root.classList.add("nav-open");
      document.body.classList.add("nav-open");
      var first = overlay.querySelector("a");
      if (first) first.focus();
    }

    burger.addEventListener("click", function () {
      overlay.classList.contains("open") ? close() : open();
    });

    overlay.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("open")) return;

      if (e.key === "Escape") {
        close();
        return;
      }

      // Keep focus inside the dialog while it is open.
      if (e.key === "Tab") {
        var items = [burger].concat(Array.prototype.slice.call(overlay.querySelectorAll("a")));
        var i = items.indexOf(document.activeElement);
        if (i === -1) return;
        var next = e.shiftKey ? i - 1 : i + 1;
        if (next < 0) next = items.length - 1;
        if (next >= items.length) next = 0;
        items[next].focus();
        e.preventDefault();
      }
    });
  }

  /* ── MODE SWITCH ──────────────────────────────────────────
     Toggles between the workshop and the fast editorial version, and
     remembers the choice. Reloads so the mode is applied by the same
     blocking head snippet that handles a cold visit — one code path
     rather than two. */
  function initModeSwitch() {
    var btn = document.querySelector(".mode-switch");
    if (!btn) return;

    function label() {
      var workshop = root.getAttribute("data-mode") === "workshop";
      btn.textContent = workshop ? "Skip the tour" : "Enter the workshop";
      btn.setAttribute(
        "aria-label",
        workshop
          ? "Skip the tour and view a faster, simpler version of this site"
          : "Enter the full workshop experience"
      );
    }

    label();

    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-mode") === "workshop" ? "editorial" : "workshop";
      try { localStorage.setItem(STORE, next); } catch (e) {}
      location.reload();
    });
  }

  initCursor();
  initMobileNav();
  initModeSwitch();
})();
