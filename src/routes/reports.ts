import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { canHandleFieldCases, canViewAll } from "../lib/access";
import { getRequestUser } from "../lib/authToken";
import { createNotification, notifyAdmins, notifyReporter } from "../lib/notifications";

export const reportRouter = Router();

const reportSelect = {
  reporterName: true,
  id: true,
  animalType: true,
  condition: true,
  location: true,
  latitude: true,
  longitude: true,
  description: true,
  imageUrl: true,
  status: true,
  fieldStatus: true,
  fieldNotes: true,
  fieldOutcome: true,
  reporterId: true,
  assignedAgentId: true,
  assignedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  dispatchedAt: true,
  onSceneAt: true,
  rescueStartedAt: true,
  unableToLocateAt: true,
  failedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  reporter: {
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

const statusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
const fieldStatusSchema = z.enum([
  "UNASSIGNED",
  "ASSIGNED",
  "ACCEPTED",
  "REJECTED",
  "EN_ROUTE",
  "ON_SCENE",
  "RESCUE_IN_PROGRESS",
  "HELPED",
  "UNABLE_TO_LOCATE",
  "FAILED",
]);
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

const createStrayReportSchema = z.object({
  animalType: z.enum(["Dog", "Cat", "Other"]),
  condition: optionalText(120),
  location: z.string().trim().min(2).max(250),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().trim().min(10).max(1000),
  imageUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(8_000_000).optional()
  ),
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
  reporterId: optionalText(100),
});

const updateStatusSchema = z.object({
  status: statusSchema,
});

const updateAssignmentSchema = z.object({
  assignedAgentId: z.string().trim().min(1).max(100),
});

const updateFieldReportSchema = z.object({
  fieldNotes: optionalText(1000),
  fieldOutcome: optionalText(1000),
  fieldStatus: fieldStatusSchema,
});

function fieldStatusLabel(status: z.infer<typeof fieldStatusSchema>) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reporterUpdateFor(status: z.infer<typeof fieldStatusSchema>) {
  if (status === "ASSIGNED") {
    return "A field agent has been assigned to your stray animal report.";
  }

  if (status === "ACCEPTED") {
    return "A field agent accepted your report and is preparing to respond.";
  }

  if (status === "REJECTED") {
    return "A field agent could not take this case. Admin will reassign it.";
  }

  if (status === "EN_ROUTE") {
    return "A field agent is on the way to the reported location.";
  }

  if (status === "ON_SCENE") {
    return "A field agent has arrived and is checking on the animal.";
  }

  if (status === "RESCUE_IN_PROGRESS") {
    return "The field agent has started helping the animal.";
  }

  if (status === "HELPED") {
    return "The field team has helped the animal and closed the report.";
  }

  if (status === "UNABLE_TO_LOCATE") {
    return "The field team visited the area but could not locate the animal yet.";
  }

  if (status === "FAILED") {
    return "The rescue could not be completed. The field team added details to the case.";
  }

  return "Your report is waiting for field dispatch.";
}

async function reverseGeocodeReportLocation(
  location: string,
  latitude: number | undefined,
  longitude: number | undefined
) {
  const coordinateOnlyLocation = /^coordinates?:/i.test(location.trim()) || /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(location.trim());

  if (latitude === undefined || longitude === undefined || !coordinateOnlyLocation) {
    return location;
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "18",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "team08-spca-address-search/1.0",
      },
    });

    if (!response.ok) return location;

    const result = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const address = result.address ?? {};
    const parts = [
      address.house_number && address.road
        ? `${address.house_number} ${address.road}`
        : address.road,
      address.suburb ?? address.neighbourhood,
      address.city ?? address.town ?? address.village,
      address.state,
    ].filter((part, index, allParts): part is string => Boolean(part) && allParts.indexOf(part) === index);

    return parts.length ? parts.join(", ") : result.display_name ?? location;
  } catch {
    return location;
  }
}

