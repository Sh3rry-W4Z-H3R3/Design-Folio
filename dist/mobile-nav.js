/* Mobile nav — hamburger + full-screen overlay
   Self-contained. Inject CSS, find <nav>, append burger + overlay, wire events.
   Works with any page that has the standard <nav> structure used on sherjeelhussain.com.
*/
(function () {
  var css = ''
    // Kill browser default link styling (blue / purple visited / underline) on nav + footer chrome
    // :where() has zero specificity, so any per-page brand colour rule wins.
    + ':where(nav,footer,.footer-nav,.nav__mobile) a{color:inherit;text-decoration:none;}'
    + ':where(nav,footer,.footer-nav,.nav__mobile) a:link,:where(nav,footer,.footer-nav,.nav__mobile) a:visited{color:inherit;text-decoration:none;}'
    + '.nav__burger{display:none;background:none;border:0;padding:11px 9px;cursor:pointer;width:44px;height:44px;position:relative;z-index:110;flex-direction:column;justify-content:center;align-items:stretch;gap:5px;border-radius:4px;}'
    + '.nav__burger:focus-visible{outline:2px solid var(--accent,#e8547a);outline-offset:2px;}'
    + '.nav__burger span{display:block;width:100%;height:2px;background:var(--fg,#ede9e1);transition:transform .25s ease,opacity .25s ease;}'
    + '.nav__burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg);}'
    + '.nav__burger.open span:nth-child(2){opacity:0;}'
    + '.nav__burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}'
    + '.nav__mobile{position:fixed;inset:0;background:rgba(10,10,10,.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.6rem;z-index:105;opacity:0;pointer-events:none;transition:opacity .35s ease;}'
    + '.nav__mobile.open{opacity:1;pointer-events:auto;}'
    + ".nav__mobile a{font-family:'Cormorant',Georgia,serif;font-size:2.2rem;font-weight:300;letter-spacing:.04em;color:var(--fg,#ede9e1);text-decoration:none;line-height:1;transition:color .2s ease;}"
    + '.nav__mobile a em{font-style:italic;color:var(--accent,#e8547a);}'
    + '.nav__mobile a:hover,.nav__mobile a:focus{color:var(--accent,#e8547a);}'
    + '.nav__mobile__small{display:flex;gap:1.8rem;margin-top:1.8rem;padding-top:1.8rem;border-top:1px solid rgba(237,233,225,.12);}'
    + ".nav__mobile__small a{font-family:'Syne',sans-serif;font-size:.62rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--fg-mid,#999);}"
    + '.nav__mobile__socials{display:flex;gap:1.8rem;margin-top:2.4rem;}'
    + ".nav__mobile__socials a{font-family:'Syne',sans-serif;font-size:.6rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--fg-dim,#666);}"
    + '@media(max-width:768px){.nav__links{display:none!important;}.nav__back{display:none!important;}.nav__burger{display:flex;}html.nav-open,body.nav-open{overflow:hidden;position:relative;}}'
    + '@media(min-width:769px){.nav__mobile{display:none!important;}.nav__burger{display:none!important;}}';

  document.head.insertAdjacentHTML('beforeend', '<style id="nav-mobile-css">' + css + '</style>');

  // Find the FIRST top-nav (has .nav__links inside). Skip footer-only navs.
  var navLinks = document.querySelector('nav .nav__links');
  if (!navLinks) return;
  var nav = navLinks.closest('nav');
  if (!nav) return;

  var burger = document.createElement('button');
  burger.className = 'nav__burger';
  burger.id = 'navBurger';
  burger.setAttribute('aria-label', 'Open menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-controls', 'navMobile');
  burger.innerHTML = '<span></span><span></span><span></span>';
  nav.appendChild(burger);

  var overlay = document.createElement('div');
  overlay.className = 'nav__mobile';
  overlay.id = 'navMobile';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Site navigation');
  overlay.innerHTML = ''
    + '<a href="digital.html">Digital</a>'
    + '<a href="craft.html">Craft</a>'
    + '<a href="about.html">About</a>'
    + '<a href="contact.html">Contact</a>'
    + '<div class="nav__mobile__small">'
    +   '<a href="work.html">All Work &nbsp;↗</a>'
    +   '<a href="SideQuests.html">Side Quests &nbsp;↗</a>'
    + '</div>'
    + '<div class="nav__mobile__socials">'
    +   '<a href="https://www.linkedin.com/in/sherjeel-hussain-0652431b9/" target="_blank" rel="noopener">LinkedIn</a>'
    +   '<a href="https://www.instagram.com/sherjeel_h27_design_/" target="_blank" rel="noopener">Instagram</a>'
    + '</div>';
  document.body.appendChild(overlay);

  function close() {
    burger.classList.remove('open');
    overlay.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    document.documentElement.classList.remove('nav-open');
  }
  function open() {
    burger.classList.add('open');
    overlay.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
    document.documentElement.classList.add('nav-open');
  }
  burger.addEventListener('click', function () {
    overlay.classList.contains('open') ? close() : open();
  });
  overlay.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
