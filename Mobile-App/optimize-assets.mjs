import { readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const assetsRoot = await realpath(path.join(process.cwd(), "assets"));
const supportedExtensions = new Set([".jpeg", ".jpg", ".png"]);

async function collectImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectImages(entryPath);
      return supportedExtensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
    })
  );
  return nested.flat();
}

const images = await collectImages(assetsRoot);
let optimizedCount = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const imagePath of images) {
  const resolvedPath = await realpath(imagePath);
  if (!resolvedPath.startsWith(`${assetsRoot}${path.sep}`)) {
    throw new Error(`Refusing to optimize an image outside the assets directory: ${resolvedPath}`);
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  const beforeBytes = (await stat(resolvedPath)).size;
  const sourceImage = await readFile(resolvedPath);
  let pipeline = sharp(sourceImage).rotate();

  if (extension === ".jpg" || extension === ".jpeg") {
    pipeline = pipeline
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  const optimizedImage = await pipeline.toBuffer();
  const optimizedBytes = optimizedImage.byteLength;
  totalBefore += beforeBytes;

  if (optimizedBytes + 1024 < beforeBytes) {
    await writeFile(resolvedPath, optimizedImage);
    totalAfter += optimizedBytes;
    optimizedCount += 1;
  } else {
    totalAfter += beforeBytes;
  }

}

const savedBytes = totalBefore - totalAfter;
console.log(
  `Optimized ${optimizedCount} of ${images.length} images; saved ${(savedBytes / 1024 / 1024).toFixed(2)} MB ` +
    `(${(totalBefore / 1024 / 1024).toFixed(2)} MB to ${(totalAfter / 1024 / 1024).toFixed(2)} MB).`
);