reportRouter.post("/stray", async (req, res, next) => {
  try {
    const parsed = createStrayReportSchema.safeParse(req.body);
    const auth = await getRequestUser(req);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    const { imageUrl, images, ...data } = parsed.data;
    const resolvedLocation = await reverseGeocodeReportLocation(data.location, data.latitude, data.longitude);
    const firstImage = images?.[0]?.dataUri ?? imageUrl;
    const reporterId = auth.user?.id;
    const reporterName = auth.user?.fullName ?? "Anonymous";

    const report = await prisma.strayAnimalReport.create({
      data: {
        ...data,
        location: resolvedLocation,
        imageUrl: firstImage,
        reporterId,
        reporterName,
        images: images?.length
          ? {
              create: images.map((image, index) => ({
                dataUri: image.dataUri,
                fileName: image.fileName,
                mimeType:
                  image.mimeType ??
                  image.dataUri.match(/^data:([^;]+);base64,/)?.[1] ??
                  "image/jpeg",
                sortOrder: index,
              })),
            }
          : undefined,
      },
      select: reportSelect,
    });

    await notifyAdmins({
      body: `${report.reporterName || "Anonymous"} reported a ${report.animalType.toLowerCase()} near ${report.location}.`,
      reportId: report.id,
      title: "New stray animal report",
      type: "REPORT_CREATED",
    });

    res.status(201).json({ report });
  } catch (e) {
    next(e);
  }
});

reportRouter.get("/stray", async (req, res, next) => {
  try {
    const auth = await getRequestUser(req);
    const reporterId =
      typeof req.query.reporterId === "string" && req.query.reporterId.trim()
        ? req.query.reporterId.trim()
        : undefined;

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user) {
      res.status(401).json({ error: "Sign in to view reports" });
      return;
    }

    const admin = canViewAll(auth.user.role);
    const fieldAgent = canHandleFieldCases(auth.user.role) && !admin;

    if (!admin && reporterId && reporterId !== auth.user.id) {
      res.status(403).json({ error: "You can only view your own reports" });
      return;
    }

    const reports = await prisma.strayAnimalReport.findMany({
      where: admin
        ? reporterId
          ? { reporterId }
          : undefined
        : fieldAgent
          ? { assignedAgentId: auth.user.id }
          : { reporterId: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: reportSelect,
    });

    res.json({ reports });
  } catch (e) {
    next(e);
  }
});

reportRouter.patch("/stray/:id/status", async (req, res, next) => {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
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
      res.status(403).json({ error: "Only admins can update report status" });
      return;
    }

    const existingReport = await prisma.strayAnimalReport.findUnique({
      where: { id: req.params.id },
      select: { assignedAgentId: true, id: true, reporterId: true },
    });

    if (!existingReport) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const report = await prisma.strayAnimalReport.update({
      where: { id: req.params.id },
      data: {
        resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : undefined,
        status: parsed.data.status,
      },
      select: reportSelect,
    });

    await notifyReporter(report, {
      body: `Your stray animal report is now marked ${parsed.data.status.toLowerCase().replaceAll("_", " ")}.`,
      reportId: report.id,
      title: "Report status updated",
      type: "REPORT_STATUS_UPDATED",
    });

    if (report.assignedAgentId) {
      await createNotification({
        body: `Admin updated this case to ${parsed.data.status.toLowerCase().replaceAll("_", " ")}.`,
        recipientId: report.assignedAgentId,
        reportId: report.id,
        title: "Assigned case updated",
        type: "REPORT_STATUS_UPDATED",
      });
    }

    res.json({ report });
  } catch (e) {
    next(e);
  }
});

reportRouter.patch("/stray/:id/assignment", async (req, res, next) => {
  try {
    const parsed = updateAssignmentSchema.safeParse(req.body);
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
      res.status(403).json({ error: "Only admins can assign field agents" });
      return;
    }

    const [existingReport, agent] = await Promise.all([
      prisma.strayAnimalReport.findUnique({
        where: { id: req.params.id },
        select: { animalType: true, id: true, location: true, reporterId: true },
      }),
      prisma.user.findUnique({
        where: { id: parsed.data.assignedAgentId },
        select: { email: true, fullName: true, id: true, role: true },
      }),
    ]);

    if (!existingReport) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    if (!agent || !canHandleFieldCases(agent.role)) {
      res.status(400).json({ error: "Choose a valid field agent" });
      return;
    }

    const report = await prisma.strayAnimalReport.update({
      where: { id: req.params.id },
      data: {
        assignedAgentId: agent.id,
        assignedAt: new Date(),
        acceptedAt: null,
        dispatchedAt: null,
        failedAt: null,
        fieldStatus: "ASSIGNED",
        onSceneAt: null,
        rejectedAt: null,
        rescueStartedAt: null,
        resolvedAt: null,
        status: "IN_PROGRESS",
        unableToLocateAt: null,
      },
      select: reportSelect,
    });

    await createNotification({
      body: `You have been assigned to a ${report.animalType.toLowerCase()} report at ${report.location}.`,
      recipientId: agent.id,
      reportId: report.id,
      title: "New field case assigned",
      type: "REPORT_ASSIGNED",
    });

    await notifyReporter(report, {
      body: reporterUpdateFor("ASSIGNED"),
      reportId: report.id,
      title: "Field agent assigned",
      type: "REPORT_ASSIGNED",
    });

    res.json({ report });
  } catch (e) {
    next(e);
  }
});

