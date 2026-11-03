import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  resolveShelterAnimalGalleryImage,
  resolveShelterAnimalImage,
} from "../lib/shelterAssets";

export const animalRouter = Router();

animalRouter.get("/photo", (req, res) => {
  const imagePath = typeof req.query.path === "string" ? req.query.path : "";

  if (!imagePath.startsWith("/assets/")) {
    res.status(400).json({ error: "A valid animal asset path is required" });
    return;
  }

  res.redirect(resolveShelterAnimalImage(req, imagePath));
});

function serializeShelterAnimal(req: Parameters<typeof resolveShelterAnimalImage>[0], animal: {
  id: string;
  personalityJson: string;
  imageDataUri: string;
  images: Array<{
    id: string;
    dataUri: string;
    mimeType: string;
    fileName: string | null;
    sortOrder: number;
  }>;
}) {
  const { personalityJson, ...animalData } = animal;
  const primaryGalleryImage = animal.images[0];
  const primaryImage =
    animal.imageDataUri.trim().toLowerCase().startsWith("data:image/") && primaryGalleryImage
      ? resolveShelterAnimalGalleryImage(req, animal.id, primaryGalleryImage.id, primaryGalleryImage.dataUri)
      : resolveShelterAnimalImage(req, animal.imageDataUri);

  return {
    ...animalData,
    imageDataUri: primaryImage,
    images: animal.images.map((image) => ({
      ...image,
      dataUri: resolveShelterAnimalGalleryImage(req, animalData.id, image.id, image.dataUri),
    })),
    personality: JSON.parse(personalityJson) as string[],
  };
}

animalRouter.get("/shelter", async (_req, res, next) => {
  try {
    const animals = await prisma.shelterAnimal.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { name: "asc" },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    res.json({
      animals: animals.map((animal) => serializeShelterAnimal(_req, animal)),
    });
  } catch (e) {
    next(e);
  }
});

animalRouter.get("/shelter/:id/images/:imageId", async (req, res, next) => {
  try {
    const image = await prisma.shelterAnimalImage.findFirst({
      where: {
        animalId: req.params.id,
        id: req.params.imageId,
      },
    });

    if (!image) {
      res.status(404).json({ error: "Animal photo was not found" });
      return;
    }

    const dataUriMatch = /^data:([^;,]+);base64,(.+)$/is.exec(image.dataUri.trim());

    if (dataUriMatch) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.type(dataUriMatch[1]);
      res.send(Buffer.from(dataUriMatch[2], "base64"));
      return;
    }

    res.redirect(resolveShelterAnimalImage(req, image.dataUri));
  } catch (e) {
    next(e);
  }
});

animalRouter.get("/shelter/:id", async (req, res, next) => {
  try {
    const animal = await prisma.shelterAnimal.findFirst({
      where: {
        id: req.params.id,
        status: "AVAILABLE",
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!animal) {
      res.status(404).json({ error: "Animal was not found or is not available for adoption" });
      return;
    }

    res.json({
      animal: serializeShelterAnimal(req, animal),
    });
  } catch (e) {
    next(e);
  }
});
