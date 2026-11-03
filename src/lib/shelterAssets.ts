import type { Request } from "express";
import fs from "node:fs";
import path from "node:path";

const shelterAssetRoot = path.resolve(process.cwd(), "assets");

function resolveAvailableAsset(image: string) {
  if (!image.startsWith("/assets/")) return image;

  const relativePath = decodeURIComponent(image.slice("/assets/".length));
  const resolvedPath = path.resolve(shelterAssetRoot, relativePath);
  const isInsideAssetRoot =
    resolvedPath === shelterAssetRoot || resolvedPath.startsWith(`${shelterAssetRoot}${path.sep}`);

  if (isInsideAssetRoot && fs.existsSync(resolvedPath)) return image;

  return "/assets/cat-dog%20illustration.png";
}

export function resolveShelterAnimalImage(req: Request, imageReference: string) {
  const image = resolveAvailableAsset(imageReference.trim());

  if (image.startsWith("/")) {
    return `${req.protocol}://${req.get("host")}${image}`;
  }

  return image;
}

export function resolveShelterAnimalGalleryImage(
  req: Request,
  animalId: string,
  imageId: string,
  imageReference: string
) {
  if (!imageReference.trim().toLowerCase().startsWith("data:image/")) {
    return resolveShelterAnimalImage(req, imageReference);
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}/api/animals/shelter/${encodeURIComponent(animalId)}/images/${encodeURIComponent(imageId)}`;
}
