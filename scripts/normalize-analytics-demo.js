const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.join(__dirname, "..", "Database", "dev.db");
const db = new DatabaseSync(databasePath);
const hourMs = 60 * 60 * 1000;

db.exec("PRAGMA foreign_keys = ON;");

function delayHours(finishedAt, createdAt) {
  return finishedAt === null ? null : (finishedAt - createdAt) / hourMs;
}

function normalizeReportTimings() {
  const legacyTimingProfiles = new Map([
    ["cmo1xi6sb0002bus0i1d0ohyx", { assigned: 4, onScene: 12, terminal: 18 }],
    ["cmo2vuui20000bufsumbkd8f1", { assigned: 5, onScene: null, terminal: 20 }],
    ["cmo8lfqtm0000bum0qhw7d33h", { assigned: 6, onScene: 14, terminal: 22 }],
    ["cmonjz31i0000bu049cookh29", { assigned: 7, onScene: 16, terminal: null }],
    ["cmonkkmup0000bu6gi7qtaxrl", { assigned: 8, onScene: 18, terminal: 24 }],
    ["cmosomchw0004bu7srahis9i0", { assigned: 3, onScene: 10, terminal: 16 }],
  ]);
  const reports = db.prepare(`
    SELECT
      "id", "createdAt", "assignedAt", "acceptedAt", "rejectedAt", "dispatchedAt",
      "onSceneAt", "rescueStartedAt", "unableToLocateAt", "failedAt", "resolvedAt"
    FROM "StrayAnimalReport"
    ORDER BY "createdAt", "id"
  `).all();
  const update = db.prepare(`
    UPDATE "StrayAnimalReport" SET
      "assignedAt" = ?, "acceptedAt" = ?, "rejectedAt" = ?, "dispatchedAt" = ?,
      "onSceneAt" = ?, "rescueStartedAt" = ?, "unableToLocateAt" = ?, "failedAt" = ?,
      "resolvedAt" = ?, "updatedAt" = ?
    WHERE "id" = ?
  `);
  let normalized = 0;

  reports.forEach((report, index) => {
    const profile = legacyTimingProfiles.get(report.id);
    const terminalAt = report.resolvedAt ?? report.unableToLocateAt ?? report.failedAt;
    const hasStaleMilestone =
      (delayHours(report.assignedAt, report.createdAt) ?? 0) > 24 ||
      (delayHours(report.onSceneAt, report.createdAt) ?? 0) > 48 ||
      (delayHours(terminalAt, report.createdAt) ?? 0) > 72;

    if (!profile && !hasStaleMilestone) return;

    const assignedAt = report.assignedAt === null
      ? null
      : report.createdAt + (profile?.assigned ?? (2 + (index % 4))) * hourMs;
    const fieldBase = assignedAt ?? report.createdAt + 3 * hourMs;
    const acceptedAt = report.acceptedAt === null ? null : fieldBase + hourMs;
    const rejectedAt = report.rejectedAt === null ? null : fieldBase + hourMs;
    const dispatchedAt = report.dispatchedAt === null ? null : fieldBase + 2 * hourMs;
    const onSceneAt = report.onSceneAt === null
      ? null
      : profile?.onScene !== null && profile?.onScene !== undefined
        ? report.createdAt + profile.onScene * hourMs
        : fieldBase + (4 + (index % 2)) * hourMs;
    const outcomeBase = onSceneAt ?? dispatchedAt ?? acceptedAt ?? rejectedAt ?? fieldBase;
    const rescueStartedAt = report.rescueStartedAt === null ? null : outcomeBase + hourMs;
    const terminalAtNormalized = profile?.terminal !== null && profile?.terminal !== undefined
      ? report.createdAt + profile.terminal * hourMs
      : outcomeBase + (2 + (index % 3)) * hourMs;
    const unableToLocateAt = report.unableToLocateAt === null ? null : terminalAtNormalized;
    const failedAt = report.failedAt === null ? null : terminalAtNormalized;
    const resolvedAt = report.resolvedAt === null ? null : terminalAtNormalized;
    const updatedAt = Math.max(
      report.createdAt,
      ...[
        assignedAt,
        acceptedAt,
        rejectedAt,
        dispatchedAt,
        onSceneAt,
        rescueStartedAt,
        unableToLocateAt,
        failedAt,
        resolvedAt,
      ].filter((value) => value !== null)
    );

    normalized += Number(update.run(
      assignedAt,
      acceptedAt,
      rejectedAt,
      dispatchedAt,
      onSceneAt,
      rescueStartedAt,
      unableToLocateAt,
      failedAt,
      resolvedAt,
      updatedAt,
      report.id
    ).changes);
  });

  return normalized;
}

db.exec("BEGIN IMMEDIATE;");
try {
  const fieldAgent = db.prepare(`
    SELECT "id" FROM "User"
    WHERE "role" IN ('FIELD_AGENT', 'ADMIN')
    ORDER BY CASE WHEN "role" = 'FIELD_AGENT' THEN 0 ELSE 1 END, "createdAt", "id"
    LIMIT 1
  `).get();

  const assignedInspections = fieldAgent
    ? Number(db.prepare(`
        UPDATE "AdoptionApplication"
        SET "assignedAgentId" = ?
        WHERE "inspectionCompletedAt" IS NOT NULL AND "assignedAgentId" IS NULL
      `).run(fieldAgent.id).changes)
    : 0;

  const normalizedPickups = Number(db.prepare(`
    UPDATE "AdoptionApplication"
    SET "pickupScheduledAt" = "adoptedAt" - ?
    WHERE "status" = 'ADOPTED'
      AND "adoptedAt" IS NOT NULL
      AND ("pickupScheduledAt" IS NULL OR "pickupScheduledAt" > "adoptedAt")
  `).run(hourMs).changes);

  const adoptedAnimals = Number(db.prepare(`
    UPDATE "ShelterAnimal"
    SET "status" = 'ADOPTED', "updatedAt" = ?
    WHERE "id" IN (
      SELECT DISTINCT "animalId" FROM "AdoptionApplication" WHERE "status" = 'ADOPTED'
    ) AND "status" <> 'ADOPTED'
  `).run(Date.now()).changes);

  const availableAnimals = Number(db.prepare(`
    UPDATE "ShelterAnimal"
    SET "status" = 'AVAILABLE', "updatedAt" = ?
    WHERE "status" = 'ADOPTED' AND "id" NOT IN (
      SELECT DISTINCT "animalId" FROM "AdoptionApplication" WHERE "status" = 'ADOPTED'
    )
  `).run(Date.now()).changes);

  const normalizedReports = normalizeReportTimings();
  db.exec("COMMIT;");

  console.log("Analytics data normalization complete.");
  console.table({
    adoptedAnimals,
    assignedInspections,
    availableAnimals,
    normalizedPickups,
    normalizedReports,
  });
} catch (error) {
  db.exec("ROLLBACK;");
  throw error;
} finally {
  db.close();
}
