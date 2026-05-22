# TareBook folio assets

Everything needed to ship the case study on your design website.

## Contents

| File | What it is |
|---|---|
| [`case-study.md`](./case-study.md) | Long-form prose ready to drop into your CMS. 9 sections with image placeholders. |
| [`index-card.md`](./index-card.md) | Five short-form variants — folio index card, LinkedIn post, IG bio, Twitter thread opener, recruiter-facing summary. Pick what fits the surface. |
| [`capture-screenshots.mjs`](./capture-screenshots.mjs) | Puppeteer script that seeds Dexie with demo data + saves the 8 PNGs below. Re-runnable any time the UI changes. |
| [`screenshots/`](./screenshots/) | 8 PNGs at iPhone 15 Pro 3× (1179×2556). Drop into the case study where the `<!-- IMAGE: … -->` placeholders are. |

## Screenshot inventory

| File | Where it goes in the case study |
|---|---|
| `01-home-light.png` | Section 5 (Design intent → "Editorial, not dashboard") + Section 2 hero alt |
| `01-home-dark.png` | Section 5 (Design intent → "Themed via CSS custom properties") — side by side with the light home |
| `02-pricing-card-light.png` | Section 1 hero artifact + Section 5 ("Itemised pricing") |
| `03-add-piece-light.png` | Section 5 ("Mobile-first, one-handed") |
| `04-glaze-detail-light.png` | Section 6 ("What shipped" — the glaze calculator example) |
| `05-glaze-edit-dark.png` | Section 6 — proves dark mode works on form-heavy screens too |
| `06-settings-dark.png` | Section 5 ("Themed via CSS custom properties") — shows the theme toggle row + units segmented control |
| `07-sign-in-light.png` | Section 5 ("Offline-first, sync optional") — shows the friendly "cloud sync isn't enabled yet" variant |

## Re-running the captures

```bash
# In one terminal:
cd ../tarebook
npm run dev

# In another:
cd ../folio
node capture-screenshots.mjs
```

Outputs overwrite `screenshots/*.png`. Run after every UI change worth documenting.

## App Store-specific captures

The current PNGs are 1179×2556 (iPhone 15 Pro). The App Store strictly requires **1290×2796** for the iPhone 6.9" display class. To regenerate at that size, edit one line in `capture-screenshots.mjs`:

```js
// Change:
const VIEWPORT = { width: 393, height: 852, deviceScaleFactor: 3 };
// To (iPhone 16 Pro Max logical):
const VIEWPORT = { width: 430, height: 932, deviceScaleFactor: 3 };
```

Then re-run. Apple will accept the existing ones if you upload them to a smaller-device class slot (6.5"), but 6.9" is mandatory and slightly bigger.

## Hosting recommendations for the folio page

- Optimise PNGs with [`squoosh.app`](https://squoosh.app/) before upload — convert to `webp` at quality ~80, expect ~30 KB each
- Lazy-load every image below the fold
- Set explicit `width` + `height` attrs to prevent CLS
- The hero image (`02-pricing-card-light.png`) should be the OG image too — declare it in your `<head>`:

```html
<meta property="og:image" content="https://yoursite.com/work/tarebook/og.png" />
<meta property="og:image:width" content="1179" />
<meta property="og:image:height" content="2556" />
```
