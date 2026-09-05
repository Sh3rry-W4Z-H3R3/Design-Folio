/* ─── CONE ────────────────────────────────────────────────────────────
   The case study spine's one piece of motion: a firing line down the
   left edge that fills as you scroll, and beats that light as it passes
   them.

   Named for the pyrometric cone — the thing in a kiln that tells you how
   far the firing has actually got, rather than what the dial claims. It
   is a progress reading, which is why it is one line and not a set of
   flourishes.

   THE ORDER OF EVENTS MATTERS HERE. This script adds `case-fx` to
   <html>, and every rule that hides anything is gated behind that class.
   So the page's resting state — no JS, script blocked, script errored,
   reduced motion, editorial mode — is all six beats plainly readable.
   Getting that backwards is the classic scroll-reveal bug: text parked
   at opacity 0 waiting on an observer that never runs, and a page whose
   first frame is empty.

   Loaded with `defer` from the eighteen case studies only. Nothing else
   on the site has beats to light.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var root = document.documentElement;
  var beats = [].slice.call(document.querySelectorAll("[data-case-beat]"));
  if (!beats.length) return;

  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Editorial mode is the fast path a hurried visitor opted into, and
     the mode script has already resolved it before this runs. Someone
     who chose the quick version did not choose a scroll performance. */
  if (reduced || root.getAttribute("data-mode") !== "workshop") return;
  if (!("IntersectionObserver" in window)) return;

  /* ── BOOT WITHOUT A FLASH ───────────────────────────────────
     This script is deferred, so the page has already painted with every
     beat visible by the time it runs. Adding `case-fx` on its own then
     transitions the off-screen beats from opacity 1 down to 0 — the
     reader sees the text appear and then fade itself out, which is worse
     than no effect at all. Measured at 0.036 opacity mid-fade on the
     first frame after load.

     So: light what is already on screen FIRST, suppress transitions for
     one frame while the hidden state is applied, then hand the
     transitions back. */
  beats.forEach(function (b) {
    if (b.getBoundingClientRect().top < innerHeight * 0.9) b.classList.add("is-lit");
  });
  root.classList.add("case-fx", "case-fx-boot");
  // Force a style flush so the boot state is what actually painted.
  void root.offsetHeight;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.classList.remove("case-fx-boot");
    });
  });

  /* ── LIGHT EACH BEAT AS IT ARRIVES ──────────────────────────
     -12% so a beat lights once it is properly in the frame rather than
     the instant its top edge clears. Unobserved after lighting: a beat
     that has been read does not un-read when you scroll back up, and a
     spine that re-animates on every pass is a distraction. */
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-lit");
        io.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  beats.forEach(function (b) {
    io.observe(b);
  });

  // Beats lit during boot are done; stop watching them.
  beats.forEach(function (b) {
    if (b.classList.contains("is-lit")) io.unobserve(b);
  });

  /* ── THE FIRE ───────────────────────────────────────────────
     Height is the scroll position, so the line reads as how far through
     the firing you are. Written on rAF rather than on the scroll event:
     the handler only records that a frame is wanted, so a fast scroll
     costs one style write per frame instead of one per event. */
  var rail = document.createElement("div");
  rail.className = "case-rail";
  rail.setAttribute("aria-hidden", "true");
  var fire = document.createElement("div");
  fire.className = "case-rail__fire";
  rail.appendChild(fire);
  document.body.appendChild(rail);

  var queued = false;

  function paint() {
    queued = false;
    var doc = document.documentElement;
    var run = doc.scrollHeight - innerHeight;
    var pct = run > 0 ? Math.min(Math.max(scrollY / run, 0), 1) : 1;
    fire.style.height = (pct * innerHeight).toFixed(1) + "px";
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }

  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  paint();
})();
