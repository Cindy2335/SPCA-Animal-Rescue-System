import type { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { canViewAll } from "../lib/access";
import { getRequestUser } from "../lib/authToken";
import {
  Ga4AnalyticsError,
  getGa4RealtimeAnalytics,
  getGa4TrafficAnalytics,
  type Ga4AnalyticsRange,
} from "../lib/googleAnalytics";
import { prisma } from "../lib/prisma";
import {
  resolveShelterAnimalGalleryImage,
  resolveShelterAnimalImage,
} from "../lib/shelterAssets";

export const adminRouter = Router();

const DAYS_IN_OVERVIEW = 31;
const ANALYTICS_DAY_RANGES = [7, 30, 90] as const;
const ALL_TIME_TREND_MONTHS = 60;
type AnalyticsDayRange = (typeof ANALYTICS_DAY_RANGES)[number];
type AnalyticsRange = AnalyticsDayRange | "all";
const analyticsRangeSchema = z.union([
  z.literal("all"),
  z.coerce
    .number()
    .int()
    .refine((value) => ANALYTICS_DAY_RANGES.includes(value as AnalyticsDayRange)),
]);
const animalInclude = {
  images: {
    orderBy: { sortOrder: "asc" as const },
  },
};
const animalTypeValues = ["Dog", "Cat", "Other"] as const;
const animalStatusValues = ["AVAILABLE", "PENDING", "ADOPTED"] as const;
const workerRoleValues = ["FIELD_AGENT", "ADMIN"] as const;

type AdminShelterAnimal = Prisma.ShelterAnimalGetPayload<{ include: typeof animalInclude }>;

const requiredAnimalText = z.string().trim().min(1).max(180);
const optionalAnimalText = z.string().trim().min(1).max(180).optional();
const personalitySchema = z.array(z.string().trim().min(1).max(40)).max(12);
const imageReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(8_000_000)
  .refine((value) => {
    const lowerValue = value.toLowerCase();
    return (
      lowerValue.startsWith("/assets/") ||
      lowerValue.startsWith("http://") ||
      lowerValue.startsWith("https://") ||
      lowerValue.startsWith("data:image/")
    );
  }, "Use an /assets path, an http(s) image URL, or a data:image URI");

const animalCreateSchema = z
  .object({
    age: requiredAnimalText,
    bestFor: requiredAnimalText,
    breed: requiredAnimalText,
    energy: requiredAnimalText,
    imageDataUri: imageReferenceSchema,
    imageMimeType: z.string().trim().min(1).max(80).optional(),
    location: requiredAnimalText,
    name: requiredAnimalText,
    personality: personalitySchema.default([]),
    sex: requiredAnimalText,
    size: requiredAnimalText,
    status: z.enum(animalStatusValues).default("AVAILABLE"),
    story: z.string().trim().min(1).max(2500),
    type: z.enum(animalTypeValues),
    vaccinated: z.boolean().default(false),
  })
  .strict();

const animalUpdateSchema = z
  .object({
    age: optionalAnimalText,
    bestFor: optionalAnimalText,
    breed: optionalAnimalText,
    energy: optionalAnimalText,
    location: optionalAnimalText,
    name: optionalAnimalText,
    personality: personalitySchema.optional(),
    sex: optionalAnimalText,
    size: optionalAnimalText,
    status: z.enum(animalStatusValues).optional(),
    story: z.string().trim().min(1).max(2500).optional(),
    type: z.enum(animalTypeValues).optional(),
    vaccinated: z.boolean().optional(),
  })
  .strict();

const imageCreateSchema = z
  .object({
    dataUri: imageReferenceSchema,
    fileName: z.string().trim().min(1).max(180).optional().nullable(),
    mimeType: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

const imageReorderSchema = z
  .object({
    imageIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

const workerCreateSchema = z
  .object({
    email: z.string().email(),
    fullname: z.string().trim().min(1).max(200),
    password: z.string().min(8).max(100),
    role: z.enum(workerRoleValues).default("FIELD_AGENT"),
  })
  .strict();

const publicWorkerSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function earliestDate(dates: Date[], fallback: Date) {
  if (!dates.length) return fallback;
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function serializeCreatedAtCoverage(coverage: {
  _count: { _all: number };
  _max: { createdAt: Date | null };
  _min: { createdAt: Date | null };
}) {
  return {
    earliestCreatedAt: coverage._min.createdAt?.toISOString() ?? null,
    latestCreatedAt: coverage._max.createdAt?.toISOString() ?? null,
    recordCount: coverage._count._all,
  };
}

function formatActivityTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "Just now";
  }

  if (diffMs < hour) {
    return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  }

  if (diffMs < day) {
    return `${Math.round(diffMs / hour)}h ago`;
  }

  return `${Math.round(diffMs / day)}d ago`;
}

function normalizeStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function averageDurationHours(
  rows: Array<{ startedAt: Date; finishedAt: Date | null | undefined }>
) {
  const durations = rows
    .filter((row) => row.finishedAt && row.finishedAt >= row.startedAt)
    .map((row) => (row.finishedAt!.getTime() - row.startedAt.getTime()) / 3_600_000);

  if (!durations.length) return null;
  return Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
}

function countByStatus(rows: Array<{ status: string }>) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([status, value]) => ({ label: normalizeStatusLabel(status), status, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

async function requireAdmin(req: Request, res: Response) {
  const auth = await getRequestUser(req);

  if (auth.error) {
    res.status(401).json({ error: auth.error });
    return null;
  }

  if (!auth.user) {
    res.status(401).json({ error: "Admin sign in required" });
    return null;
  }

  if (!canViewAll(auth.user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }

  return auth.user;
}

function parsePersonalityJson(personalityJson: string) {
  try {
    const parsed = JSON.parse(personalityJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((trait): trait is string => typeof trait === "string") : [];
  } catch {
    return [];
  }
}

function serializeAdminAnimal(req: Request, animal: AdminShelterAnimal) {
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
      dataUri: resolveShelterAnimalGalleryImage(req, animal.id, image.id, image.dataUri),
    })),
    personality: parsePersonalityJson(personalityJson),
    personalityJson,
  };
}

function inferImageMimeType(imageReference: string, mimeType?: string) {
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

function inferFileName(imageReference: string, fileName?: string | null) {
  if (fileName?.trim()) {
    return fileName.trim();
  }

  if (imageReference.startsWith("data:image/")) {
    return null;
  }

  return imageReference.split(/[?#]/)[0].split("/").pop() || null;
}

function buildAnimalUpdateData(input: z.infer<typeof animalUpdateSchema>) {
  const data: Prisma.ShelterAnimalUpdateInput = {};

  if (input.age !== undefined) data.age = input.age;
  if (input.bestFor !== undefined) data.bestFor = input.bestFor;
  if (input.breed !== undefined) data.breed = input.breed;
  if (input.energy !== undefined) data.energy = input.energy;
  if (input.location !== undefined) data.location = input.location;
  if (input.name !== undefined) data.name = input.name;
  if (input.personality !== undefined) data.personalityJson = JSON.stringify(input.personality);
  if (input.sex !== undefined) data.sex = input.sex;
  if (input.size !== undefined) data.size = input.size;
  if (input.status !== undefined) data.status = input.status;
  if (input.story !== undefined) data.story = input.story;
  if (input.type !== undefined) data.type = input.type;
  if (input.vaccinated !== undefined) data.vaccinated = input.vaccinated;

  return data;
}

adminRouter.get("/dashboard", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const today = startOfDay(new Date());
    const overviewStart = addDays(today, -(DAYS_IN_OVERVIEW - 1));

    const [
      totalPets,
      registeredUsers,
      adoptionRequests,
      successfulAdoptions,
      activeReports,
      activeSurrenders,
      pendingPets,
      petsByStatusRows,
      overviewApplications,
      recentApplications,
      recentReports,
      recentSurrenders,
      recentPets,
      recentUsers,
    ] = await Promise.all([
      prisma.shelterAnimal.count(),
      prisma.user.count(),
      prisma.adoptionApplication.count(),
      prisma.adoptionApplication.count({ where: { status: "ADOPTED" } }),
      prisma.strayAnimalReport.count({ where: { status: { not: "RESOLVED" } } }),
      prisma.animalSurrenderRequest.count({
        where: { status: { notIn: ["COMPLETED", "DECLINED"] } },
      }),
      prisma.shelterAnimal.count({ where: { status: "PENDING" } }),
      prisma.shelterAnimal.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { status: "asc" },
      }),
      prisma.adoptionApplication.findMany({
        where: { createdAt: { gte: overviewStart } },
        select: { createdAt: true },
      }),
      prisma.adoptionApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          applicantName: true,
          email: true,
          status: true,
          createdAt: true,
          animal: {
            select: {
              id: true,
              name: true,
              type: true,
              age: true,
              sex: true,
              breed: true,
              status: true,
            },
          },
        },
      }),
      prisma.strayAnimalReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          animalType: true,
          location: true,
          reporterName: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.animalSurrenderRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          ownerName: true,
          animalName: true,
          animalType: true,
          status: true,
          urgency: true,
          createdAt: true,
        },
      }),
      prisma.shelterAnimal.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
        },
      }),
    ]);

    const overviewCounts = new Map<string, number>();

    for (const application of overviewApplications) {
      const key = formatDateKey(application.createdAt);
      overviewCounts.set(key, (overviewCounts.get(key) ?? 0) + 1);
    }

    const adoptionOverview = Array.from({ length: DAYS_IN_OVERVIEW }, (_, index) => {
      const date = addDays(overviewStart, index);
      const key = formatDateKey(date);

      return {
        date: key,
        label: formatDateLabel(date),
        value: overviewCounts.get(key) ?? 0,
      };
    });

    const petsByStatus = petsByStatusRows.map((row) => ({
      status: row.status,
      label: normalizeStatusLabel(row.status),
      value: row._count.status,
    }));

    const recentActivity = [
      ...recentApplications.map((application) => ({
        id: `application-${application.id}`,
        kind: "adoption",
        title: "New adoption request",
        body: `${application.applicantName} requested to adopt ${application.animal.name}`,
        createdAt: application.createdAt,
        timeLabel: formatActivityTime(application.createdAt),
      })),
      ...recentReports.map((report) => ({
        id: `report-${report.id}`,
        kind: "report",
        title: "New report received",
        body: `${report.animalType} reported near ${report.location}`,
        createdAt: report.createdAt,
        timeLabel: formatActivityTime(report.createdAt),
      })),
      ...recentSurrenders.map((surrender) => ({
        id: `surrender-${surrender.id}`,
        kind: "report",
        title: "Surrender request received",
        body: `${surrender.ownerName} requested intake for ${surrender.animalName || surrender.animalType}`,
        createdAt: surrender.createdAt,
        timeLabel: formatActivityTime(surrender.createdAt),
      })),
      ...recentPets.map((pet) => ({
        id: `pet-${pet.id}`,
        kind: "pet",
        title: "Pet listing updated",
        body: `${pet.name} is listed as ${normalizeStatusLabel(pet.status)}`,
        createdAt: pet.createdAt,
        timeLabel: formatActivityTime(pet.createdAt),
      })),
      ...recentUsers.map((user) => ({
        id: `user-${user.id}`,
        kind: "user",
        title: "New user registered",
        body: `${user.fullName} joined the platform`,
        createdAt: user.createdAt,
        timeLabel: formatActivityTime(user.createdAt),
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map((activity) => ({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
      }));

    res.json({
      metrics: {
        totalPets,
        adoptionRequests,
        registeredUsers,
        successfulAdoptions,
        donationsTotal: 0,
        activeReports,
        activeSurrenders,
        pendingPets,
        organizations: 0,
        appointments: 0,
      },
      adoptionOverview,
      petsByStatus,
      recentApplications,
      recentActivity,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/analytics", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) return;

    const parsedRange = analyticsRangeSchema.safeParse(req.query.days ?? 30);

    if (!parsedRange.success) {
      res.status(400).json({ error: "Analytics range must be 7, 30, 90 days, or all" });
      return;
    }

    const range = parsedRange.data as AnalyticsRange;
    const isAllTime = range === "all";
    const days = isAllTime ? null : range;
    const today = startOfDay(new Date());
    const periodStart = days === null ? null : addDays(today, -(days - 1));
    const periodWhere = periodStart ? { createdAt: { gte: periodStart } } : {};

    const [
      totalAnimals,
      vaccinatedAnimals,
      animalsByStatusRows,
      animalsByTypeRows,
      applications,
      reports,
      surrenders,
      activeReports,
      activeSurrenders,
      unassignedActiveReports,
      applicationCoverage,
      reportCoverage,
      surrenderCoverage,
    ] = await Promise.all([
      prisma.shelterAnimal.count(),
      prisma.shelterAnimal.count({ where: { vaccinated: true } }),
      prisma.shelterAnimal.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { status: "asc" },
      }),
      prisma.shelterAnimal.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { type: "asc" },
      }),
      prisma.adoptionApplication.findMany({
        where: periodWhere,
        select: {
          adoptedAt: true,
          assignedAgentId: true,
          createdAt: true,
          inspectionCompletedAt: true,
          status: true,
        },
      }),
      prisma.strayAnimalReport.findMany({
        where: periodWhere,
        select: {
          assignedAgentId: true,
          assignedAt: true,
          createdAt: true,
          fieldStatus: true,
          failedAt: true,
          onSceneAt: true,
          reporterId: true,
          resolvedAt: true,
          status: true,
          unableToLocateAt: true,
        },
      }),
      prisma.animalSurrenderRequest.findMany({
        where: { ...periodWhere, status: { not: "DECLINED" } },
        select: {
          completedAt: true,
          createdAt: true,
          scheduledIntakeAt: true,
          status: true,
          urgency: true,
        },
      }),
      prisma.strayAnimalReport.count({
        where: {
          fieldStatus: { notIn: ["HELPED", "UNABLE_TO_LOCATE", "FAILED"] },
          status: { not: "RESOLVED" },
        },
      }),
      prisma.animalSurrenderRequest.count({
        where: { status: { notIn: ["COMPLETED", "DECLINED"] } },
      }),
      prisma.strayAnimalReport.count({
        where: {
          assignedAgentId: null,
          fieldStatus: { notIn: ["HELPED", "UNABLE_TO_LOCATE", "FAILED"] },
          status: { not: "RESOLVED" },
        },
      }),
      prisma.adoptionApplication.aggregate({
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.strayAnimalReport.aggregate({
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.animalSurrenderRequest.aggregate({
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    const adoptedApplications = applications.filter((row) => row.status === "ADOPTED");
    const completedInspections = applications.filter((row) => row.inspectionCompletedAt).length;
    const isTerminalReport = (row: { fieldStatus: string; status: string }) =>
      row.status === "RESOLVED" || ["HELPED", "UNABLE_TO_LOCATE", "FAILED"].includes(row.fieldStatus);
    const resolvedReports = reports.filter(isTerminalReport);
    const assignedReports = reports.filter((row) => row.assignedAgentId).length;
    const anonymousReports = reports.filter((row) => !row.reporterId).length;
    const completedSurrenders = surrenders.filter((row) => row.status === "COMPLETED");
    const scheduledSurrenders = surrenders.filter((row) => row.scheduledIntakeAt).length;

    const adoptionTimeHours = averageDurationHours(
      adoptedApplications.map((row) => ({ finishedAt: row.adoptedAt, startedAt: row.createdAt }))
    );
    const reportAssignmentHours = averageDurationHours(
      reports.map((row) => ({ finishedAt: row.assignedAt, startedAt: row.createdAt }))
    );
    const reportResponseHours = averageDurationHours(
      reports.map((row) => ({ finishedAt: row.onSceneAt, startedAt: row.createdAt }))
    );
    const reportResolutionHours = averageDurationHours(
      reports.map((row) => ({
        finishedAt: row.resolvedAt ?? row.unableToLocateAt ?? row.failedAt,
        startedAt: row.createdAt,
      }))
    );
    const surrenderCompletionHours = averageDurationHours(
      completedSurrenders.map((row) => ({ finishedAt: row.completedAt, startedAt: row.createdAt }))
    );

    const coverageStart = startOfDay(
      earliestDate(
        [
          applicationCoverage._min.createdAt,
          reportCoverage._min.createdAt,
          surrenderCoverage._min.createdAt,
        ].filter((date): date is Date => date !== null),
        today
      )
    );
    const allTimeTrendFloor = addMonths(startOfMonth(today), -(ALL_TIME_TREND_MONTHS - 1));
    const unboundedTrendStart = isAllTime ? startOfMonth(coverageStart) : periodStart!;
    const trendStart =
      isAllTime && unboundedTrendStart < allTimeTrendFloor
        ? allTimeTrendFloor
        : unboundedTrendStart;
    const trendGranularity = isAllTime ? "month" : "day";
    const trendKey = (date: Date) =>
      isAllTime ? formatDateKey(startOfMonth(date)) : formatDateKey(date);

    const trendByDate = new Map<
      string,
      {
        adoptions: number;
        applications: number;
        date: string;
        label: string;
        reports: number;
        resolvedReports: number;
        surrenders: number;
      }
    >();

    const addEmptyTrendBucket = (date: Date) => {
      const key = trendKey(date);
      trendByDate.set(key, {
        adoptions: 0,
        applications: 0,
        date: key,
        label: isAllTime ? formatMonthLabel(date) : formatDateLabel(date),
        reports: 0,
        resolvedReports: 0,
        surrenders: 0,
      });
    };

    if (days === null) {
      for (let date = trendStart; date <= today; date = addMonths(date, 1)) {
        addEmptyTrendBucket(date);
      }
    } else {
      for (let index = 0; index < days; index += 1) {
        addEmptyTrendBucket(addDays(periodStart!, index));
      }
    }

    const incrementTrend = (date: Date | null, field: keyof Omit<NonNullable<ReturnType<typeof trendByDate.get>>, "date" | "label">) => {
      if (!date) return;
      const bucket = trendByDate.get(trendKey(date));
      if (bucket) bucket[field] += 1;
    };

    for (const row of applications) {
      incrementTrend(row.createdAt, "applications");
      incrementTrend(row.adoptedAt, "adoptions");
    }
    for (const row of reports) {
      incrementTrend(row.createdAt, "reports");
      incrementTrend(row.resolvedAt ?? row.unableToLocateAt ?? row.failedAt, "resolvedReports");
    }
    for (const row of surrenders) incrementTrend(row.createdAt, "surrenders");

    const fieldStatusCounts = new Map<string, number>();
    for (const report of reports) {
      fieldStatusCounts.set(report.fieldStatus, (fieldStatusCounts.get(report.fieldStatus) ?? 0) + 1);
    }

    const urgencyCounts = new Map<string, number>();
    for (const surrender of surrenders) {
      urgencyCounts.set(surrender.urgency, (urgencyCounts.get(surrender.urgency) ?? 0) + 1);
    }

    const generatedAt = new Date().toISOString();

    res.json({
      breakdowns: {
        animalsByStatus: animalsByStatusRows.map((row) => ({
          label: normalizeStatusLabel(row.status),
          status: row.status,
          value: row._count.status,
        })),
        animalsByType: animalsByTypeRows.map((row) => ({
          label: row.type,
          status: row.type.toUpperCase(),
          value: row._count.type,
        })),
        applicationsByStatus: countByStatus(applications),
        reportsByFieldStatus: Array.from(fieldStatusCounts.entries())
          .map(([status, value]) => ({ label: normalizeStatusLabel(status), status, value }))
          .sort((a, b) => b.value - a.value),
        reportsByStatus: countByStatus(
          reports.map((row) => ({ status: isTerminalReport(row) ? "RESOLVED" : row.status }))
        ),
        surrendersByStatus: countByStatus(surrenders),
        surrendersByUrgency: Array.from(urgencyCounts.entries())
          .map(([status, value]) => ({ label: status, status, value }))
          .sort((a, b) => b.value - a.value),
      },
      dataCoverage: {
        adoptionApplications: serializeCreatedAtCoverage(applicationCoverage),
        animalSurrenderRequests: serializeCreatedAtCoverage(surrenderCoverage),
        statusTransitionHistory: false,
        statusTransitionHistoryNote:
          "Statuses are current snapshots; only explicit milestone timestamps can be trended because a full status-transition event log is not stored.",
        strayAnimalReports: serializeCreatedAtCoverage(reportCoverage),
      },
      generatedAt,
      metricScopes: {
        backlog: {
          asOf: generatedAt,
          scope: "current-snapshot",
        },
        flows: {
          from: formatDateKey(isAllTime ? coverageStart : periodStart!),
          scope: isAllTime ? "lifetime" : "selected-period",
          to: formatDateKey(today),
        },
        inventory: {
          asOf: generatedAt,
          scope: "current-snapshot",
        },
      },
      operations: {
        adoption: {
          adopted: adoptedApplications.length,
          averageDaysToAdoption: adoptionTimeHours === null ? null : Math.round((adoptionTimeHours / 24) * 10) / 10,
          inspectionCompletionRate: percentage(completedInspections, applications.length),
          total: applications.length,
        },
        reports: {
          anonymousRate: percentage(anonymousReports, reports.length),
          assignmentRate: percentage(assignedReports, reports.length),
          averageAssignmentHours: reportAssignmentHours,
          averageResolutionHours: reportResolutionHours,
          averageResponseHours: reportResponseHours,
          resolved: resolvedReports.length,
          total: reports.length,
        },
        surrenders: {
          averageCompletionDays:
            surrenderCompletionHours === null
              ? null
              : Math.round((surrenderCompletionHours / 24) * 10) / 10,
          completed: completedSurrenders.length,
          schedulingRate: percentage(scheduledSurrenders, surrenders.length),
          total: surrenders.length,
        },
      },
      period: {
        days: range,
        flowScope: isAllTime ? "lifetime" : "selected-period",
        from: formatDateKey(isAllTime ? coverageStart : periodStart!),
        granularity: trendGranularity,
        label: isAllTime ? "All time" : `Last ${days} days`,
        to: formatDateKey(today),
        trendFrom: formatDateKey(trendStart),
        trendLimited: trendStart > unboundedTrendStart,
      },
      summary: {
        activeReports,
        activeSurrenders,
        adoptionRate: percentage(adoptedApplications.length, applications.length),
        applications: applications.length,
        availableAnimals:
          animalsByStatusRows.find((row) => row.status === "AVAILABLE")?._count.status ?? 0,
        intakeCompletionRate: percentage(completedSurrenders.length, surrenders.length),
        reportResolutionRate: percentage(resolvedReports.length, reports.length),
        reports: reports.length,
        surrenders: surrenders.length,
        totalAnimals,
        unassignedActiveReports,
        vaccinationRate: percentage(vaccinatedAnimals, totalAnimals),
      },
      trend: Array.from(trendByDate.values()),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics/traffic", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) return;

    const parsedRange = analyticsRangeSchema.safeParse(req.query.days ?? 30);

    if (!parsedRange.success) {
      res.status(400).json({ error: "Analytics range must be 7, 30, 90 days, or all" });
      return;
    }

    try {
      const analytics = await getGa4TrafficAnalytics(parsedRange.data as Ga4AnalyticsRange);
      res.json(analytics);
    } catch (error) {
      if (error instanceof Ga4AnalyticsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics/traffic/realtime", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) return;

    try {
      const analytics = await getGa4RealtimeAnalytics();
      res.json(analytics);
    } catch (error) {
      if (error instanceof Ga4AnalyticsError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/workers", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const workers = await prisma.user.findMany({
      where: { role: { in: [...workerRoleValues] } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      select: publicWorkerSelect,
    });

    res.json({ workers });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/workers", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = workerCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid worker account", details: parsed.error.flatten() });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const existingWorker = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingWorker) {
      res.status(409).json({ error: "An account with that email already exists" });
      return;
    }

    const worker = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: parsed.data.fullname.trim(),
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        role: parsed.data.role,
      },
      select: publicWorkerSelect,
    });

    res.status(201).json({ worker });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/workers/:id", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    if (req.params.id === adminUser.id) {
      res.status(400).json({ error: "You cannot remove your own admin account" });
      return;
    }

    const worker = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true },
    });

    if (!worker || !workerRoleValues.includes(worker.role as (typeof workerRoleValues)[number])) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }

    await prisma.user.delete({ where: { id: worker.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/animals", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const animals = await prisma.shelterAnimal.findMany({
      include: animalInclude,
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    res.json({
      animals: animals.map((animal) => serializeAdminAnimal(req, animal)),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/animals", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = animalCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid animal profile", details: parsed.error.flatten() });
      return;
    }

    const input = parsed.data;
    const imageMimeType = inferImageMimeType(input.imageDataUri, input.imageMimeType);
    const animal = await prisma.shelterAnimal.create({
      data: {
        age: input.age,
        bestFor: input.bestFor,
        breed: input.breed,
        energy: input.energy,
        id: `pet-${randomUUID()}`,
        imageDataUri: input.imageDataUri,
        imageMimeType,
        images: {
          create: {
            dataUri: input.imageDataUri,
            fileName: inferFileName(input.imageDataUri),
            mimeType: imageMimeType,
            sortOrder: 0,
          },
        },
        location: input.location,
        name: input.name,
        personalityJson: JSON.stringify(input.personality),
        sex: input.sex,
        size: input.size,
        status: input.status,
        story: input.story,
        type: input.type,
        vaccinated: input.vaccinated,
      },
      include: animalInclude,
    });

    res.status(201).json({ animal: serializeAdminAnimal(req, animal) });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/animals/:id", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = animalUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid animal profile update", details: parsed.error.flatten() });
      return;
    }

    const existingAnimal = await prisma.shelterAnimal.findUnique({
      select: { id: true },
      where: { id: req.params.id },
    });

    if (!existingAnimal) {
      res.status(404).json({ error: "Animal was not found" });
      return;
    }

    const updateData = buildAnimalUpdateData(parsed.data);
    const animal = Object.keys(updateData).length
      ? await prisma.shelterAnimal.update({
          data: updateData,
          include: animalInclude,
          where: { id: req.params.id },
        })
      : await prisma.shelterAnimal.findUniqueOrThrow({
          include: animalInclude,
          where: { id: req.params.id },
        });

    res.json({ animal: serializeAdminAnimal(req, animal) });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/animals/:id/images", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = imageCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid animal image", details: parsed.error.flatten() });
      return;
    }

    const animal = await prisma.shelterAnimal.findUnique({
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
      where: { id: req.params.id },
    });

    if (!animal) {
      res.status(404).json({ error: "Animal was not found" });
      return;
    }

    const input = parsed.data;
    const imageMimeType = inferImageMimeType(input.dataUri, input.mimeType);
    const sortOrder = animal.images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;

    await prisma.shelterAnimalImage.create({
      data: {
        animalId: animal.id,
        dataUri: input.dataUri,
        fileName: inferFileName(input.dataUri, input.fileName),
        mimeType: imageMimeType,
        sortOrder,
      },
    });

    if (!animal.images.length) {
      await prisma.shelterAnimal.update({
        data: {
          imageDataUri: input.dataUri,
          imageMimeType,
        },
        where: { id: animal.id },
      });
    }

    const updatedAnimal = await prisma.shelterAnimal.findUniqueOrThrow({
      include: animalInclude,
      where: { id: animal.id },
    });

    res.status(201).json({ animal: serializeAdminAnimal(req, updatedAnimal) });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/animals/:id/images/reorder", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const parsed = imageReorderSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid image order", details: parsed.error.flatten() });
      return;
    }

    const requestedImageIds = parsed.data.imageIds;
    const uniqueImageIds = new Set(requestedImageIds);

    if (uniqueImageIds.size !== requestedImageIds.length) {
      res.status(400).json({ error: "Image order cannot contain duplicates" });
      return;
    }

    const animal = await prisma.shelterAnimal.findUnique({
      select: { id: true },
      where: { id: req.params.id },
    });

    if (!animal) {
      res.status(404).json({ error: "Animal was not found" });
      return;
    }

    const images = await prisma.shelterAnimalImage.findMany({
      orderBy: { sortOrder: "asc" },
      where: { animalId: animal.id },
    });

    const existingImageIds = new Set(images.map((image) => image.id));
    const sameImageSet =
      images.length === requestedImageIds.length && requestedImageIds.every((imageId) => existingImageIds.has(imageId));

    if (!sameImageSet) {
      res.status(400).json({ error: "Image order must include every image for this animal exactly once" });
      return;
    }

    const imagesById = new Map(images.map((image) => [image.id, image]));
    const primaryImage = imagesById.get(requestedImageIds[0]);

    if (!primaryImage) {
      res.status(400).json({ error: "Primary image was not found" });
      return;
    }

    await prisma.$transaction([
      ...requestedImageIds.map((imageId, sortOrder) =>
        prisma.shelterAnimalImage.update({
          data: { sortOrder },
          where: { id: imageId },
        })
      ),
      prisma.shelterAnimal.update({
        data: {
          imageDataUri: primaryImage.dataUri,
          imageMimeType: primaryImage.mimeType,
        },
        where: { id: animal.id },
      }),
    ]);

    const updatedAnimal = await prisma.shelterAnimal.findUniqueOrThrow({
      include: animalInclude,
      where: { id: animal.id },
    });

    res.json({ animal: serializeAdminAnimal(req, updatedAnimal) });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/animals/:id/images/:imageId", async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);

    if (!adminUser) {
      return;
    }

    const images = await prisma.shelterAnimalImage.findMany({
      orderBy: { sortOrder: "asc" },
      where: { animalId: req.params.id },
    });
    const imageToDelete = images.find((image) => image.id === req.params.imageId);

    if (!imageToDelete) {
      res.status(404).json({ error: "Animal image was not found" });
      return;
    }

    if (images.length <= 1) {
      res.status(409).json({ error: "Every animal profile needs at least one image" });
      return;
    }

    const remainingImages = images.filter((image) => image.id !== imageToDelete.id);
    const primaryImage = remainingImages[0];

    if (!primaryImage) {
      res.status(409).json({ error: "Every animal profile needs at least one image" });
      return;
    }

    await prisma.$transaction([
      prisma.shelterAnimalImage.delete({ where: { id: imageToDelete.id } }),
      ...remainingImages.map((image, sortOrder) =>
        prisma.shelterAnimalImage.update({
          data: { sortOrder },
          where: { id: image.id },
        })
      ),
      prisma.shelterAnimal.update({
        data: {
          imageDataUri: primaryImage.dataUri,
          imageMimeType: primaryImage.mimeType,
        },
        where: { id: req.params.id },
      }),
    ]);

    const updatedAnimal = await prisma.shelterAnimal.findUniqueOrThrow({
      include: animalInclude,
      where: { id: req.params.id },
    });

    res.json({ animal: serializeAdminAnimal(req, updatedAnimal) });
  } catch (e) {
    next(e);
  }
});
