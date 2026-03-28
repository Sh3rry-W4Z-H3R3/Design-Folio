# Sherjeel Hussain Portfolio — Claude Project Brief

You are helping Sherjeel Hussain get his personal portfolio website live at **sherjeelhussain.com**, hosted on **Cloudflare Pages** via **GitHub** (`https://github.com/Sh3rry-W4Z-H3R3`).

The site is fully built — 27 HTML pages, SEO implemented, copy written. The remaining tasks are: fix mobile nav and layout issues, wire up images, deploy to Cloudflare Pages, and connect the domain.

---

## 1. WHO SHERJEEL IS

Glasgow-based UI designer, product designer, and ceramicist. Self-taught in web dev (HTML, CSS, JS — no frameworks). His skill level is intermediate — he understands code, can follow instructions, but is not yet writing complex JS from scratch.

- **Studio:** SCM Design Studio (commercial digital/brand work)
- **Ceramics practice:** SH27 Design
- **Education:** BA(Hons) Three Dimensional Design, Robert Gordon University (2:1, 2022); Graduate in Residence, Gray's School of Art (2022–23)
- **Domain:** sherjeelhussain.com
- **GitHub:** https://github.com/Sh3rry-W4Z-H3R3
- **Hosting:** Cloudflare Pages

---

## 2. DESIGN SYSTEM

All pages share these tokens. **Never change these without being asked.**

### Colours
```css
--bg:       #0a0a0a;   /* page background */
--fg:       #ede9e1;   /* primary text */
--fg-dim:   #555;      /* muted text */
--fg-mid:   #999;      /* body copy */
--accent:   #e8547a;   /* pink — digital/brand pages */
--accent-2: #6dbf9e;   /* mint — craft/ceramics pages */
--gold:     #c8b882;   /* champagne — used on New Designers page */

/* Kala Topi specific */
--kt-brown:   #401B0E;
--kt-crimson: #A61B34;
--kt-green:   #0F5944;
--kt-cream:   #F2E0BD;
--kt-pink:    #F25764;
```

### Typography
```
Cormorant — headings, hero titles, display (Google Fonts)
Syne      — nav, labels, eyebrows, caps (Google Fonts)
DM Sans   — body copy (Google Fonts)
```

### Google Fonts import (on every page):
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&family=Syne:wght@400;500;700&display=swap" rel="stylesheet" />
```

### Spacing
```css
--gutter: clamp(1.4rem, 5vw, 5rem);  /* horizontal page padding */
```

### Motion
```css
--ease: cubic-bezier(0.25, 0.1, 0.25, 1);
--slow: 0.7s var(--ease);
--fast: 0.3s var(--ease);
```

---

## 3. SITE STRUCTURE — ALL 27 PAGES

### Core navigation pages
| File | Title | Nav active state |
|---|---|---|
| `index.html` | Homepage — split gateway | none |
| `digital.html` | Digital & Brand | "Digital" |
| `craft.html` | Craft & Making | "Craft" |
| `about.html` | About + Contact | "About" |
| `kala-topi.html` | Di Kala Topi | "Kala Topi" |

### Digital case studies (linked from digital.html)
| File | Project |
|---|---|
| `alastair-smith.html` | Alastair Smith Ceramics — brand + website |
| `clydeside.html` | Clydeside Logistics — full brand system |
| `andras.html` | Andra's Garden Heaven — Shopify brand |
| `just-rite.html` | Just Rite Barbershop — shopfront signage |
| `westgarth.html` | Westgarth Auto — website |

### Craft case studies (linked from craft.html)
| File | Project |
|---|---|
| `canti.html` | CANTI-001 — degree show furniture |
| `residency.html` | Graduate in Residence — Gray's |
| `multanni.html` | Multanni Mitti — personal clay practice |
| `thudpuk.html` | Project 261 THUDPUK — slip cast run |
| `origin.html` | Origin Plastics internship |
| `hover-pot.html` | Multanni Hover Pot |
| `slip-sarge.html` | Slip Me A Large, Sarge! |
| `greene-king.html` | Project 262 Greene King ceramics |
| `raku-club.html` | Raku Club — RGU |

### Exhibition pages (linked from craft.html exhibitions section)
| File | Exhibition |
|---|---|
| `cherry-vision.html` | Cherry-Vision {temperature 1400C} — Dec 2026 |
| `cycle-arts.html` | Cycle Arts Festival 2025 — SCOPE Collective |
| `courtyard.html` | Crafted by Design — Courtyard Artspace Aberdeen |
| `blend.html` | BLEND — GiR Programme, Gray's |
| `new-designers.html` | New Designers London 2022 |

### SEO/config files (go in root, not /img/)
| File | Purpose |
|---|---|
| `sitemap.xml` | Submit to Google Search Console |
| `robots.txt` | Allows Google + AI crawlers |
| `llms.txt` | AI entity file for LLM crawlers |

---

## 4. NAV STRUCTURE

The nav appears on every page. Standard markup:

```html
<div class="cursor" id="cursor"></div>
<div class="cursor-icon" id="cursorIcon"></div>

