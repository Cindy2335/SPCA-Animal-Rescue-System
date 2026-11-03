import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { canViewAll } from "../lib/access";
import { getRequestUser } from "../lib/authToken";

export const surrenderRouter = Router();

const surrenderSelect = {
  id: true,
  isAnonymous: true,
  ownerId: true,
  ownerName: true,
  email: true,
  phone: true,
  address: true,
  preferredContactMethod: true,
  animalName: true,
  animalType: true,
  breed: true,
  age: true,
  sex: true,
  color: true,
  vaccinated: true,
  sterilized: true,
  microchipped: true,
  healthNotes: true,
  behaviorNotes: true,
  reason: true,
  urgency: true,
  scheduledIntakeAt: true,
  scheduledIntakeNote: true,
  completedAt: true,
  shelterAnimalId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  },
  images: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      dataUri: true,
      mimeType: true,
      fileName: true,
      sortOrder: true,
    },
  },
} as const;

const surrenderWithImagesInclude = {
  images: {
    orderBy: { sortOrder: "asc" as const },
  },
};

type SurrenderWithImages = Prisma.AnimalSurrenderRequestGetPayload<{
  include: typeof surrenderWithImagesInclude;
}>;

const surrenderStatuses = [
  "SUBMITTED",
  "CONTACTED",
  "INTAKE_SCHEDULED",
  "COMPLETED",
] as const;

const imageDataUriSchema = z
  .string()
  .trim()
  .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/)
  .max(8_000_000);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const optionalRequiredText = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(min).max(max).optional()
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().max(180).optional()
);

const createSurrenderSchema = z
  .object({
    anonymous: z.boolean().default(false),
    ownerName: optionalRequiredText(2, 160),
    email: optionalEmail,
    phone: optionalRequiredText(6, 60),
    address: optionalRequiredText(5, 300),
    preferredContactMethod: z.enum(["Phone", "Email", "WhatsApp"]).default("Phone"),
    animalName: optionalText(120),
    animalType: z.enum(["Dog", "Cat", "Other"]),
    breed: optionalText(120),
    age: optionalText(80),
    sex: optionalText(80),
    color: optionalText(80),
    vaccinated: z.boolean().default(false),
    sterilized: z.boolean().default(false),
    microchipped: z.boolean().default(false),
    healthNotes: optionalText(800),
    behaviorNotes: optionalText(800),
    reason: z.string().trim().min(20).max(1200),
    urgency: z.enum(["This week", "Within two weeks", "This month", "Flexible"]),
    images: z
      .array(
        z.object({
          dataUri: imageDataUriSchema,
          fileName: optionalText(180),
          mimeType: optionalText(80),
        })
      )
      .max(6)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.anonymous) return;

    for (const field of ["ownerName", "email", "phone", "address"] as const) {
      if (!value[field]) {
        context.addIssue({
          code: "custom",
          message: "Required unless submitting anonymously",
          path: [field],
        });
      }
    }
  });

const updateSurrenderStatusSchema = z.object({
  status: z.enum(surrenderStatuses),
});

const scheduleSurrenderIntakeSchema = z.object({
  scheduledIntakeAt: z.coerce.date(),
  scheduledIntakeNote: optionalText(500),
});

function cleanText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeAnimalType(type: string) {
  return type === "Dog" || type === "Cat" || type === "Other" ? type : "Other";
}

function fallbackImageForType(_type: string) {
  return "/assets/cat-dog%20illustration.png";
}