reportRouter.patch("/stray/:id/field-update", async (req, res, next) => {
  try {
    const parsed = updateFieldReportSchema.safeParse(req.body);
    const auth = await getRequestUser(req);

    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    if (auth.error) {
      res.status(401).json({ error: auth.error });
      return;
    }

    if (!auth.user || !canHandleFieldCases(auth.user.role)) {
      res.status(403).json({ error: "Only field agents can update field cases" });
      return;
    }

    const existingReport = await prisma.strayAnimalReport.findUnique({
      where: { id: req.params.id },
      select: {
        acceptedAt: true,
        assignedAgentId: true,
        dispatchedAt: true,
        failedAt: true,
        id: true,
        onSceneAt: true,
        rejectedAt: true,
        rescueStartedAt: true,
        reporterId: true,
        status: true,
        unableToLocateAt: true,
      },
    });

    if (!existingReport) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    if (!canViewAll(auth.user.role) && existingReport.assignedAgentId !== auth.user.id) {
      res.status(403).json({ error: "This case is not assigned to you" });
      return;
    }

    const now = new Date();
    const report = await prisma.strayAnimalReport.update({
      where: { id: req.params.id },
      data: {
        acceptedAt:
          parsed.data.fieldStatus === "ACCEPTED" && !existingReport.acceptedAt ? now : undefined,
        dispatchedAt:
          parsed.data.fieldStatus === "EN_ROUTE" && !existingReport.dispatchedAt ? now : undefined,
        failedAt:
          parsed.data.fieldStatus === "FAILED" && !existingReport.failedAt ? now : undefined,
        fieldNotes: parsed.data.fieldNotes,
        fieldOutcome: parsed.data.fieldOutcome,
        fieldStatus: parsed.data.fieldStatus,
        onSceneAt:
          parsed.data.fieldStatus === "ON_SCENE" && !existingReport.onSceneAt ? now : undefined,
        rejectedAt:
          parsed.data.fieldStatus === "REJECTED" && !existingReport.rejectedAt ? now : undefined,
        rescueStartedAt:
          parsed.data.fieldStatus === "RESCUE_IN_PROGRESS" && !existingReport.rescueStartedAt
            ? now
            : undefined,
        resolvedAt: parsed.data.fieldStatus === "HELPED" ? now : undefined,
        unableToLocateAt:
          parsed.data.fieldStatus === "UNABLE_TO_LOCATE" && !existingReport.unableToLocateAt
            ? now
            : undefined,
        status:
          parsed.data.fieldStatus === "HELPED" ||
          parsed.data.fieldStatus === "UNABLE_TO_LOCATE" ||
          parsed.data.fieldStatus === "FAILED"
            ? "RESOLVED"
            : "IN_PROGRESS",
      },
      select: reportSelect,
    });

    const label = fieldStatusLabel(parsed.data.fieldStatus);
    const noteSuffix = parsed.data.fieldNotes ? ` Note: ${parsed.data.fieldNotes}` : "";

    await notifyAdmins({
      body: `${auth.user.fullName} updated ${report.animalType.toLowerCase()} case ${report.location} to ${label}.${noteSuffix}`,
      reportId: report.id,
      title: "Field case update",
      type: "FIELD_CASE_UPDATED",
    });

    const reporterBody =
      (parsed.data.fieldStatus === "FAILED" || parsed.data.fieldStatus === "UNABLE_TO_LOCATE") &&
      parsed.data.fieldNotes
        ? `${reporterUpdateFor(parsed.data.fieldStatus)} Reason: ${parsed.data.fieldNotes}`
        : reporterUpdateFor(parsed.data.fieldStatus);

    await notifyReporter(report, {
      body: reporterBody,
      reportId: report.id,
      title: "Rescue update",
      type: "FIELD_CASE_UPDATED",
    });

    res.json({ report });
  } catch (e) {
    next(e);
  }
});
