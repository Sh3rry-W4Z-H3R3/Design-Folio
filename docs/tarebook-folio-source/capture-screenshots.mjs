/**
 * TareBook folio screenshot capture.
 *
 * Drives a headless Chrome at iPhone 15 Pro dimensions (393×852 logical,
 * captured at 3x = 1179×2556 physical), seeds Dexie with realistic demo
 * data, walks through every screen and saves a PNG.
 *
 * Run from this folder:
 *
 *   1. Start the dev server in another terminal: `cd ../tarebook && npm run dev`
 *   2. Run this script: `node capture-screenshots.mjs`
 *
 * Output → ./screenshots/*.png
 *
 * Re-run any time the UI changes.
 */
import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "screenshots");
const BASE_URL = process.env.TAREBOOK_URL ?? "http://localhost:5173";

// iPhone 15 Pro logical dimensions
const VIEWPORT = { width: 393, height: 852, deviceScaleFactor: 3 };

const STUDIO_DEFAULTS = {
  user_id: null,
  clay_price_kg: 2.5,
  hourly_rate: 20,
  loss_rate: 0.08,
  trim_loss: 0.15,
  overhead_monthly: 250,
  pieces_monthly: 80,
  kiln_cost_per_firing: 12,
  unit: "metric",
  updated_at: Date.now(),
};

const SEED_GLAZE_INGREDIENTS = [
  { name: "Custer Feldspar", percentage: 40, cost_per_kg: 3.5 },
  { name: "Silica", percentage: 28, cost_per_kg: 2.2 },
  { name: "Whiting", percentage: 16, cost_per_kg: 1.8 },
  { name: "EPK Kaolin", percentage: 8, cost_per_kg: 4.0 },
  { name: "Red Iron Oxide", percentage: 8, cost_per_kg: 12.0 },
];

const SEED_PIECES = [
  {
    name: "Stoneware mug",
    clay_weight_g: 530,
    make_time_mins: 18,
    pieces_per_load: 24,
    materials: [
      { id: "m1", name: "Body clay", weight_g: 450, price_per_kg: null },
      { id: "m2", name: "Handle clay", weight_g: 80, price_per_kg: null },
    ],
    time_entries: [
      { id: "t1", name: "Throwing", minutes: 10, hourly_rate: null },
      { id: "t2", name: "Trimming + handle", minutes: 8, hourly_rate: null },
    ],
  },
  {
    name: "Espresso cup",
    clay_weight_g: 220,
    make_time_mins: 9,
    pieces_per_load: 36,
    materials: [
      { id: "m3", name: "Body clay", weight_g: 220, price_per_kg: null },
    ],
    time_entries: [
      { id: "t3", name: "Throwing", minutes: 6, hourly_rate: null },
      { id: "t4", name: "Trimming", minutes: 3, hourly_rate: null },
    ],
  },
];

async function setupDexie(page) {
  // Navigate to a real page first so the IndexedDB API is accessible
  // (about:blank denies storage APIs).
  await page.goto(BASE_URL, { waitUntil: "networkidle2" });
  await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const d of dbs) {
      if (d.name) {
        await new Promise((res) => {
          const req = indexedDB.deleteDatabase(d.name);
          req.onsuccess = res;
          req.onerror = res;
          req.onblocked = res;
        });
      }
    }
    localStorage.clear();
  });
  // Re-navigate so the app boots fresh (it'll redirect to /setup).
  await page.goto(BASE_URL, { waitUntil: "networkidle2" });
  await page.waitForSelector("h1");
}

async function setTheme(page, choice) {
  await page.evaluate((c) => {
    if (c === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("tarebook:theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("tarebook:theme", "light");
    }
  }, choice);
  // Allow the body's color transition to settle
  await new Promise((r) => setTimeout(r, 250));
}

async function seedThroughForm(page) {
  // Click "Save & continue" on the StudioSetup screen with defaults
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Save")
    );
    btn?.click();
  });
  await page.waitForSelector("h1", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  // Now seed glaze + pieces directly via IndexedDB raw write — bypasses the
  // UI for speed, mirrors what Dexie would write.
  await page.evaluate(
    async (ingredients, pieces) => {
      const open = indexedDB.open("tarebook");
      const db = await new Promise((res, rej) => {
        open.onsuccess = () => res(open.result);
        open.onerror = () => rej(open.error);
      });
      const now = Date.now();
      const tx1 = db.transaction("glazes", "readwrite");
      const cpkg = ingredients.reduce(
        (s, i) => s + (i.percentage / 100) * i.cost_per_kg,
        0
      );
      tx1.objectStore("glazes").add({
        user_id: null,
        name: "Tenmoku",
        cost_per_100g: cpkg / 10,
        ingredients,
        created_at: now - 60000,
        updated_at: now,
      });
      await new Promise((res) => (tx1.oncomplete = res));

      const tx2 = db.transaction("pieces", "readwrite");
      let offset = 30000;
      for (const p of pieces) {
        tx2.objectStore("pieces").add({
          user_id: null,
          name: p.name,
          clay_weight_g: p.clay_weight_g,
          make_time_mins: p.make_time_mins,
          pieces_per_load: p.pieces_per_load,
          glaze_cost_manual: 0.06,
          glaze_id: 1,
          glaze_applied_g: 18,
          materials: p.materials,
          time_entries: p.time_entries,
          created_at: now - offset,
          updated_at: now,
        });
        offset -= 10000;
      }
      await new Promise((res) => (tx2.oncomplete = res));
    },
    SEED_GLAZE_INGREDIENTS,
    SEED_PIECES
  );
}

async function navigate(page, path) {
  await page.goto(BASE_URL + path, { waitUntil: "networkidle2" });
  // Wait for layout to settle
  await new Promise((r) => setTimeout(r, 400));
}

async function capture(page, filename) {
  const file = resolve(OUT_DIR, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  →", filename);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log("Launching Chromium…");
  const browser = await puppeteer.launch({
    defaultViewport: VIEWPORT,
    // Show in headed mode if you want to watch: --no-sandbox  + headless: false
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  console.log("Seeding demo data…");
  await setupDexie(page);
  await seedThroughForm(page);

  // The shots
  const shots = [
    { path: "/", theme: "light", file: "01-home-light.png" },
    { path: "/", theme: "dark", file: "01-home-dark.png" },
    { path: "/pieces/1", theme: "light", file: "02-pricing-card-light.png", action: "expand-breakdown" },
    { path: "/pieces/1/edit", theme: "light", file: "03-add-piece-light.png" },
    { path: "/glazes/1", theme: "light", file: "04-glaze-detail-light.png" },
    { path: "/glazes/1/edit", theme: "dark", file: "05-glaze-edit-dark.png" },
    { path: "/settings", theme: "dark", file: "06-settings-dark.png" },
    { path: "/sign-in", theme: "light", file: "07-sign-in-light.png" },
  ];

  for (const shot of shots) {
    console.log("Capturing:", shot.file);
    await navigate(page, shot.path);
    await setTheme(page, shot.theme);
    if (shot.action === "expand-breakdown") {
      await page.evaluate(() => {
        const summary = document.querySelector("details summary");
        summary?.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    }
    await capture(page, shot.file);
  }

  await browser.close();
  console.log("\nDone. Screenshots saved to:", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