<nav>
  <a href="index.html" class="nav__home">Sherjeel <em>Hussain</em></a>
  <div class="nav__links">
    <a href="digital.html" data-cursor="monitor">Digital</a>
    <a href="craft.html" data-cursor="pot">Craft</a>
    <a href="kala-topi.html">Kala Topi</a>
    <a href="about.html">About</a>
    <a href="about.html#contact">Contact</a>
  </div>
</nav>
```

On case study pages a back arrow also appears:
```html
<div style="display:flex;align-items:center;gap:3rem;">
  <a href="digital.html" class="nav__back">Digital</a>  <!-- or craft.html -->
  <div class="nav__links">...</div>
</div>
```

### Cursor icons (data-cursor attributes)
- `data-cursor="monitor"` → shows pink monitor SVG icon, used on Digital link
- `data-cursor="pot"` → shows mint pot SVG icon, used on Craft link

### Known issue to fix: MOBILE NAV
The current nav has no mobile hamburger — on small screens the links overflow or collapse poorly. **Sherjeel will send a screenshot of the desired mobile nav design.** When he does, implement it consistently across all 27 pages. The pattern will be a hamburger icon that opens a full-screen or slide-in menu. Key requirements:
- Must work without JavaScript frameworks
- Cursor and cursor-icon divs should be `display:none` on mobile (already in CSS via `@media(max-width:768px)`)
- The back arrow on case study pages must also be handled on mobile

---

## 5. RESPONSIVE BREAKPOINTS

All pages use this pattern:
```css
@media (max-width: 1024px) { /* tablet adjustments */ }
@media (max-width: 768px)  { /* mobile — main breakpoint */ }
@media (max-width: 480px)  { /* small mobile */ }
```

At 768px: cursor hidden, grid columns collapse to 1fr, sticky labels become static.

### Known issue to fix: WEIRD BOXES
Some pages show unexpected bordered boxes or containers after the main content ends. Sherjeel will send screenshots. These are likely unclosed divs or leftover empty containers. Fix them by auditing the HTML structure on the affected pages.

---

## 6. CURSOR SYSTEM

Custom cursor on desktop, hidden on mobile. JavaScript is the same on every page:

```javascript
const cursor     = document.getElementById('cursor');
const cursorIcon = document.getElementById('cursorIcon');

const ICONS = {
  monitor: `<svg width="28" height="22" viewBox="0 0 28 22" fill="none">
    <rect x="1" y="1" width="26" height="17" rx="2" stroke="#e8547a" stroke-width="1.5"/>
    <rect x="9" y="18" width="10" height="2" fill="#e8547a" opacity=".5"/>
    <rect x="6" y="20" width="16" height="1.5" fill="#e8547a" opacity=".5"/>
    <circle cx="14" cy="9.5" r="1.5" fill="#e8547a" opacity=".4"/>
  </svg><span>Digital</span>`,
  pot: `<svg width="22" height="26" viewBox="0 0 22 26" fill="none">
    <path d="M7 4C5 4 2 7 2 13C2 19 5 23 11 23C17 23 20 19 20 13C20 7 17 4 15 4Z" stroke="#6dbf9e" stroke-width="1.5" fill="none"/>
    <path d="M7 4C8 2 10 1 11 1C12 1 14 2 15 4" stroke="#6dbf9e" stroke-width="1.5" fill="none"/>
  </svg><span>Craft</span>`
};