function inferImageMimeType(imageReference: string, mimeType?: string | null) {
  if (mimeType?.trim()) {
    return mimeType.trim();
  }

  const dataUriMatch = /^data:([^;,]+)[;,]/i.exec(imageReference);
  if (dataUriMatch?.[1]) {
    return dataUriMatch[1];
  }

  const cleanReference = imageReference.split(/[?#]/)[0].toLowerCase();

  if (cleanReference.endsWith(".png")) return "image/png";
  if (cleanReference.endsWith(".webp")) return "image/webp";
  if (cleanReference.endsWith(".gif")) return "image/gif";
  if (cleanReference.endsWith(".svg")) return "image/svg+xml";

  return "image/jpeg";
}

function surrenderAnimalName(surrender: SurrenderWithImages) {
  return cleanText(
    surrender.animalName,
    cleanText(surrender.breed, `Surrendered ${normalizeAnimalType(surrender.animalType)}`)
  );
}

function surrenderStory(surrender: SurrenderWithImages) {
  return [
    `${surrenderAnimalName(surrender)} was surrendered by ${surrender.ownerName}.`,
    `Reason: ${surrender.reason}`,
    surrender.healthNotes ? `Health notes: ${surrender.healthNotes}` : "",
    surrender.behaviorNotes ? `Behaviour notes: ${surrender.behaviorNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildShelterAnimalCreateData(surrender: SurrenderWithImages): Prisma.ShelterAnimalCreateInput {
  const type = normalizeAnimalType(surrender.animalType);
  const fallbackImage = fallbackImageForType(type);
  const defaultImage = {
    dataUri: fallbackImage,
    fileName: null,
    mimeType: inferImageMimeType(fallbackImage),
    sortOrder: 0,
  };
  const sourceImages = surrender.images.length
    ? surrender.images
    : [defaultImage];
  const primaryImage = sourceImages[0] ?? defaultImage;
  const personality = [
    "New intake",
    surrender.microchipped ? "Microchipped" : "",
    surrender.sterilized ? "Sterilised" : "",
  ].filter(Boolean);

  return {
    age: cleanText(surrender.age, "Unknown"),
    bestFor: "Assessment pending",
    breed: cleanText(surrender.breed, type === "Other" ? "Unknown" : "Mixed"),
    energy: "Assessment pending",
    id: `pet-${randomUUID()}`,
    imageDataUri: primaryImage.dataUri,
    imageMimeType: inferImageMimeType(primaryImage.dataUri, primaryImage.mimeType),
    images: {
      create: sourceImages.map((image, index) => ({
        dataUri: image.dataUri,
        fileName: surrender.isAnonymous ? null : image.fileName,
        mimeType: inferImageMimeType(image.dataUri, image.mimeType),
        sortOrder: index,
      })),
    },
    location: "SPCA Intake",
    name: surrenderAnimalName(surrender),
    personalityJson: JSON.stringify(personality.length ? personality : ["New intake"]),
    sex: cleanText(surrender.sex, "Unknown"),
    size: "Assessment pending",
    status: "AVAILABLE",
    story: surrenderStory(surrender),
    type,
    vaccinated: surrender.vaccinated,
  };
}

surrenderRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSurrenderSchema.safeParse(req.body);
    const auth = await getRequestUser(req);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    const {
      anonymous,
      images,
      ownerName,
      email,
      phone,
      address,
      ...data
    } = parsed.data;
    const surrender = await prisma.animalSurrenderRequest.create({
      data: {
        ...data,
        isAnonymous: anonymous,
        ownerId: anonymous ? null : auth.user?.id ?? null,
        ownerName: anonymous ? "Anonymous" : ownerName ?? "",
        email: anonymous ? "" : email ?? "",
        phone: anonymous ? "" : phone ?? "",
        address: anonymous ? "" : address ?? "",
        images: images?.length
          ? {
              create: images.map((image, index) => ({
                dataUri: image.dataUri,
                fileName: anonymous ? null : image.fileName,
                mimeType:
                  image.mimeType ??
                  image.dataUri.match(/^data:([^;]+);base64,/)?.[1] ??
                  "image/jpeg",
                sortOrder: index,
              })),
            }
          : undefined,
      },
      select: surrenderSelect,
    });

    res.status(201).json({ surrender });
  } catch (e) {
    next(e);
  }
});

surrenderRouter.get("/", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);
    const ownerId =
      typeof req.query.ownerId === "string" && req.query.ownerId.trim()
        ? req.query.ownerId.trim()
        : undefined;

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to view surrender requests" });
      return;
    }

    const admin = canViewAll(auth.user.role);

    if (!admin && ownerId && ownerId !== auth.user.id) {
      res.status(403).json({ error: "You can only view your own surrender requests" });
      return;
    }

    const surrenders = await prisma.animalSurrenderRequest.findMany({
      where: admin ? (ownerId ? { ownerId } : undefined) : { ownerId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: surrenderSelect,
    });

    res.json({ surrenders });
  } catch (e) {
    next(e);
  }
});

surrenderRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const parsed = updateSurrenderStatusSchema.safeParse(req.body);
    const auth = await getRequestUser(req);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user || !canViewAll(auth.user.role)) {
      res.status(403).json({ error: "Only admins can update surrender requests" });
      return;
    }

    const existingSurrender = await prisma.animalSurrenderRequest.findUnique({
      where: { id: req.params.id },
      include: surrenderWithImagesInclude,
    });

    if (!existingSurrender) {
      res.status(404).json({ error: "Surrender request not found" });
      return;
    }

    if (existingSurrender.status === "COMPLETED" && parsed.data.status !== "COMPLETED") {
      res.status(400).json({ error: "Completed intakes cannot be moved back from the surrender workflow" });
      return;
    }

    if (parsed.data.status === "COMPLETED") {
      const result = await prisma.$transaction(async (tx) => {
        let animal = existingSurrender.shelterAnimalId
          ? await tx.shelterAnimal.findUnique({ where: { id: existingSurrender.shelterAnimalId } })
          : null;

        if (!animal) {
          animal = await tx.shelterAnimal.create({
            data: buildShelterAnimalCreateData(existingSurrender),
          });
        }

        const surrender = await tx.animalSurrenderRequest.update({
          where: { id: req.params.id },
          data: {
            completedAt: existingSurrender.completedAt ?? new Date(),
            shelterAnimalId: animal.id,
            status: "COMPLETED",
          },
          select: surrenderSelect,
        });

        return { animal, surrender };
      });

      res.json(result);
      return;
    }

    const surrender = await prisma.animalSurrenderRequest.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      select: surrenderSelect,
    });

    res.json({ surrender });
  } catch (e) {
    next(e);
  }
});

surrenderRouter.patch("/:id/intake-schedule", async (req, res, next) => {
  try {
    const parsed = scheduleSurrenderIntakeSchema.safeParse(req.body);
    const auth = await getRequestUser(req);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to schedule your surrender intake" });
      return;
    }

    const existingSurrender = await prisma.animalSurrenderRequest.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        ownerId: true,
        status: true,
      },
    });

    if (!existingSurrender) {
      res.status(404).json({ error: "Surrender request not found" });
      return;
    }

    if (!canViewAll(auth.user.role) && existingSurrender.ownerId !== auth.user.id) {
      res.status(403).json({ error: "You can only schedule your own surrender request" });
      return;
    }

    if (existingSurrender.status !== "CONTACTED" && existingSurrender.status !== "INTAKE_SCHEDULED") {
      res.status(400).json({ error: "The shelter must accept this request before intake can be scheduled" });
      return;
    }

    const surrender = await prisma.animalSurrenderRequest.update({
      where: { id: req.params.id },
      data: {
        scheduledIntakeAt: parsed.data.scheduledIntakeAt,
        scheduledIntakeNote: parsed.data.scheduledIntakeNote,
        status: "INTAKE_SCHEDULED",
      },
      select: surrenderSelect,
    });

    res.json({ surrender });
  } catch (e) {
    next(e);
  }
});
