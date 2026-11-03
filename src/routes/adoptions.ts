import { Router } from "express";
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { canHandleFieldCases, canViewAll } from "../lib/access";
import { getRequestUser } from "../lib/authToken";
import {
  resolveShelterAnimalGalleryImage,
  resolveShelterAnimalImage,
} from "../lib/shelterAssets";

export const adoptionRouter = Router();

const applicationSelect = {
  id: true,
  animalId: true,
  applicantId: true,
  applicantName: true,
  email: true,
  phone: true,
  address: true,
  housingType: true,
  hasYard: true,
  hasOtherPets: true,
  otherPetsDetails: true,
  experience: true,
  reason: true,
  schedule: true,
  householdAgreement: true,
  status: true,
  assignedAgentId: true,
  inspectionAssignedAt: true,
  inspectionCompletedAt: true,
  inspectionRecommendation: true,
  inspectionPropertySafe: true,
  inspectionSecureYard: true,
  inspectionPetsCompatible: true,
  inspectionNotes: true,
  pickupScheduledAt: true,
  pickupNote: true,
  adoptedAt: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    orderBy: { documentType: "asc" },
    select: {
      id: true,
      documentType: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
  animal: {
    select: {
      id: true,
      name: true,
      type: true,
      age: true,
      sex: true,
      breed: true,
      size: true,
      energy: true,
      bestFor: true,
      location: true,
      vaccinated: true,
      personalityJson: true,
      story: true,
      imageDataUri: true,
      imageMimeType: true,
      status: true,
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
    },
  },
  applicant: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  },
  assignedAgent: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  },
} as const;

type AdoptionApplicationPayload = Prisma.AdoptionApplicationGetPayload<{
  select: typeof applicationSelect;
}>;

function serializeApplication(
  req: Request,
  application: AdoptionApplicationPayload,
  includeDocumentMetadata = false
) {
  const { documents, ...applicationWithoutDocuments } = application;

  return {
    ...applicationWithoutDocuments,
    ...(includeDocumentMetadata ? { documents } : {}),
    animal: {
      ...application.animal,
      imageDataUri:
        application.animal.imageDataUri.trim().toLowerCase().startsWith("data:image/") &&
        application.animal.images[0]
          ? resolveShelterAnimalGalleryImage(
              req,
              application.animal.id,
              application.animal.images[0].id,
              application.animal.images[0].dataUri
            )
          : resolveShelterAnimalImage(req, application.animal.imageDataUri),
      images: application.animal.images.map((image) => ({
        ...image,
        dataUri: resolveShelterAnimalGalleryImage(
          req,
          application.animal.id,
          image.id,
          image.dataUri
        ),
      })),
    },
  };
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_DATA_URI_MAX_LENGTH = 7_100_000;
const adoptionDocumentTypes = ["IDENTITY", "PROOF_OF_RESIDENCE"] as const;
const adoptionDocumentMimeTypes = ["application/pdf", "image/jpeg", "image/png"] as const;

function inspectDocumentDataUri(dataUri: string) {
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
    dataUri
  );

  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  const hasExpectedSignature =
    (mimeType === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-") ||
    (mimeType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mimeType === "image/png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));

  return {
    bytes: bytes.length,
    hasExpectedSignature,
    mimeType,
  };
}

function documentFileNameMatchesMimeType(fileName: string, mimeType: string) {
  const normalizedName = fileName.trim().toLowerCase();

  if (mimeType === "application/pdf") return normalizedName.endsWith(".pdf");
  if (mimeType === "image/jpeg") {
    return normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg");
  }
  if (mimeType === "image/png") return normalizedName.endsWith(".png");

  return false;
}

const adoptionDocumentSchema = z
  .object({
    dataUri: z.string().trim().max(DOCUMENT_DATA_URI_MAX_LENGTH),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine((name) => !/[\/\\\0\r\n]/.test(name), "File name contains invalid characters"),
    mimeType: z.enum(adoptionDocumentMimeTypes).optional(),
  })
  .superRefine((document, context) => {
    const inspected = inspectDocumentDataUri(document.dataUri);

    if (!inspected) {
      context.addIssue({
        code: "custom",
        message: "Upload a PDF, JPEG, or PNG file",
        path: ["dataUri"],
      });
      return;
    }

    if (!inspected.hasExpectedSignature) {
      context.addIssue({
        code: "custom",
        message: "The file contents do not match the declared file type",
        path: ["dataUri"],
      });
    }

    if (inspected.bytes > DOCUMENT_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        message: "File must be 5 MB or smaller",
        path: ["dataUri"],
      });
    }

    if (document.mimeType && document.mimeType !== inspected.mimeType) {
      context.addIssue({
        code: "custom",
        message: "The supplied MIME type does not match the uploaded file",
        path: ["mimeType"],
      });
    }

    if (!documentFileNameMatchesMimeType(document.fileName, inspected.mimeType)) {
      context.addIssue({
        code: "custom",
        message: "File extension does not match the uploaded file type",
        path: ["fileName"],
      });
    }
  });