document.addEventListener('mousemove', e => {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top  = e.clientY + 'px';
  cursorIcon.style.left = (e.clientX + 18) + 'px';
  cursorIcon.style.top  = e.clientY + 'px';
});

document.querySelectorAll('[data-cursor]').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('grow');
    cursorIcon.innerHTML = ICONS[el.dataset.cursor] || '';
    cursorIcon.classList.add('visible');
  });
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('grow');
    cursorIcon.classList.remove('visible');
  });
});

document.querySelectorAll('a:not([data-cursor])').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('grow'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('grow'));
});
```

---

## 7. IMAGE SYSTEM

All images live in `/img/` folder at the root of the project (same level as HTML files).

### Files Sherjeel already has (need renaming):
| Current filename | Rename to |
|---|---|
| `IMG-20250922-WA0003.jpg` | `img/justrite-shopfront.jpg` |
| `IOSheropage.jpg` | `img/alastair-mobile.jpg` |
| `Macbook_Mockup_Front_View_UV.png` | `img/andras-macbook.png` |
| `iPhone_15_Mockup__Perspective-HomeScreen_Product.png` | `img/andras-mobile-1.jpg` |
| `iPhone_15_Mockup__Perspective_-_Homescreen_MobMenu.png` | `img/andras-mobile-2.jpg` |
| `iPhone_Mockup__Perspective.png` | `img/westgarth-mobile.jpg` |
| `BizCard_FrontAsset_2.png` | `img/clydeside-logo.jpg` |
| `AGH_Logo_GreenAsset_1_2x-100.jpg` | `img/andras-logo.png` |
| `KalaTopiLogoAsset_2.png` | `img/kala-topi-logo.png` |
| `Light.png` | `img/alastair-logo.svg` |

### Kala Topi menu panels (screenshot from brand document):
| Save as | Which panel |
|---|---|
| `img/kt-menu-story.png` | Our Story — Scotland/Pakistan map |
| `img/kt-menu-dishes.png` | From the Tawa / From the Grill |
| `img/kt-menu-quality.png` | Quality is a Relationship |

### Still needs shooting — Priority 1:
- `img/canti-hero.jpg` — CANTI table, best available photo
- `img/canti-full.jpg` — wide shot
- `img/canti-detail-1.jpg` — joinery detail
- `img/canti-detail-2.jpg` — plastic surface texture
- `img/sherjeel-portrait.jpg` — portrait for about.html
- `img/alastair-hero.jpg` — ceramics product shot from Alastair photoshoot
- `img/clydeside-hero.jpg` — logo on dark bg or van
- `img/og-default.jpg` — 1200×630px fallback Open Graph image

Full image list is in `IMAGE-GUIDE.md` in the project files.

---

## 8. SEO IMPLEMENTATION (already done)

Every page has:
- `<meta name="description">` — unique per page
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter Card tags
- `<link rel="canonical">` — pointing to `https://sherjeelhussain.com/[page]`
- JSON-LD structured data (Person schema on index/about, CreativeWork/VisualArtwork/Event on project pages)

Files to upload to root:
- `sitemap.xml` — submit to Google Search Console after launch
- `robots.txt` — allows Google + AI crawlers (GPTBot, PerplexityBot, Claude-Web)
- `llms.txt` — AI entity file

**One action after launch:** Go to search.google.com/search-console, add the domain, and submit `https://sherjeelhussain.com/sitemap.xml`

---

## 9. DEPLOYMENT — CLOUDFLARE PAGES VIA GITHUB

### Step-by-step:

**1. Create GitHub repo**
- Go to github.com, log in as Sh3rry-W4Z-H3R3
- Create new repo: `sherjeelhussain-portfolio` (public or private, your choice)
- Don't initialise with README

**2. Upload files**
- Create an `/img/` folder in the repo
- Upload all `.html` files to the repo root
- Upload `sitemap.xml`, `robots.txt`, `llms.txt` to root
- Upload all images to `/img/`

