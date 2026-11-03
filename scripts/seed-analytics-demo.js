const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.join(__dirname, "..", "Database", "dev.db");
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON;");

const seedPrefix = "demo-analytics-";
const hourMs = 60 * 60 * 1000;
const now = new Date();
const seedYear = now.getUTCFullYear();
const firstMonthIndex = 3;
const lastMonthIndex = now.getUTCMonth();

if (lastMonthIndex < firstMonthIndex) {
  throw new Error(`Analytics demo data starts in April ${seedYear}. Run this seed from April onward.`);
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(Number(`${seedYear}0824`));

function randomInt(minimum, maximum) {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function pick(values, index = null) {
  return values[index === null ? randomInt(0, values.length - 1) : index % values.length];
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomInt(0, index);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function balancedStatuses(statuses, total) {
  return shuffle(Array.from({ length: total }, (_, index) => statuses[index % statuses.length]));
}

function monthKey(monthIndex) {
  return `${seedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function randomCreatedAt(monthIndex) {
  const daysInMonth = new Date(Date.UTC(seedYear, monthIndex + 1, 0)).getUTCDate();
  const isCurrentMonth = monthIndex === lastMonthIndex;
  const availableDay = isCurrentMonth ? Math.max(4, now.getUTCDate() - 10) : daysInMonth - 10;
  const day = randomInt(2, Math.max(2, availableDay));
  return new Date(Date.UTC(seedYear, monthIndex, day, randomInt(8, 16), randomInt(0, 59)));
}

function advance(date, minimumHours, maximumHours) {
  const advanced = new Date(date.getTime() + randomInt(minimumHours, maximumHours) * hourMs);
  const latestAllowed = new Date(now.getTime() - hourMs);
  return advanced > latestAllowed ? latestAllowed : advanced;
}

function toDatabaseDate(date) {
  return date ? date.getTime() : null;
}

function insertRows(tableName, columns, rows) {
  const placeholders = columns.map(() => "?").join(", ");
  const statement = db.prepare(
    `INSERT INTO "${tableName}" (${columns.map((column) => `"${column}"`).join(", ")}) ` +
      `VALUES (${placeholders}) ON CONFLICT("id") DO NOTHING`
  );
  let inserted = 0;

  for (const row of rows) {
    const result = statement.run(...columns.map((column) => row[column] ?? null));
    inserted += Number(result.changes);
  }

  return inserted;
}

function synchronizeDemoApplicationOutcomes(rows) {
  const milestoneColumns = [
    "status",
    "assignedAgentId",
    "inspectionAssignedAt",
    "inspectionCompletedAt",
    "inspectionRecommendation",
    "inspectionPropertySafe",
    "inspectionSecureYard",
    "inspectionPetsCompatible",
    "inspectionNotes",
    "pickupScheduledAt",
    "pickupNote",
    "adoptedAt",
    "updatedAt",
  ];
  const statement = db.prepare(
    `UPDATE "AdoptionApplication" SET ${milestoneColumns.map((column) => `"${column}" = ?`).join(", ")} ` +
      'WHERE "id" = ?'
  );
  const adoptAnimal = db.prepare(
    'UPDATE "ShelterAnimal" SET "status" = ?, "updatedAt" = ? WHERE "id" = ?'
  );
  let synchronized = 0;

  for (const row of rows) {
    synchronized += Number(
      statement.run(...milestoneColumns.map((column) => row[column] ?? null), row.id).changes
    );
    if (row.status === "ADOPTED") {
      adoptAnimal.run("ADOPTED", row.updatedAt, row.animalId);
    }
  }

  return synchronized;
}

function synchronizeDemoReportImages(rows, sourceImages) {
  if (!sourceImages.length) return 0;

  const statement = db.prepare(`
    INSERT INTO "StrayAnimalReportImage" (
      "id", "reportId", "dataUri", "mimeType", "fileName", "sortOrder", "createdAt"
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT("id") DO UPDATE SET
      "dataUri" = excluded."dataUri",
      "mimeType" = excluded."mimeType",
      "fileName" = excluded."fileName",
      "sortOrder" = excluded."sortOrder"
  `);
  let synchronized = 0;

  rows.forEach((row, index) => {
    const matchingImages = sourceImages.filter((image) => image.animalType === row.animalType);
    const candidates = matchingImages.length ? matchingImages : sourceImages;
    const source = candidates[index % candidates.length];
    const extension = source.mimeType === "image/png"
      ? "png"
      : source.mimeType === "image/webp"
        ? "webp"
        : "jpg";
    const fileName = `report-photo-${row.createdAt}-${String(index + 1).padStart(2, "0")}.${extension}`;

    synchronized += Number(
      statement.run(
        `${row.id}-evidence-01`,
        row.id,
        source.dataUri,
        source.mimeType,
        fileName,
        0,
        row.createdAt
      ).changes
    );
  });

  return synchronized;
}

function clearDemoData() {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const tables = ["AdoptionApplication", "StrayAnimalReport", "AnimalSurrenderRequest"];
    let deleted = 0;
    for (const table of tables) {
      deleted += Number(db.prepare(`DELETE FROM "${table}" WHERE "id" LIKE ?`).run(`${seedPrefix}%`).changes);
    }
    db.exec("COMMIT;");
    console.log(`Removed ${deleted} analytics demo records.`);
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

if (process.argv.includes("--clear")) {
  clearDemoData();
  db.close();
  process.exit(0);
}

const users = db.prepare('SELECT "id", "email", "fullName", "role" FROM "User" ORDER BY "createdAt"').all();
const applicants = users.filter((user) => user.role === "USER");
const fieldAgents = users.filter((user) => user.role === "FIELD_AGENT");
const animals = db
  .prepare('SELECT "id", "name", "type" FROM "ShelterAnimal" ORDER BY "name", "id"')
  .all();
const reusableReportImages = db.prepare(`
  SELECT image."dataUri", image."mimeType", report."animalType"
  FROM "StrayAnimalReportImage" image
  INNER JOIN "StrayAnimalReport" report ON report."id" = image."reportId"
  WHERE report."id" NOT LIKE ?
  ORDER BY report."createdAt", image."sortOrder", image."id"
`).all(`${seedPrefix}%`);

if (!applicants.length || !fieldAgents.length || !animals.length) {
  throw new Error("Seed requires at least one user, one field agent, and one shelter animal.");
}

const monthPlans = [];
for (let monthIndex = firstMonthIndex; monthIndex <= lastMonthIndex; monthIndex += 1) {
  monthPlans.push({
    applications: randomInt(3, 5),
    monthIndex,
    reports: randomInt(4, 6),
    surrenders: randomInt(2, 4),
  });
}

const reportFieldStatuses = [
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
];
const surrenderStatuses = ["SUBMITTED", "CONTACTED", "INTAKE_SCHEDULED", "COMPLETED"];

const applicantNames = [
  "Lerato Molefe",
  "Thabo Nkosi",
  "Naledi Mokoena",
  "Kagiso Dlamini",
  "Ayanda Khumalo",
  "Zanele Sithole",
  "Sibusiso Ndlovu",
  "Palesa Maseko",
  "Tshepo Radebe",
  "Boitumelo Modise",
];
const areas = [
  "Randburg",
  "Roodepoort",
  "Soweto",
  "Sandton",
  "Midrand",
  "Fourways",
  "Alexandra",
  "Braamfontein",
  "Melville",
  "Rosebank",
];
const streets = ["Oak Avenue", "Main Road", "Protea Street", "Market Street", "Acacia Road"];
const dogBreeds = ["Mixed breed", "Labrador mix", "Terrier mix", "Africanis", "Spaniel mix"];
const catBreeds = ["Domestic shorthair", "Tabby", "Domestic longhair", "Calico", "Ginger mix"];
const conditions = ["Alert", "Hungry", "Minor injury", "Scared", "Tired", "Good condition"];
const surrenderReasons = [
  "Moving to accommodation that does not allow pets.",
  "Family circumstances changed and care is no longer manageable.",
  "The owner can no longer meet the animal's daily care needs.",
  "The animal needs more space and attention than the household can provide.",
];

const applicationTotal = monthPlans.reduce((sum, plan) => sum + plan.applications, 0);
const reportTotal = monthPlans.reduce((sum, plan) => sum + plan.reports, 0);
const surrenderTotal = monthPlans.reduce((sum, plan) => sum + plan.surrenders, 0);
const applicationStatusQueue = shuffle([
  ...Array.from({ length: Math.max(0, applicationTotal - 1) }, () => "ADOPTED"),
  ...(applicationTotal ? ["APPROVED"] : []),
]);
const reportStatusQueue = balancedStatuses(reportFieldStatuses, reportTotal);
const surrenderStatusQueue = balancedStatuses(surrenderStatuses, surrenderTotal);

const applications = [];
const reports = [];
const surrenders = [];
let applicationIndex = 0;
let reportIndex = 0;
let surrenderIndex = 0;

for (const plan of monthPlans) {
  for (let index = 0; index < plan.applications; index += 1) {
    const sequence = applicationIndex + 1;
    const status = applicationStatusQueue[applicationIndex];
    const createdAt = randomCreatedAt(plan.monthIndex);
    const applicant = pick(applicants, sequence);
    const agent = pick(fieldAgents, sequence);
    const animal = pick(animals, sequence * 3);
    const applicantName = pick(applicantNames, sequence);
    const needsAssignment = [
      "INSPECTION_ASSIGNED",
      "INSPECTION_COMPLETED",
      "APPROVED",
      "DECLINED",
      "PICKUP_SCHEDULED",
      "ADOPTED",
    ].includes(status);
    const hasInspection = ["INSPECTION_COMPLETED", "APPROVED", "DECLINED", "PICKUP_SCHEDULED", "ADOPTED"].includes(status);
    const hasPickup = ["PICKUP_SCHEDULED", "ADOPTED"].includes(status);
    const inspectionAssignedAt = needsAssignment ? advance(createdAt, 18, 72) : null;
    const inspectionCompletedAt = hasInspection ? advance(inspectionAssignedAt, 48, 144) : null;
    const pickupScheduledAt = hasPickup ? advance(inspectionCompletedAt, 72, 240) : null;
    const adoptedAt = status === "ADOPTED" ? advance(pickupScheduledAt, 24, 72) : null;
    const updatedAt = adoptedAt || pickupScheduledAt || inspectionCompletedAt || inspectionAssignedAt || advance(createdAt, 4, 36);

    applications.push({
      address: `${randomInt(4, 248)} ${pick(streets)}, ${pick(areas)}`,
      adoptedAt: toDatabaseDate(adoptedAt),
      animalId: animal.id,
      applicantId: applicant.id,
      applicantName,
      assignedAgentId: needsAssignment ? agent.id : null,
      createdAt: toDatabaseDate(createdAt),
      email: `demo.applicant.${String(sequence).padStart(2, "0")}@example.test`,
      experience: pick([
        "Previously cared for a family dog.",
        "First-time adopter with family support.",
        "Has experience with rescued cats and dogs.",
      ]),
      hasOtherPets: sequence % 3 === 0 ? 1 : 0,
      hasYard: sequence % 2 === 0 ? 1 : 0,
      householdAgreement: 1,
      housingType: pick(["House", "Townhouse", "Apartment"], sequence),
      id: `${seedPrefix}${monthKey(plan.monthIndex)}-application-${String(index + 1).padStart(2, "0")}`,
      inspectionAssignedAt: toDatabaseDate(inspectionAssignedAt),
      inspectionCompletedAt: toDatabaseDate(inspectionCompletedAt),
      inspectionNotes: hasInspection ? "Demo inspection completed; property and household were assessed." : null,
      inspectionPetsCompatible: hasInspection ? (status === "DECLINED" ? 0 : 1) : null,
      inspectionPropertySafe: hasInspection ? (status === "DECLINED" ? 0 : 1) : null,
      inspectionRecommendation: hasInspection ? (status === "DECLINED" ? "DECLINE" : "APPROVE") : null,
      inspectionSecureYard: hasInspection ? (status === "DECLINED" ? 0 : 1) : null,
      otherPetsDetails: sequence % 3 === 0 ? "One vaccinated pet already lives in the home." : null,
      phone: `07${randomInt(1, 9)} 555 ${String(1000 + sequence).slice(-4)}`,
      pickupNote: hasPickup ? "Demo pickup arranged with the adoption team." : null,
      pickupScheduledAt: toDatabaseDate(pickupScheduledAt),
      reason: `The applicant would like to give ${animal.name} a stable home and has planned for daily care, exercise, and veterinary costs.`,
      schedule: "Someone is normally home before and after work, with flexible weekends.",
      status,
      updatedAt: toDatabaseDate(updatedAt),
    });
    applicationIndex += 1;
  }

  for (let index = 0; index < plan.reports; index += 1) {
    const sequence = reportIndex + 1;
    const fieldStatus = reportStatusQueue[reportIndex];
    const createdAt = randomCreatedAt(plan.monthIndex);
    const reporter = pick(applicants, sequence + 1);
    const agent = pick(fieldAgents, sequence);
    const area = pick(areas, sequence * 2);
    const terminal = ["HELPED", "UNABLE_TO_LOCATE", "FAILED"].includes(fieldStatus);
    const assigned = fieldStatus !== "UNASSIGNED";
    const assignedAt = assigned ? advance(createdAt, 1, 8) : null;
    const acceptedAt = ["ACCEPTED", "EN_ROUTE", "ON_SCENE", "RESCUE_IN_PROGRESS", "HELPED", "UNABLE_TO_LOCATE", "FAILED"].includes(fieldStatus)
      ? advance(assignedAt, 1, 4)
      : null;
    const rejectedAt = fieldStatus === "REJECTED" ? advance(assignedAt, 1, 5) : null;
    const dispatchedAt = ["EN_ROUTE", "ON_SCENE", "RESCUE_IN_PROGRESS", "HELPED", "UNABLE_TO_LOCATE", "FAILED"].includes(fieldStatus)
      ? advance(acceptedAt, 1, 3)
      : null;
    const onSceneAt = ["ON_SCENE", "RESCUE_IN_PROGRESS", "HELPED", "UNABLE_TO_LOCATE", "FAILED"].includes(fieldStatus)
      ? advance(dispatchedAt, 1, 4)
      : null;
    const rescueStartedAt = ["RESCUE_IN_PROGRESS", "HELPED"].includes(fieldStatus) ? advance(onSceneAt, 1, 2) : null;
    const resolvedAt = fieldStatus === "HELPED" ? advance(rescueStartedAt, 1, 5) : null;
    const unableToLocateAt = fieldStatus === "UNABLE_TO_LOCATE" ? advance(onSceneAt, 1, 4) : null;
    const failedAt = fieldStatus === "FAILED" ? advance(onSceneAt, 1, 4) : null;
    const finalMilestone = resolvedAt || unableToLocateAt || failedAt || rescueStartedAt || onSceneAt || dispatchedAt || acceptedAt || rejectedAt || assignedAt;

    reports.push({
      acceptedAt: toDatabaseDate(acceptedAt),
      animalType: sequence % 5 === 0 ? "Other" : sequence % 2 === 0 ? "Cat" : "Dog",
      assignedAgentId: assigned ? agent.id : null,
      assignedAt: toDatabaseDate(assignedAt),
      condition: pick(conditions),
      createdAt: toDatabaseDate(createdAt),
      description: `Demo report of a stray animal seen near ${area}. The animal was observed from a safe distance and the location details were recorded.`,
      dispatchedAt: toDatabaseDate(dispatchedAt),
      failedAt: toDatabaseDate(failedAt),
      fieldNotes: assigned ? "Demo field case used for historical analytics testing." : null,
      fieldOutcome: terminal ? pick(["Animal assisted", "Area searched", "Case closed after field assessment"]) : null,
      fieldStatus,
      id: `${seedPrefix}${monthKey(plan.monthIndex)}-report-${String(index + 1).padStart(2, "0")}`,
      imageUrl: null,
      latitude: -26.2041 + (random() - 0.5) * 0.22,
      location: `${randomInt(1, 220)} ${pick(streets)}, ${area}`,
      longitude: 28.0473 + (random() - 0.5) * 0.22,
      onSceneAt: toDatabaseDate(onSceneAt),
      rejectedAt: toDatabaseDate(rejectedAt),
      reporterId: sequence % 4 === 0 ? null : reporter.id,
      reporterName: sequence % 4 === 0 ? "Anonymous" : reporter.fullName,
      rescueStartedAt: toDatabaseDate(rescueStartedAt),
      resolvedAt: toDatabaseDate(resolvedAt),
      status: fieldStatus === "UNASSIGNED" ? "OPEN" : terminal ? "RESOLVED" : "IN_PROGRESS",
      unableToLocateAt: toDatabaseDate(unableToLocateAt),
      updatedAt: toDatabaseDate(finalMilestone || advance(createdAt, 2, 12)),
    });
    reportIndex += 1;
  }

  for (let index = 0; index < plan.surrenders; index += 1) {
    const sequence = surrenderIndex + 1;
    const status = surrenderStatusQueue[surrenderIndex];
    const createdAt = randomCreatedAt(plan.monthIndex);
    const owner = pick(applicants, sequence + 2);
    const animalType = sequence % 2 === 0 ? "Cat" : "Dog";
    const scheduledIntakeAt = ["INTAKE_SCHEDULED", "COMPLETED"].includes(status)
      ? advance(createdAt, 72, 240)
      : null;
    const completedAt = status === "COMPLETED" ? advance(scheduledIntakeAt, 24, 96) : null;

    surrenders.push({
      address: `${randomInt(3, 260)} ${pick(streets)}, ${pick(areas)}`,
      age: `${randomInt(1, 9)} years`,
      animalName: pick(["Max", "Luna", "Rocky", "Misty", "Coco", "Simba"], sequence),
      animalType,
      behaviorNotes: "Friendly in familiar surroundings; a gradual introduction is recommended.",
      breed: animalType === "Dog" ? pick(dogBreeds) : pick(catBreeds),
      color: pick(["Black", "Brown", "White", "Tan", "Grey", "Mixed"]),
      completedAt: toDatabaseDate(completedAt),
      createdAt: toDatabaseDate(createdAt),
      email: `demo.owner.${String(sequence).padStart(2, "0")}@example.test`,
      healthNotes: sequence % 4 === 0 ? "Routine veterinary check recommended." : "No known health concerns reported.",
      id: `${seedPrefix}${monthKey(plan.monthIndex)}-surrender-${String(index + 1).padStart(2, "0")}`,
      isAnonymous: sequence % 6 === 0 ? 1 : 0,
      microchipped: sequence % 3 === 0 ? 1 : 0,
      ownerId: sequence % 6 === 0 ? null : owner.id,
      ownerName: sequence % 6 === 0 ? "Anonymous" : owner.fullName,
      phone: `07${randomInt(1, 9)} 444 ${String(2000 + sequence).slice(-4)}`,
      preferredContactMethod: pick(["Phone", "Email", "WhatsApp"], sequence),
      reason: pick(surrenderReasons),
      scheduledIntakeAt: toDatabaseDate(scheduledIntakeAt),
      scheduledIntakeNote: scheduledIntakeAt ? "Demo intake appointment confirmed with the owner." : null,
      sex: sequence % 2 === 0 ? "Female" : "Male",
      shelterAnimalId: null,
      status,
      sterilized: sequence % 3 !== 0 ? 1 : 0,
      updatedAt: toDatabaseDate(completedAt || scheduledIntakeAt || advance(createdAt, 12, 72)),
      urgency: pick(["This week", "Within two weeks", "This month", "Flexible"], sequence),
      vaccinated: sequence % 4 !== 0 ? 1 : 0,
    });
    surrenderIndex += 1;
  }
}

const applicationColumns = [
  "id", "animalId", "applicantId", "applicantName", "email", "phone", "address", "housingType",
  "hasYard", "hasOtherPets", "otherPetsDetails", "experience", "reason", "schedule", "householdAgreement",
  "status", "assignedAgentId", "inspectionAssignedAt", "inspectionCompletedAt", "inspectionRecommendation",
  "inspectionPropertySafe", "inspectionSecureYard", "inspectionPetsCompatible", "inspectionNotes", "pickupScheduledAt",
  "pickupNote", "adoptedAt", "createdAt", "updatedAt",
];
const reportColumns = [
  "reporterName", "id", "animalType", "condition", "location", "latitude", "longitude", "description",
  "imageUrl", "status", "fieldStatus", "fieldNotes", "fieldOutcome", "reporterId", "assignedAgentId",
  "assignedAt", "acceptedAt", "rejectedAt", "dispatchedAt", "onSceneAt", "rescueStartedAt",
  "unableToLocateAt", "failedAt", "resolvedAt", "createdAt", "updatedAt",
];
const surrenderColumns = [
  "id", "isAnonymous", "ownerId", "ownerName", "email", "phone", "address", "preferredContactMethod",
  "animalName", "animalType", "breed", "age", "sex", "color", "vaccinated", "sterilized", "microchipped",
  "healthNotes", "behaviorNotes", "reason", "urgency", "scheduledIntakeAt", "scheduledIntakeNote", "completedAt",
  "shelterAnimalId", "status", "createdAt", "updatedAt",
];

db.exec("BEGIN IMMEDIATE;");
try {
  const insertedApplications = insertRows("AdoptionApplication", applicationColumns, applications);
  const insertedReports = insertRows("StrayAnimalReport", reportColumns, reports);
  const insertedSurrenders = insertRows("AnimalSurrenderRequest", surrenderColumns, surrenders);
  const synchronizedApplications = synchronizeDemoApplicationOutcomes(applications);
  const synchronizedReportImages = synchronizeDemoReportImages(reports, reusableReportImages);
  db.exec("COMMIT;");

  console.log(`Analytics demo seed complete for April-${now.toLocaleString("en-ZA", { month: "long" })} ${seedYear}.`);
  console.table(
    monthPlans.map((plan) => ({
      applications: plan.applications,
      month: monthKey(plan.monthIndex),
      reports: plan.reports,
      surrenders: plan.surrenders,
      total: plan.applications + plan.reports + plan.surrenders,
    }))
  );
  console.log(
    `Inserted ${insertedApplications} applications, ${insertedReports} reports, and ${insertedSurrenders} surrenders.`
  );
  console.log(`Synchronized ${synchronizedApplications} demo application outcomes.`);
  console.log(`Attached ${synchronizedReportImages} reused report images to demo cases.`);
  if (insertedApplications + insertedReports + insertedSurrenders === 0) {
    console.log("All demo records already existed; no duplicates were added.");
  }
} catch (error) {
  db.exec("ROLLBACK;");
  throw error;
} finally {
  db.close();
}
