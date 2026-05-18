const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const dir = process.cwd();
fs.readdirSync(dir).forEach((file) => {
  if (/\.(png|jpe?g)$/i.test(file)) {
    const output = path.join(dir, `${path.parse(file).name}.webp`);
    sharp(path.join(dir, file))
      .toFile(output)
      .then(() =>
        console.log(`✅ Converted: ${file} -> ${path.basename(output)}`),
      )
      .catch((err) => console.error(`❌ Error converting ${file}:`, err));
  }
});
