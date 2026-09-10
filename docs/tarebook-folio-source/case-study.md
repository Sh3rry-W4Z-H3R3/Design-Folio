<!--
TareBook — long-form folio case study.
Drop each section into your CMS. Image captions are written as
italicised lines under each <img> placeholder.
-->

# TareBook

**A pottery pricing studio in your pocket. Built by a working ceramicist for working ceramicists.**

<!-- HERO IMAGE: pricing-card-hero.png — Pricing Card on iPhone, the £40 retail number large, against a cream-and-bark gradient. -->

> Live preview at [tarebook1.netlify.app](https://tarebook1.netlify.app) · App Store coming soon

| | |
|---|---|
| Role | Design · Product · Engineering |
| Stack | React · TypeScript · Tailwind · Dexie · Supabase · Capacitor |
| Platforms | Web PWA (live) · iOS (in review) |
| Timeline | ~3 weeks |

---

## Brief

Build a tool that gives potters honest visibility into what their work actually costs to make — and what to charge for it.

A cost calculator for potters who mix their own glazes. Mobile-first PWA, works offline, syncs across devices when signed in.

Not a recipe community. Not a chemistry tool. Not studio management software. The product is knowing what your glaze actually costs you, and the v1 says no to everything else.

**Opinionated about scope. One job, done well.**

---

## Problem

There's a financial blind spot at the heart of a creative practice that's growing globally.

**The market.** The UK ceramics community on Instagram is roughly 50–100k active accounts. Globally the pottery and ceramics market is projected to grow at a 5.4–7.1% CAGR through 2033 — a quiet but durable resurgence, driven by hobbyist sellers turning into one-person businesses on Etsy, Faire, and Instagram.

**The pain.** Potters underprice their work because raw material costs are tedious to calculate manually. Existing tools focus on recipe sharing (Glazy), chemistry (Insight, Currie), or community — none of them on finance. The market gap isn't an idea I had to invent. It's missing.

**The "why now."** Studios are increasingly run as one-person businesses. The same potters who learned to throw and fire from masters never had to learn pricing. Etsy and Instagram force the decision anyway. Most undershoot by 40–60% because they only count clay and glaze — not kiln cost, not their own labour, not overhead, not the pieces that crack in the kiln.

<!-- COMPETITIVE LANDSCAPE IMAGE: a small 2×2 grid showing the existing pottery tools (Glazy, Currie, Insight, generic spreadsheets) and TareBook positioned in the empty quadrant labelled "Finance · Mobile-first". -->

---

## Insight

> ### As a working ceramicist, I knew the problem first-hand. The actual blocker isn't the maths — it's that nobody wants to do the maths with wet hands at 9pm after firing a kiln.

*— Project notebook, week one*

---

## Design intent

Six decisions that shaped the product. Each one is a "no" to a more obvious option.

### 1. Mobile-first, one-handed

Every screen designed at 390px first, then allowed to breathe outward. Tap targets minimum 44×44px (Apple HIG, also good for wet hands). Numeric inputs use `inputmode="decimal"` so the keypad appears instead of the full keyboard. Auto-save on blur, never on submit — nothing is lost when the user switches apps or gets a call mid-input.

<!-- IMAGE: 03-add-piece-light.png — Add Piece form with the Materials + Time sections visible. Caption: "Studio-friendly inputs: large numeric keypad, auto-save on blur, never below the fold." -->

### 2. Editorial, not dashboard

The first attempt was a SaaS-y dashboard — three stat tiles, four chrome bars, a FAB competing with action cards. I killed it. The shipped home reads like the cover of a journal: a date, a greeting, one large hero number, supporting metrics inline. Lists use hairline dividers, not nested cards. Headings are Playfair Display 600; body is DM Sans 400. Hover states shift to italic — analog, considered.

<!-- IMAGE: 01-home-light.png and 01-home-dark.png side by side. Caption: "Home: editorial layout in light and dark." -->

### 3. Themed via CSS custom properties

Light, dark, and system, with WCAG 2.1 AA contrast verified in both: 16.6:1 on light, 16.5:1 on dark. The palette is warm — cream `#FAF7F2`, bark `#1E1108`, clay `#7C4A2D` — not the cold blue-greys of most productivity apps. A paper-grain SVG overlay at 3% opacity (5% in dark) gives flat colour fields a sense of material. iOS-specific polish: no tap-highlight blob, text-size-adjust locked, safe-area-inset padding for the Dynamic Island, body-level `overscroll-behavior: contain` to kill the elastic shell-bounce.

### 4. Offline-first, sync optional

Dexie (IndexedDB wrapper) is the source of truth on every device. Supabase is opt-in cloud sync, gated behind passwordless magic-link auth. The sync logic is deliberately conservative: anonymous rows are claimed for the user on first sign-in; rows tagged with a different user_id (left over from a previous session on the same device) are never modified or pushed. RLS enforces user_id server-side as defence-in-depth.

The architecture means a potter without internet, an Apple account, or any trust in cloud services gets a fully working product. Sign-in is upsell, not gatekeeper.

<!-- IMAGE: 07-sign-in-light.png — Sign in screen showing "Cloud sync isn't enabled yet" friendly variant. Caption: "Offline is the default. Sign-in unlocks sync, never the product." -->

### 5. Itemised pricing, not opaque magic

A real piece is rarely "one slug of clay + one make-time." A mug has body clay, handle clay, sometimes slip. A teapot has body, lid, spout, handle. Make-time isn't one number either — throwing, trimming, glazing, decorating are separate buckets, sometimes at different rates if you charge for assistant time.

Schema v4 lets one piece carry `materials[]` and `time_entries[]` arrays, each with an optional per-line price/rate override. The Pricing Card breakdown enumerates every contribution and subtotals where needed. **Every price shows its working.**

```
Clay         450g · £2.50/kg · 15% trim   £1.32
Handle clay  80g  · £2.50/kg · 15% trim   £0.24
— MATERIALS TOTAL                         £1.56
Glaze        per piece                    £0.02
Firing       £12 ÷ 24 · 8% loss           £0.54
Make time    15 min · £20/hr              £5.00
Overhead     £250 ÷ 80 pieces/mo          £3.13
─────────────────────────────────────────────
Total                                    £10.23
```

<!-- IMAGE: 02-pricing-card-light.png — full Pricing Card with breakdown expanded. Caption: "The Pricing Card. Retail leads. Cost shows its working. Multipliers live below — drag wholesale or retail and prices recompute on the same frame." -->

### 6. Native where it matters

Capacitor wraps the existing web build for the iOS App Store — no React Native rewrite, the same code runs in both shells. But the native touches that distinguish a real iOS app from "website in a wrapper" are wired:

- **Native share sheet** via `@capacitor/share` with Web Share API fallback for browsers and clipboard fallback for the rest
- **Haptic feedback** (`@capacitor/haptics`) on the Share button — a light tap that signals "the action went through"
- **Status bar** that switches between light and dark mode in lockstep with the in-app theme toggle (`@capacitor/status-bar`)
- **Apple privacy manifest** declaring exactly what's collected (email if signed in; user content), what isn't (tracking, third-party SDKs), and the required-reason API usage (UserDefaults, FileTimestamp, DiskSpace, SystemBootTime)

The web bundle isn't bloated by Capacitor — every plugin import is dynamic and tree-shaken into a separate chunk that only loads on iOS.

---

## What shipped

Six screens, end-to-end, no dead ends:

- **Studio Setup** — onboarding wizard collecting clay price/kg, hourly rate, loss rate, trim loss, overhead/month, kiln cost/firing, unit preference. Sensible defaults so a new user can finish in under a minute.
- **Piece library** — list of saved pieces with live-recalculated retail prices. Change a studio setting and every card updates instantly. No "save" button, no stale numbers.
- **Add / Edit Piece** — name, materials (multi-line, each with optional cost override), time buckets (multi-line, each with optional rate override), pieces per kiln load, glaze picker linking to your saved recipes. Inline live preview of the three prices.
- **Pricing Card** — the hero. Retail leads at display-numeric 80px Playfair; wholesale and cost sit in a quieter section below. Multiplier sliders default to 2× × 2×, customise live. Collapsible itemised breakdown. Share button surfaces the native iOS share sheet.
- **Glaze calculator** — recipe builder with percentage validation (amber if total ≠ 100%, emerald if it is), plus a sub-screen with batch and per-piece cost calculations from applied dry weight. The per-piece number plugs directly into a linked piece's glaze cost.
- **Settings** — full edit of studio numbers, metric/imperial toggle that converts every displayed weight without re-entry (storage stays metric internally), theme toggle (light/dark/system), sync controls when signed in, "wipe local data" for shared devices.

<!-- IMAGE: 04-glaze-detail-light.png — Glaze Detail with the batch + per-piece calculator visible. Caption: "Glaze Detail: per kg, per 100g, batch cost, per-piece cost. The per-piece number plugs straight into a linked piece." -->

The numbers: **30 TypeScript files**, **173 KB gzipped** main bundle, **Dexie schema v4** with backwards-compatible auto-migration across four iterations, **20 entries** in the PWA precache (637 KiB), **zero runtime dependencies on external paid services** (Supabase is opt-in; the app works offline forever).

---

## Process artifacts

### Notebook page

<!-- IMAGE: notebook-page.jpg — handwritten sketch of the pricing formula, the screen flows, and the "wet hands at 9pm" line as it was first written. -->

The pricing formula started here, on a Tuesday after a kiln firing. Each component of total cost annotated by hand with what could vary and what couldn't.

### Build log excerpt

> *Week 2, day 4 —* Discovered React StrictMode was double-invoking my `setDraft` updater, which meant two near-simultaneous field blurs were both seeing `glazeId == null` and both creating new glaze rows. Result: duplicate "Tenmoku" entries in the database, only one of which had ingredients. Moved side effects out of the updater and added a serialized persist chain via a ref-held promise. Single-row creation now invariant. *This is the kind of bug that doesn't appear until your tests start matching real user behaviour.*

### Failed direction

<!-- IMAGE: dashboard-rejected.png — early screenshot of the rejected stat-tile dashboard with 3 small cards across the top. Caption: "Killed. The stat tiles competed with the action cards below them — no number dominated, nothing was a hero. Replaced with a single 64px Playfair retail-average headline and the supporting numbers inline below it." -->

---

## Outcome

Publishing this case study during the App Store review window. The page will be updated as milestones land.

| Status | Milestone |
|---|---|
| ✅ Shipped | Web PWA live at [tarebook1.netlify.app](https://tarebook1.netlify.app) |
| 🟡 In review | iOS App Store submission |
| 🟡 Validating | 20+ "yes" responses on Instagram before the Pro paywall ships |

**Goal numbers.** A reachable audience over 12 months, with consistent Instagram content and word of mouth, is 500–2000 free users. Conversion to Pro at 5–10% gives 25–200 paying users. Pro tier is £3.99/month or £200 lifetime; the lifetime cap may be limited to the first 100 users as a Founders' tier.

Not life-changing money. But recurring revenue from a real audience that pays because the tool genuinely saves them time and makes them more money. The kind of validation that's hard to fake.

> *Quote placeholder — first user testimonial lands here once review is open.*

---

## Links

- **Live** → [tarebook1.netlify.app](https://tarebook1.netlify.app)
- **Source** → [github.com/Sh3rry-W4Z-H3R3/GLAZE-CALC](https://github.com/Sh3rry-W4Z-H3R3/GLAZE-CALC)
- **App Store** → *Coming soon*

[← Back to work](./) · [Next case study →](./)
