<!--
TareBook — short-form variants.
Three lengths so you can pick what fits each surface.
-->

# TareBook — short-form variants

## 1. Folio index card (~400 words)

For the work index page, with the case study linked behind a "Read more →".

---

### TareBook
*Pottery pricing studio · 2026*

A pricing studio for working potters. Built by one. Mobile-first PWA, iOS in App Store review.

Potters underprice their work. The tools that already exist focus on recipe sharing or glaze chemistry, not finance — and the actual blocker isn't the maths. It's that nobody wants to do the maths with wet hands at 9pm after firing a kiln. TareBook is the answer: open the app, tap a piece, see what it costs and what to charge.

The product is opinionated about scope. It does one job: tell you the true cost of every piece you make, then what to charge wholesale and what to charge retail. Live multiplier sliders, fully itemised breakdown, share to Instagram via the native iOS sheet. Works offline by default; cloud sync turns on when you sign in.

**Design notes.** Editorial layout — Playfair Display headings, DM Sans body, one hero retail number per screen instead of three competing stat tiles. Light + dark theme with WCAG 2.1 AA contrast verified in both. CSS-variable token system; warm cream / clay / bark palette. Paper-grain texture overlay at 3% opacity so flat colour fields feel like material.

**Tech notes.** React · TypeScript · Tailwind · Dexie (IndexedDB) · Supabase · Capacitor 8 for the iOS shell. 30 TypeScript files, 173 KB gzipped, schema v4 with auto-migration. Zero runtime dependency on paid services — the whole app works on a phone with no signal.

Live now: [tarebook1.netlify.app](https://tarebook1.netlify.app). iOS submission in review.

[Read the full case study →](./tarebook)

---

## 2. LinkedIn post (~280 chars)

Shipped TareBook this week — a pricing studio for studio potters.

Built it because I needed it: most potters underprice because the maths is tedious and no existing tool focuses on finance.

Web app live, iOS in App Store review.

🔗 [tarebook1.netlify.app]

---

## 3. Instagram bio link / one-liner (~50 chars)

> TareBook — know what your work actually costs you. tarebook1.netlify.app

---

## 4. Twitter / X thread opener (~280 chars)

I built TareBook — a pricing studio for studio potters.

Open the app, tap a piece, see cost + wholesale + retail. Materials, time, kiln cost, overhead, all itemised. Offline-first. iOS soon.

Built it because I'm a potter and the tools that exist only do glaze chemistry.

🔗 tarebook1.netlify.app

---

## 5. Recruiter-facing portfolio summary (~150 words)

For a CV portfolio link, a job application, or a hiring manager scanning your work.

---

**TareBook · Pottery pricing studio · 2026**

Product, design, and engineering on a mobile-first PWA for studio potters, plus an iOS shell built for App Store submission via Capacitor.

Role: solo — research, positioning, IA, UI, design system, frontend, data layer, sync, iOS native bridge, App Store prep.

Outcomes:

- Six end-to-end screens, fully responsive, mobile-first at 390px
- Light + dark theme via CSS custom properties, WCAG 2.1 AA contrast verified in both
- Offline-first via Dexie (IndexedDB); opt-in cloud sync via Supabase with row-level security
- Itemised pricing engine (schema v4, auto-migrating across four iterations)
- iOS native shell with privacy manifest, native share sheet, haptics, theme-aware status bar

Live: [tarebook1.netlify.app](https://tarebook1.netlify.app) · Source: github.com/Sh3rry-W4Z-H3R3/GLAZE-CALC · App Store: in review.
