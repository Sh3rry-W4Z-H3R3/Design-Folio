/* ─── CHROME ─────────────────────────────────────────────────────────
   Custom cursor and the workshop/editorial mode switch.

   The mobile burger menu that used to live here is gone: the floorplan
   is the navigation at every width, so there is no second menu to open.

   Replaces the ~35 lines of cursor JS that were copy-pasted into all
   26 pages.

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

    // Anchor both elements at the viewport origin from JS, as inline
    // styles. transform is relative to whatever top/left the CSS gives the
    // element, and a page carrying its own `.cursor { left: 50vw }` would
    // silently offset the dot from the real pointer by half the screen.
    //
    // No page declares that any more — those rules are all gone — so this
    // is insurance rather than a fix. It costs two assignments and makes
    // the dot's position independent of anything a page might add later.
    [dot, icon].forEach(function (el) {
      if (!el) return;
      el.style.left = "0px";
      el.style.top = "0px";
    });

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

    /* Hover behaviour is DELEGATED rather than bound per element.
       floorplan.js builds the plan after this file has run, so anything
       bound here with querySelectorAll would miss every room and door —
       and with them the monitor/pot icons, which now live on the plan.
       mouseenter does not bubble; mouseover does. */
    /* Pages can name extra things that should grow the cursor — a gallery
       tile, a colour swatch, a door panel — by listing selectors in
       data-cursor-targets on <html>. Six pages were each carrying their
       own copy of the same mouseenter/mouseleave loop to do this; one
       attribute replaces all of them, and the delegation below then covers
       elements added after load for free. */
    var extra = root.getAttribute("data-cursor-targets");
    var HOVERS = "a, button, [data-cursor]" + (extra ? ", " + extra : "");

    function hovered(node) {
      return node && node.closest ? node.closest(HOVERS) : null;
    }

    document.addEventListener("mouseover", function (e) {
      var el = hovered(e.target);
      if (!el) return;
      dot.classList.add("grow");
      var key = el.getAttribute("data-cursor");
      if (icon && key && ICONS[key]) {
        icon.innerHTML = ICONS[key];
        icon.classList.add("visible");
      }
    });

    document.addEventListener("mouseout", function (e) {
      var el = hovered(e.target);
      if (!el) return;
      // Moving between two nodes inside the same link is not a leave.
      if (hovered(e.relatedTarget) === el) return;
      dot.classList.remove("grow");
      if (icon) icon.classList.remove("visible");
    });

    // Leaving the window should take the dot with it, or it sticks at
    // the last known position over the page edge.
    document.addEventListener("mouseleave", function () { dot.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { dot.style.opacity = ""; });
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
  initModeSwitch();
})();
