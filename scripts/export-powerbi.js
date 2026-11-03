require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const outputDirectory = path.resolve(__dirname, "../powerbi-data");

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const normalized = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function writeCsv(fileName, rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvValue(row[column])).join(","));
  }
  fs.writeFileSync(path.join(outputDirectory, fileName), `${lines.join("\r\n")}\r\n`, "utf8");
  return rows.length;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildCalendar(dates) {
  const validDates = dates.filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));
  const today = startOfDay(new Date());
  const earliest = validDates.length
    ? startOfDay(new Date(Math.min(...validDates.map((date) => date.getTime()))))
    : today;
  const latestDataDate = validDates.length
    ? startOfDay(new Date(Math.max(...validDates.map((date) => date.getTime()))))
    : today;
  const latest = latestDataDate > today ? latestDataDate : today;
  const rows = [];

  for (const current = new Date(earliest); current <= latest; current.setDate(current.getDate() + 1)) {
    const date = new Date(current);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    rows.push({
      Date: localDateKey(date),
      Year: year,
      Quarter: `Q${quarter}`,
      MonthNumber: month,
      Month: date.toLocaleString("en-ZA", { month: "long" }),
      YearMonth: `${year}-${String(month).padStart(2, "0")}`,
      Day: date.getDate(),
      DayOfWeek: date.toLocaleString("en-ZA", { weekday: "long" }),
    });
  }

  return rows;
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const [users, animals, applications, reports, surrenders] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shelterAnimal.findMany({
      select: {
        id: true, name: true, type: true, age: true, sex: true, breed: true, size: true,
        energy: true, bestFor: true, location: true, vaccinated: true, status: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adoptionApplication.findMany({
      select: {
        id: true, animalId: true, applicantId: true, assignedAgentId: true, housingType: true,
        hasYard: true, hasOtherPets: true, householdAgreement: true, status: true,
        inspectionAssignedAt: true, inspectionCompletedAt: true, inspectionRecommendation: true,
        pickupScheduledAt: true, adoptedAt: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.strayAnimalReport.findMany({
      select: {
        id: true, reporterId: true, assignedAgentId: true, animalType: true, condition: true,
        status: true, fieldStatus: true, assignedAt: true, acceptedAt: true, dispatchedAt: true,
        onSceneAt: true, rescueStartedAt: true, unableToLocateAt: true, failedAt: true,
        resolvedAt: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.animalSurrenderRequest.findMany({
      select: {
        id: true, ownerId: true, shelterAnimalId: true, animalType: true, vaccinated: true,
        sterilized: true, microchipped: true, urgency: true, status: true,
        scheduledIntakeAt: true, completedAt: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userRows = users.map((row) => ({
    UserId: row.id,
    Role: row.role,
    RegisteredDate: localDateKey(row.createdAt),
    CreatedAt: row.createdAt,
    UpdatedAt: row.updatedAt,
  }));
  const animalRows = animals.map((row) => ({
    AnimalId: row.id,
    Name: row.name,
    Type: row.type,
    Age: row.age,
    Sex: row.sex,
    Breed: row.breed,
    Size: row.size,
    Energy: row.energy,
    BestFor: row.bestFor,
    ShelterLocation: row.location,
    Vaccinated: row.vaccinated,
    Status: row.status,
    CreatedDate: localDateKey(row.createdAt),
    CreatedAt: row.createdAt,
    UpdatedAt: row.updatedAt,
  }));
  const applicationRows = applications.map((row) => ({
    ApplicationId: row.id,
    AnimalId: row.animalId,
    ApplicantUserId: row.applicantId,
    AssignedAgentUserId: row.assignedAgentId,
    HousingType: row.housingType,
    HasYard: row.hasYard,
    HasOtherPets: row.hasOtherPets,
    HouseholdAgreement: row.householdAgreement,
    Status: row.status,
    InspectionRecommendation: row.inspectionRecommendation,
    CreatedDate: localDateKey(row.createdAt),
    CreatedAt: row.createdAt,
    InspectionAssignedAt: row.inspectionAssignedAt,
    InspectionCompletedAt: row.inspectionCompletedAt,
    PickupScheduledAt: row.pickupScheduledAt,
    AdoptedAt: row.adoptedAt,
    UpdatedAt: row.updatedAt,
  }));
  const reportRows = reports.map((row) => ({
    ReportId: row.id,
    ReporterUserId: row.reporterId,
    AssignedAgentUserId: row.assignedAgentId,
    ReportingMode: row.reporterId ? "Registered" : "Anonymous",
    AnimalType: row.animalType,
    Condition: row.condition,
    Status: row.status,
    FieldStatus: row.fieldStatus,
    CreatedDate: localDateKey(row.createdAt),
    CreatedAt: row.createdAt,
    AssignedAt: row.assignedAt,
    AcceptedAt: row.acceptedAt,
    DispatchedAt: row.dispatchedAt,
    OnSceneAt: row.onSceneAt,
    RescueStartedAt: row.rescueStartedAt,
    UnableToLocateAt: row.unableToLocateAt,
    FailedAt: row.failedAt,
    ResolvedAt: row.resolvedAt,
    UpdatedAt: row.updatedAt,
  }));
  const surrenderRows = surrenders.map((row) => ({
    SurrenderId: row.id,
    OwnerUserId: row.ownerId,
    ShelterAnimalId: row.shelterAnimalId,
    SubmissionMode: row.ownerId ? "Registered" : "Anonymous",
    AnimalType: row.animalType,
    Vaccinated: row.vaccinated,
    Sterilized: row.sterilized,
    Microchipped: row.microchipped,
    Urgency: row.urgency,
    Status: row.status,
    CreatedDate: localDateKey(row.createdAt),
    CreatedAt: row.createdAt,
    ScheduledIntakeAt: row.scheduledIntakeAt,
    CompletedAt: row.completedAt,
    UpdatedAt: row.updatedAt,
  }));

  const calendarRows = buildCalendar([
    ...users.map((row) => row.createdAt),
    ...animals.map((row) => row.createdAt),
    ...applications.map((row) => row.createdAt),
    ...reports.map((row) => row.createdAt),
    ...surrenders.map((row) => row.createdAt),
  ]);

  const counts = {
    "users.csv": writeCsv("users.csv", userRows, Object.keys(userRows[0] || { UserId: "", Role: "", RegisteredDate: "", CreatedAt: "", UpdatedAt: "" })),
    "animals.csv": writeCsv("animals.csv", animalRows, Object.keys(animalRows[0] || { AnimalId: "", Name: "", Type: "", Status: "", CreatedDate: "" })),
    "adoption-applications.csv": writeCsv("adoption-applications.csv", applicationRows, Object.keys(applicationRows[0] || { ApplicationId: "", AnimalId: "", ApplicantUserId: "", Status: "", CreatedDate: "" })),
    "stray-reports.csv": writeCsv("stray-reports.csv", reportRows, Object.keys(reportRows[0] || { ReportId: "", ReporterUserId: "", Status: "", CreatedDate: "" })),
    "surrenders.csv": writeCsv("surrenders.csv", surrenderRows, Object.keys(surrenderRows[0] || { SurrenderId: "", OwnerUserId: "", Status: "", CreatedDate: "" })),
    "calendar.csv": writeCsv("calendar.csv", calendarRows, Object.keys(calendarRows[0])),
  };

  fs.writeFileSync(
    path.join(outputDirectory, "export-summary.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), files: counts }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Power BI data exported to ${outputDirectory}`);
  for (const [file, count] of Object.entries(counts)) console.log(`${file}: ${count} rows`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
