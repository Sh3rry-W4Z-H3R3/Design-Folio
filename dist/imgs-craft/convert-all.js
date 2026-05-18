const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();

function convertImages(dir) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      convertImages(fullPath); // Recurse into subdirectories
    } else if (/\.(png|jpe?g)$/i.test(file)) {
      const output = path.join(dir, `${path.parse(file).name}.webp`);
      sharp(fullPath)
        .toFile(output)
        .then(() => console.log(`✅ Converted: ${fullPath} -> ${output}`))
        .catch((err) => console.error(`❌ Error converting ${fullPath}:`, err));
    }
  });
}

convertImages(rootDir);