**3. Connect to Cloudflare Pages**
- Go to dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git
- Select your GitHub account → select the repo
- Build settings: **Framework preset: None** | **Build command: (leave blank)** | **Build output directory: /** (or leave blank)
- Deploy

**4. Connect custom domain**
- In Cloudflare Pages → your project → Custom domains → Add domain
- Enter `sherjeelhussain.com`
- If domain is registered through Cloudflare, DNS updates automatically
- If registered elsewhere, you'll need to add a CNAME record pointing to your Pages URL

**5. Force HTTPS**
- Cloudflare Pages does this automatically — no action needed

### File structure in repo root:
```
/
├── index.html
├── about.html
├── digital.html
├── craft.html
├── kala-topi.html
├── canti.html
├── alastair-smith.html
├── clydeside.html
├── andras.html
├── just-rite.html
├── westgarth.html
├── multanni.html
├── residency.html
├── cherry-vision.html
├── cycle-arts.html
├── courtyard.html
├── blend.html
├── new-designers.html
├── thudpuk.html
├── origin.html
├── raku-club.html
├── hover-pot.html
├── slip-sarge.html
├── greene-king.html
├── sitemap.xml
├── robots.txt
├── llms.txt
├── IMAGE-GUIDE.md
└── img/
    ├── (all image files)
```

---

## 10. VOICE & COPY GUIDELINES

**Do not rewrite copy without being asked.** The voice is calibrated. Key rules:

- First person throughout ("I built", "I made", not "Sherjeel built")
- Short sentences. Then a longer one when the thought needs it
- Honest about process including failures — "it didn't fire how I expected", "the mould didn't fit the machine"
- Technical detail dropped casually, not explained at length
- Cultural detail (Pakistan references, multanni mitti origin) lands quietly — never announced
- No grand statements about what the work *means*
- Dry humour is fine — "The name came first, honestly"

If asked to write new copy, match this register exactly.

---

## 11. OUTSTANDING TASKS (in priority order)

1. **Mobile nav** — Sherjeel will send a screenshot. Implement hamburger menu consistently across all 27 pages
2. **Weird boxes** — Sherjeel will send screenshots of affected pages. Audit and fix unclosed containers
3. **Images** — rename existing files and upload, shoot missing ones (see Section 7)
4. **og-default.jpg** — create a 1200×630px fallback OG image (dark background, name + title in site typography)
5. **Deploy** — follow Section 9 step by step
6. **Domain connection** — sherjeelhussain.com → Cloudflare Pages
7. **Google Search Console** — submit sitemap after first deploy
8. **BLEND glaze names** — two `<h3>` tags in blend.html need actual recipe names replacing "Glaze One" / "Glaze Two"
9. **Custom domain email** — `sherjeelhussain9927@hotmail.com` appears in about.html contact section. When a custom domain email is set up (Cloudflare Email Routing is free), update that line

---

## 12. THINGS NOT TO CHANGE WITHOUT ASKING

- The colour token system (Section 2)
- Font choices
- The cursor icon system
- Any copy that's already written
- The SEO meta descriptions (they're keyword-targeted)
- The JSON-LD schema types per page
- The canonical URL structure (`https://sherjeelhussain.com/[file].html`)

---

## 13. QUICK REFERENCE — KEY DECISIONS ALREADY MADE

| Decision | What was decided |
|---|---|
| Nav links | Digital, Craft, Kala Topi, About, Contact (→ about.html#contact) |
| "Work" or "All Work" page | Not built — removed from nav intentionally |
| Westgarth Auto | Kept but small card, last in grid, short case study |
| Contact page | Combined with About as `about.html#contact` |
| Kala Topi | Self-directed project, leads as first case study on digital.html |
| Cherry-Vision ceramics | In Production — December 2026, Scottish Ceramics Gallery Aberdeen |
| Multanni mitti | Pakistani clay from Multan, used as slip stripe over stoneware |
| Accent colours | Pink (#e8547a) = digital track. Mint (#6dbf9e) = craft track |

---

*This document was generated from a full portfolio build session. All 27 pages are complete. Bring screenshots of mobile nav and weird boxes to the first session to begin fixes.*