type AdoptionDocumentInput = z.infer<typeof adoptionDocumentSchema>;

function buildAdoptionDocument(
  documentType: (typeof adoptionDocumentTypes)[number],
  document: AdoptionDocumentInput
) {
  const inspected = inspectDocumentDataUri(document.dataUri);

  if (!inspected) {
    throw new Error("Validated adoption document could not be decoded");
  }

  return {
    dataUri: document.dataUri,
    documentType,
    fileName: document.fileName,
    mimeType: inspected.mimeType,
    sizeBytes: inspected.bytes,
  };
}

const createApplicationSchema = z.object({
  animalId: z.string().trim().min(1).max(100),
  applicantName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(6).max(60),
  address: z.string().trim().min(5).max(300),
  housingType: z.string().trim().min(2).max(120),
  hasYard: z.boolean(),
  hasOtherPets: z.boolean(),
  otherPetsDetails: optionalText(500),
  experience: optionalText(800),
  reason: z.string().trim().min(20).max(1200),
  schedule: optionalText(800),
  householdAgreement: z.literal(true),
  identityDocument: adoptionDocumentSchema,
  proofOfResidenceDocument: adoptionDocumentSchema,
});

const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "INSPECTION_REQUIRED",
    "INSPECTION_ASSIGNED",
    "INSPECTION_COMPLETED",
    "APPROVED",
    "DECLINED",
    "PICKUP_SCHEDULED",
    "ADOPTED",
  ]),
});

const assignInspectionSchema = z.object({
  assignedAgentId: z.string().trim().min(1),
});

const inspectionReportSchema = z.object({
  recommendation: z.enum(["APPROVE", "DECLINE", "FOLLOW_UP"]),
  propertySafe: z.boolean(),
  secureYard: z.boolean(),
  petsCompatible: z.boolean(),
  notes: z.string().trim().min(20).max(3000),
});

const pickupScheduleSchema = z.object({
  pickupScheduledAt: z.coerce.date(),
  pickupNote: optionalText(500),
});

