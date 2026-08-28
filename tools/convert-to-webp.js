/* Convert PNG/JPEG to WebP, in place, recursively.
 *
 *   node tools/convert-to-webp.js <dir> [quality]
 *   node tools/convert-to-webp.js dist/imgs-craft 90
 *
 * Skips a file when its .webp already exists, so re-running is cheap and
 * won't re-encode (and re-degrade) images that are already converted.
 * Originals are never deleted — they're relocated to /src-images by hand.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const rootDir = process.argv[2];
const quality = Number(process.argv[3]) || 90;

if (!rootDir || !fs.existsSync(rootDir)) {
  console.error("Usage: node tools/convert-to-webp.js <dir> [quality]");
  process.exit(1);
}

let converted = 0;
let skipped = 0;

function convertImages(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file === "node_modules") return;
      convertImages(fullPath); // Recurse into subdirectories
    } else if (/\.(png|jpe?g)$/i.test(file)) {
      const output = path.join(dir, `${path.parse(file).name}.webp`);
      if (fs.existsSync(output)) {
        skipped++;
        return;
      }
      sharp(fullPath)
        .webp({ quality })
        .toFile(output)
        .then(() => {
          converted++;
          console.log(`✅ ${fullPath} -> ${output}`);
        })
        .catch((err) => console.error(`❌ Error converting ${fullPath}:`, err));
    }
  });
}

convertImages(rootDir);
process.on("exit", () =>
  console.log(`\n${converted} converted, ${skipped} already had a .webp`)
);