adoptionRouter.post("/applications", async (req, res, next) => {
  try {
    const parsed = createApplicationSchema.safeParse(req.body);
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
      res.status(401).json({ error: "Sign in before applying for adoption" });
      return;
    }

    const {
      animalId,
      identityDocument,
      proofOfResidenceDocument,
      ...data
    } = parsed.data;

    const animal = await prisma.shelterAnimal.findUnique({
      where: { id: animalId },
      select: { id: true, status: true },
    });

    if (!animal) {
      res.status(404).json({ error: "Animal was not found" });
      return;
    }

    if (animal.status !== "AVAILABLE") {
      res.status(409).json({ error: "This animal is not currently available for adoption" });
      return;
    }

    const application = await prisma.adoptionApplication.create({
      data: {
        ...data,
        animalId,
        applicantId: auth.user.id,
        documents: {
          create: [
            buildAdoptionDocument("IDENTITY", identityDocument),
            buildAdoptionDocument("PROOF_OF_RESIDENCE", proofOfResidenceDocument),
          ],
        },
      },
      select: applicationSelect,
    });

    res.status(201).json({ application: serializeApplication(req, application, true) });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.get("/applications/:id/documents/:documentType", async (req, res, next) => {
  try {
    const documentType = z.enum(adoptionDocumentTypes).safeParse(req.params.documentType);
    const auth = await getRequestUser(req);

    if (!documentType.success) {
      res.status(400).json({ error: "Choose a valid adoption document type" });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to view adoption documents" });
      return;
    }

    const application = await prisma.adoptionApplication.findUnique({
      where: { id: req.params.id },
      select: { applicantId: true },
    });

    if (!application) {
      res.status(404).json({ error: "Adoption application not found" });
      return;
    }

    if (!canViewAll(auth.user.role) && application.applicantId !== auth.user.id) {
      res.status(403).json({ error: "You cannot view this application's documents" });
      return;
    }

    const document = await prisma.adoptionApplicationDocument.findUnique({
      where: {
        applicationId_documentType: {
          applicationId: req.params.id,
          documentType: documentType.data,
        },
      },
      select: {
        id: true,
        documentType: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        dataUri: true,
        createdAt: true,
      },
    });

    if (!document) {
      res.status(404).json({ error: "Adoption document not found" });
      return;
    }

    res.set("Cache-Control", "private, no-store");
    res.json({ document });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.get("/applications", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);
    const applicantId =
      typeof req.query.applicantId === "string" && req.query.applicantId.trim()
        ? req.query.applicantId.trim()
        : undefined;

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to view adoption applications" });
      return;
    }

    const admin = canViewAll(auth.user.role);
    const fieldAgent = auth.user.role === "FIELD_AGENT";
    const includeDocumentMetadata = admin || !fieldAgent;

    if (!admin && !fieldAgent && applicantId && applicantId !== auth.user.id) {
      res.status(403).json({ error: "You can only view your own adoption applications" });
      return;
    }

    const applications = await prisma.adoptionApplication.findMany({
      where: admin
        ? applicantId
          ? { applicantId }
          : undefined
        : fieldAgent
          ? { assignedAgentId: auth.user.id }
          : { applicantId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: applicationSelect,
    });

    res.json({
      applications: applications.map((application) =>
        serializeApplication(req, application, includeDocumentMetadata)
      ),
    });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.patch("/applications/:id/status", async (req, res, next) => {
  try {
    const parsed = updateApplicationStatusSchema.safeParse(req.body);
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
      res.status(403).json({ error: "Only admins can update adoption applications" });
      return;
    }

    const existingApplication = await prisma.adoptionApplication.findUnique({
      where: { id: req.params.id },
      select: { animalId: true, id: true, status: true },
    });

    if (!existingApplication) {
      res.status(404).json({ error: "Adoption application not found" });
      return;
    }

    const application = await prisma.$transaction(async (tx) => {
      const updatedApplication = await tx.adoptionApplication.update({
        where: { id: req.params.id },
        data: {
          status: parsed.data.status,
          adoptedAt: parsed.data.status === "ADOPTED" ? new Date() : undefined,
        },
        select: applicationSelect,
      });

      if (parsed.data.status === "ADOPTED") {
        await tx.shelterAnimal.update({
          where: { id: existingApplication.animalId },
          data: { status: "ADOPTED" },
        });

        await tx.adoptionApplication.updateMany({
          where: {
            animalId: existingApplication.animalId,
            id: { not: req.params.id },
            status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
          data: { status: "DECLINED" },
        });
      }

      if (existingApplication.status === "ADOPTED" && parsed.data.status !== "ADOPTED") {
        await tx.shelterAnimal.update({
          where: { id: existingApplication.animalId },
          data: { status: "AVAILABLE" },
        });
      }

      return updatedApplication;
    });

    res.json({ application: serializeApplication(req, application, true) });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.patch("/applications/:id/inspection-assignment", async (req, res, next) => {
  try {
    const parsed = assignInspectionSchema.safeParse(req.body);
    const auth = await getRequestUser(req);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a field agent", details: parsed.error.flatten() });
      return;
    }
    if (!auth.user || !canViewAll(auth.user.role)) {
      res.status(403).json({ error: "Only admins can assign home inspections" });
      return;
    }
    const agent = await prisma.user.findUnique({
      where: { id: parsed.data.assignedAgentId },
      select: { id: true, role: true },
    });
    if (!agent || agent.role !== "FIELD_AGENT") {
      res.status(400).json({ error: "Choose a valid field agent" });
      return;
    }
    const application = await prisma.adoptionApplication.update({
      where: { id: req.params.id },
      data: {
        assignedAgentId: agent.id,
        inspectionAssignedAt: new Date(),
        status: "INSPECTION_ASSIGNED",
      },
      select: applicationSelect,
    });
    res.json({ application: serializeApplication(req, application, true) });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.patch("/applications/:id/inspection-report", async (req, res, next) => {
  try {
    const parsed = inspectionReportSchema.safeParse(req.body);
    const auth = await getRequestUser(req);
    if (!parsed.success) {
      res.status(400).json({ error: "Complete the inspection report", details: parsed.error.flatten() });
      return;
    }
    if (!auth.user || !canHandleFieldCases(auth.user.role)) {
      res.status(403).json({ error: "Only the assigned field agent can submit this inspection" });
      return;
    }
    const existing = await prisma.adoptionApplication.findUnique({
      where: { id: req.params.id },
      select: { assignedAgentId: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Adoption application not found" });
      return;
    }
    if (!canViewAll(auth.user.role) && existing.assignedAgentId !== auth.user.id) {
      res.status(403).json({ error: "This inspection is assigned to another field agent" });
      return;
    }
    const application = await prisma.adoptionApplication.update({
      where: { id: req.params.id },
      data: {
        inspectionRecommendation: parsed.data.recommendation,
        inspectionPropertySafe: parsed.data.propertySafe,
        inspectionSecureYard: parsed.data.secureYard,
        inspectionPetsCompatible: parsed.data.petsCompatible,
        inspectionNotes: parsed.data.notes,
        inspectionCompletedAt: new Date(),
        status: "INSPECTION_COMPLETED",
      },
      select: applicationSelect,
    });
    res.json({
      application: serializeApplication(req, application, canViewAll(auth.user.role)),
    });
  } catch (e) {
    next(e);
  }
});

adoptionRouter.patch("/applications/:id/pickup-schedule", async (req, res, next) => {
  try {
    const parsed = pickupScheduleSchema.safeParse(req.body);
    const auth = await getRequestUser(req);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a valid pickup date", details: parsed.error.flatten() });
      return;
    }
    if (!auth.user) {
      res.status(401).json({ error: "Sign in to schedule pickup" });
      return;
    }
    const existing = await prisma.adoptionApplication.findUnique({
      where: { id: req.params.id },
      select: { applicantId: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Adoption application not found" });
      return;
    }
    if (!canViewAll(auth.user.role) && existing.applicantId !== auth.user.id) {
      res.status(403).json({ error: "You can only schedule your own adoption pickup" });
      return;
    }
    if (!["APPROVED", "PICKUP_SCHEDULED"].includes(existing.status)) {
      res.status(409).json({ error: "Pickup can only be scheduled after final approval" });
      return;
    }
    const application = await prisma.adoptionApplication.update({
      where: { id: req.params.id },
      data: {
        pickupScheduledAt: parsed.data.pickupScheduledAt,
        pickupNote: parsed.data.pickupNote,
        status: "PICKUP_SCHEDULED",
      },
      select: applicationSelect,
    });
    res.json({ application: serializeApplication(req, application, true) });
  } catch (e) {
    next(e);
  }
});
