const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const databaseDir = path.join(__dirname, "..", "Database");
const databasePath = path.join(databaseDir, "dev.db");

fs.mkdirSync(databaseDir, { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON;");

function getPublicAssetPath(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const assetPath = normalizedPath.startsWith("mobile-app/assets/")
    ? normalizedPath.slice("mobile-app/assets/".length)
    : normalizedPath;

  return `/assets/${assetPath.split("/").map(encodeURIComponent).join("/")}`;
}

function getImageReference(relativePath) {
  const imagePath = path.join(__dirname, "..", "..", relativePath);
  const extension = path.extname(imagePath).toLowerCase();
  const mimeType =
    extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Shelter animal image was not found: ${relativePath}`);
  }

  return {
    dataUri: getPublicAssetPath(relativePath),
    mimeType,
  };
}

function createStrayAnimalReportTable(tableName) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      "reporterName" TEXT NOT NULL DEFAULT 'Anonymous',
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalType" TEXT NOT NULL,
      "condition" TEXT,
      "location" TEXT NOT NULL,
      "latitude" REAL,
      "longitude" REAL,
      "description" TEXT NOT NULL,
      "imageUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "reporterId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "${tableName}_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
`);

createStrayAnimalReportTable("StrayAnimalReport");
createStrayAnimalReportImageTable();
createShelterAnimalTable();
createShelterAnimalImageTable();
createAdoptionApplicationTable();
createAdoptionApplicationDocumentTable();
createAnimalSurrenderRequestTable();
createAnimalSurrenderImageTable();

const userColumns = db.prepare('PRAGMA table_info("User")').all();

if (!userColumns.some((column) => column.name === "role")) {
  db.exec('ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT \'USER\';');
}

let reportColumns = db.prepare('PRAGMA table_info("StrayAnimalReport")').all();
const hasReporterName = reportColumns.some((column) => column.name === "reporterName");
const reporterNameIsFirst = reportColumns[0]?.name === "reporterName";
const hasLatitude = reportColumns.some((column) => column.name === "latitude");
const hasLongitude = reportColumns.some((column) => column.name === "longitude");

if (!hasReporterName || !reporterNameIsFirst) {
  const reporterNameExpression = hasReporterName
    ? 'COALESCE(NULLIF("reporterName", \'\'), (SELECT "fullName" FROM "User" WHERE "User"."id" = "StrayAnimalReport"."reporterId"), \'Anonymous\')'
    : 'COALESCE((SELECT "fullName" FROM "User" WHERE "User"."id" = "StrayAnimalReport"."reporterId"), \'Anonymous\')';
  const latitudeExpression = hasLatitude ? '"latitude"' : "NULL";
  const longitudeExpression = hasLongitude ? '"longitude"' : "NULL";

  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS "StrayAnimalReport_reordered";
  `);

  createStrayAnimalReportTable("StrayAnimalReport_reordered");

  db.exec(`
    INSERT INTO "StrayAnimalReport_reordered" (
      "reporterName",
      "id",
      "animalType",
      "condition",
      "location",
      "latitude",
      "longitude",
      "description",
      "imageUrl",
      "status",
      "reporterId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      ${reporterNameExpression},
      "id",
      "animalType",
      "condition",
      "location",
      ${latitudeExpression},
      ${longitudeExpression},
      "description",
      "imageUrl",
      "status",
      "reporterId",
      "createdAt",
      "updatedAt"
    FROM "StrayAnimalReport";

    DROP TABLE "StrayAnimalReport";
    ALTER TABLE "StrayAnimalReport_reordered" RENAME TO "StrayAnimalReport";
    PRAGMA foreign_keys = ON;
  `);
}

function createStrayAnimalReportImageTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "StrayAnimalReportImage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reportId" TEXT NOT NULL,
      "dataUri" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileName" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StrayAnimalReportImage_reportId_fkey"
        FOREIGN KEY ("reportId") REFERENCES "StrayAnimalReport" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function createShelterAnimalTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ShelterAnimal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "age" TEXT NOT NULL,
      "sex" TEXT NOT NULL,
      "breed" TEXT NOT NULL,
      "size" TEXT NOT NULL,
      "energy" TEXT NOT NULL,
      "bestFor" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "vaccinated" BOOLEAN NOT NULL DEFAULT false,
      "personalityJson" TEXT NOT NULL,
      "story" TEXT NOT NULL,
      "imageDataUri" TEXT NOT NULL,
      "imageMimeType" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);
}

function createShelterAnimalImageTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "ShelterAnimalImage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "dataUri" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileName" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShelterAnimalImage_animalId_fkey"
        FOREIGN KEY ("animalId") REFERENCES "ShelterAnimal" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function createAdoptionApplicationTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "AdoptionApplication" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "animalId" TEXT NOT NULL,
      "applicantId" TEXT,
      "applicantName" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "housingType" TEXT NOT NULL,
      "hasYard" BOOLEAN NOT NULL DEFAULT false,
      "hasOtherPets" BOOLEAN NOT NULL DEFAULT false,
      "otherPetsDetails" TEXT,
      "experience" TEXT,
      "reason" TEXT NOT NULL,
      "schedule" TEXT,
      "householdAgreement" BOOLEAN NOT NULL DEFAULT false,
      "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AdoptionApplication_animalId_fkey"
        FOREIGN KEY ("animalId") REFERENCES "ShelterAnimal" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "AdoptionApplication_applicantId_fkey"
        FOREIGN KEY ("applicantId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}

function createAdoptionApplicationDocumentTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "AdoptionApplicationDocument" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "applicationId" TEXT NOT NULL,
      "documentType" TEXT NOT NULL,
      "dataUri" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AdoptionApplicationDocument_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "AdoptionApplication" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function createAnimalSurrenderRequestTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "AnimalSurrenderRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
      "ownerId" TEXT,
      "ownerName" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "preferredContactMethod" TEXT NOT NULL DEFAULT 'Phone',
      "animalName" TEXT,
      "animalType" TEXT NOT NULL,
      "breed" TEXT,
      "age" TEXT,
      "sex" TEXT,
      "color" TEXT,
      "vaccinated" BOOLEAN NOT NULL DEFAULT false,
      "sterilized" BOOLEAN NOT NULL DEFAULT false,
      "microchipped" BOOLEAN NOT NULL DEFAULT false,
      "healthNotes" TEXT,
      "behaviorNotes" TEXT,
      "reason" TEXT NOT NULL,
      "urgency" TEXT NOT NULL,
      "scheduledIntakeAt" DATETIME,
      "scheduledIntakeNote" TEXT,
      "completedAt" DATETIME,
      "shelterAnimalId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AnimalSurrenderRequest_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "AnimalSurrenderRequest_shelterAnimalId_fkey"
        FOREIGN KEY ("shelterAnimalId") REFERENCES "ShelterAnimal" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
}

function createAnimalSurrenderImageTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "AnimalSurrenderImage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "surrenderId" TEXT NOT NULL,
      "dataUri" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileName" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AnimalSurrenderImage_surrenderId_fkey"
        FOREIGN KEY ("surrenderId") REFERENCES "AnimalSurrenderRequest" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

const featuredShelterAnimals = [
  {
    id: "buddy",
    name: "Buddy",
    type: "Dog",
    age: "3 years",
    sex: "Male",
    breed: "Mixed breed",
    size: "Large",
    energy: "Steady",
    bestFor: "Family rhythm",
    location: "Shelter yard",
    vaccinated: true,
    personality: ["Friendly", "Loyal", "Confident"],
    story: "Buddy is happiest next to people and has the easy charm of a dog who wants to belong.",
    imagePath: "mobile-app/assets/animals/dogs/101.jpeg",
  },
  {
    id: "milo",
    name: "Milo",
    type: "Cat",
    age: "8 months",
    sex: "Male",
    breed: "Domestic longhair",
    size: "Small",
    energy: "Playful",
    bestFor: "Indoor homes",
    location: "Foster care",
    vaccinated: true,
    personality: ["Playful", "Curious", "Indoor"],
    story: "Milo is a bright kitten who settles quickly when he has a warm lap and a toy mouse nearby.",
    imagePath: "mobile-app/assets/animals/cats/105.jpeg",
  },
  {
    id: "luna",
    name: "Luna",
    type: "Cat",
    age: "2 years",
    sex: "Female",
    breed: "Domestic shorthair",
    size: "Medium",
    energy: "Calm",
    bestFor: "Quiet spaces",
    location: "Shelter cattery",
    vaccinated: true,
    personality: ["Gentle", "Quiet", "Affectionate"],
    story: "Luna prefers calm homes and rewards patient people with soft head bumps and steady company.",
    imagePath: "mobile-app/assets/animals/cats/100.jpeg",
  },
  {
    id: "nova",
    name: "Nova",
    type: "Dog",
    age: "1 year",
    sex: "Female",
    breed: "Mixed breed",
    size: "Medium",
    energy: "Active",
    bestFor: "Training homes",
    location: "Kennel block A",
    vaccinated: true,
    personality: ["Energetic", "Smart", "Social"],
    story: "Nova loves training games and would thrive with someone who enjoys walks and routine.",
    imagePath: "mobile-app/assets/animals/dogs/107.jpeg",
  },
  {
    id: "coco",
    name: "Coco",
    type: "Dog",
    age: "5 years",
    sex: "Female",
    breed: "Mixed breed",
    size: "Small",
    energy: "Low-key",
    bestFor: "Gentle routines",
    location: "Foster care",
    vaccinated: true,
    personality: ["Calm", "Cuddly", "Patient"],
    story: "Coco has gentle manners and is looking for a quieter home with soft beds and short strolls.",
    imagePath: "mobile-app/assets/animals/dogs/10.jpeg",
  },
  {
    id: "max",
    name: "Max",
    type: "Dog",
    age: "2 years",
    sex: "Male",
    breed: "Mixed breed",
    size: "Medium",
    energy: "Upbeat",
    bestFor: "Active people",
    location: "Kennel block B",
    vaccinated: true,
    personality: ["Happy", "Brave", "People-loving"],
    story: "Max greets new friends with a wagging tail and is ready for an active family rhythm.",
    imagePath: "mobile-app/assets/animals/dogs/118.jpeg",
  },
];

const catPhotos = [
  { id: "cat-0", type: "Cat", imagePath: "mobile-app/assets/animals/cats/0.jpeg" },
  { id: "cat-1", type: "Cat", imagePath: "mobile-app/assets/animals/cats/1.jpeg" },
  { id: "cat-10", type: "Cat", imagePath: "mobile-app/assets/animals/cats/10.jpeg" },
  { id: "cat-104", type: "Cat", imagePath: "mobile-app/assets/animals/cats/104.jpeg" },
  { id: "cat-108", type: "Cat", imagePath: "mobile-app/assets/animals/cats/108.jpeg" },
  { id: "cat-11", type: "Cat", imagePath: "mobile-app/assets/animals/cats/11.jpeg" },
  {
    id: "cat-110",
    type: "Cat",
    imagePaths: [
      "mobile-app/assets/animals/cats/110.jpeg",
      "mobile-app/assets/animals/cats/110-picture2.jpeg",
      "mobile-app/assets/animals/cats/110-picture3.jpeg",
    ],
  },
  { id: "cat-112", type: "Cat", imagePath: "mobile-app/assets/animals/cats/112.jpeg" },
  { id: "cat-113", type: "Cat", imagePath: "mobile-app/assets/animals/cats/113.jpeg" },
  { id: "cat-115", type: "Cat", imagePath: "mobile-app/assets/animals/cats/115.jpeg" },
  { id: "cat-120", type: "Cat", imagePath: "mobile-app/assets/animals/cats/120.jpeg" },
  { id: "cat-121", type: "Cat", imagePath: "mobile-app/assets/animals/cats/121.jpeg" },
  { id: "cat-122", type: "Cat", imagePath: "mobile-app/assets/animals/cats/122.jpeg" },
  { id: "cat-123", type: "Cat", imagePath: "mobile-app/assets/animals/cats/123.jpeg" },
  { id: "cat-125", type: "Cat", imagePath: "mobile-app/assets/animals/cats/125.jpeg" },
  {
    id: "cat-128",
    type: "Cat",
    imagePaths: [
      "mobile-app/assets/animals/cats/128.jpeg",
      "mobile-app/assets/animals/cats/128-pic2.jpeg",
    ],
  },
  { id: "cat-131", type: "Cat", imagePath: "mobile-app/assets/animals/cats/131.jpeg" },
  { id: "cat-133", type: "Cat", imagePath: "mobile-app/assets/animals/cats/133.jpeg" },
  { id: "cat-134", type: "Cat", imagePath: "mobile-app/assets/animals/cats/134.jpeg" },
  { id: "cat-136", type: "Cat", imagePath: "mobile-app/assets/animals/cats/136.jpeg" },
  { id: "cat-14", type: "Cat", imagePath: "mobile-app/assets/animals/cats/14.jpeg" },
  { id: "cat-140", type: "Cat", imagePath: "mobile-app/assets/animals/cats/140.jpeg" },
  { id: "cat-141", type: "Cat", imagePath: "mobile-app/assets/animals/cats/141.jpeg" },
  { id: "cat-142", type: "Cat", imagePath: "mobile-app/assets/animals/cats/142.jpeg" },
  { id: "cat-143", type: "Cat", imagePath: "mobile-app/assets/animals/cats/143.jpeg" },
  { id: "cat-144", type: "Cat", imagePath: "mobile-app/assets/animals/cats/144.jpeg" },
  { id: "cat-145", type: "Cat", imagePath: "mobile-app/assets/animals/cats/145.jpeg" },
  { id: "cat-146", type: "Cat", imagePath: "mobile-app/assets/animals/cats/146.jpeg" },
  { id: "cat-147", type: "Cat", imagePath: "mobile-app/assets/animals/cats/147.jpeg" },
  { id: "cat-148", type: "Cat", imagePath: "mobile-app/assets/animals/cats/148.jpeg" },
  { id: "cat-149", type: "Cat", imagePath: "mobile-app/assets/animals/cats/149.jpeg" },
  { id: "cat-150", type: "Cat", imagePath: "mobile-app/assets/animals/cats/150.jpeg" },
  { id: "cat-151", type: "Cat", imagePath: "mobile-app/assets/animals/cats/151.jpeg" },
  { id: "cat-153", type: "Cat", imagePath: "mobile-app/assets/animals/cats/153.jpeg" },
  { id: "cat-154", type: "Cat", imagePath: "mobile-app/assets/animals/cats/154.jpeg" },
  { id: "cat-156", type: "Cat", imagePath: "mobile-app/assets/animals/cats/156.jpeg" },
  { id: "cat-158", type: "Cat", imagePath: "mobile-app/assets/animals/cats/158.jpeg" },
  { id: "cat-159", type: "Cat", imagePath: "mobile-app/assets/animals/cats/159.jpeg" },
  { id: "cat-16", type: "Cat", imagePath: "mobile-app/assets/animals/cats/16.jpeg" },
  { id: "cat-160", type: "Cat", imagePath: "mobile-app/assets/animals/cats/160.jpeg" },
  { id: "cat-162", type: "Cat", imagePath: "mobile-app/assets/animals/cats/162.jpeg" },
  { id: "cat-163", type: "Cat", imagePath: "mobile-app/assets/animals/cats/163.jpeg" },
  { id: "cat-164", type: "Cat", imagePath: "mobile-app/assets/animals/cats/164.jpeg" },
  { id: "cat-165", type: "Cat", imagePath: "mobile-app/assets/animals/cats/165.jpeg" },
  { id: "cat-166", type: "Cat", imagePath: "mobile-app/assets/animals/cats/166.jpeg" },
  { id: "cat-167", type: "Cat", imagePath: "mobile-app/assets/animals/cats/167.jpeg" },
  { id: "cat-168", type: "Cat", imagePath: "mobile-app/assets/animals/cats/168.jpeg" },
  { id: "cat-169", type: "Cat", imagePath: "mobile-app/assets/animals/cats/169.jpeg" },
  { id: "cat-17", type: "Cat", imagePath: "mobile-app/assets/animals/cats/17.jpeg" },
  { id: "cat-170", type: "Cat", imagePath: "mobile-app/assets/animals/cats/170.jpeg" },
  { id: "cat-171", type: "Cat", imagePath: "mobile-app/assets/animals/cats/171.jpeg" },
  { id: "cat-172", type: "Cat", imagePath: "mobile-app/assets/animals/cats/172.jpeg" },
  { id: "cat-174", type: "Cat", imagePath: "mobile-app/assets/animals/cats/174.jpeg" },
  { id: "cat-176", type: "Cat", imagePath: "mobile-app/assets/animals/cats/176.jpeg" },
  { id: "cat-177", type: "Cat", imagePath: "mobile-app/assets/animals/cats/177.jpeg" },
  { id: "cat-178", type: "Cat", imagePath: "mobile-app/assets/animals/cats/178.jpeg" },
  {
    id: "cat-surrendered",
    type: "Cat",
    imagePath: "mobile-app/assets/animals/cats/animal surrendered cat.jpeg",
  },
];

const dogPhotos = [
  { id: "dog-100", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/100 .jpeg" },
  { id: "dog-102", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/102.jpeg" },
  { id: "dog-103", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/103.jpeg" },
  { id: "dog-104", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/104.jpeg" },
  { id: "dog-105", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/105.jpeg" },
  { id: "dog-106", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/106.jpeg" },
  { id: "dog-108", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/108.jpeg" },
  { id: "dog-109", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/109.jpeg" },
  { id: "dog-11", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/11.jpeg" },
  { id: "dog-110", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/110.jpeg" },
  { id: "dog-111", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/111.jpeg" },
  { id: "dog-112", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/112.jpeg" },
  { id: "dog-113", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/113.jpeg" },
  { id: "dog-114", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/114.jpeg" },
  { id: "dog-115", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/115.jpeg" },
  { id: "dog-116", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/116.jpeg" },
  { id: "dog-117", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/117.jpeg" },
  { id: "dog-119", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/119.jpeg" },
  { id: "dog-125", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/125.jpeg" },
  { id: "dog-126", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/126.jpeg" },
  { id: "dog-127", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/127.jpeg" },
  { id: "dog-128", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/128.jpeg" },
  { id: "dog-13", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/13.jpeg" },
  { id: "dog-130", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/130.jpeg" },
  { id: "dog-131", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/131.jpeg" },
  { id: "dog-132", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/132.jpeg" },
  { id: "dog-133", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/133.jpeg" },
  { id: "dog-134", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/134.jpeg" },
  { id: "dog-135", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/135.jpeg" },
  { id: "dog-136", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/136.jpeg" },
  { id: "dog-137", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/137.jpeg" },
  { id: "dog-138", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/138.jpeg" },
  { id: "dog-139", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/139.jpeg" },
  { id: "dog-14", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/14.jpeg" },
  { id: "dog-140", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/140.jpeg" },
  { id: "dog-141", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/141.jpeg" },
  { id: "dog-142", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/142.jpeg" },
  { id: "dog-145", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/145.jpeg" },
  { id: "dog-146", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/146.jpeg" },
  { id: "dog-148", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/148.jpeg" },
  { id: "dog-149", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/149.jpeg" },
  { id: "dog-15", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/15.jpeg" },
  { id: "dog-152", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/152.jpeg" },
  { id: "dog-154", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/154.jpeg" },
  { id: "dog-155", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/155.jpeg" },
  { id: "dog-159", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/159.jpeg" },
  { id: "dog-16", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/16.jpeg" },
  { id: "dog-161", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/161.jpeg" },
  { id: "dog-162", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/162.jpeg" },
  { id: "dog-163", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/163.jpeg" },
  { id: "dog-164", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/164.jpeg" },
  { id: "dog-165", type: "Dog", imagePath: "mobile-app/assets/animals/dogs/165.jpeg" },
];

const catPhotoMerges = [
  { from: "cat-115", to: "cat-123" },
  { from: "cat-122", to: "cat-121" },
  { from: "cat-168", to: "cat-121" },
  { from: "cat-151", to: "cat-140" },
  { from: "cat-156", to: "cat-140" },
  { from: "cat-166", to: "cat-147" },
  { from: "cat-surrendered", to: "cat-147" },
  { from: "cat-141", to: "cat-1" },
  { from: "cat-170", to: "cat-163" },
  { from: "cat-172", to: "cat-162" },
];

const dogPhotoMerges = [
  { from: "dog-13", to: "dog-11" },
  { from: "dog-137", to: "dog-11" },
  { from: "dog-126", to: "dog-114" },
  { from: "dog-131", to: "dog-114" },
  { from: "dog-138", to: "dog-114" },
  { from: "dog-133", to: "dog-130" },
  { from: "dog-135", to: "dog-134" },
  { from: "dog-136", to: "dog-108" },
  { from: "dog-155", to: "dog-108" },
  { from: "dog-140", to: "dog-104" },
  { from: "dog-142", to: "dog-104" },
  { from: "dog-154", to: "dog-109" },
  { from: "dog-145", to: "dog-139" },
  { from: "dog-148", to: "dog-139" },
  { from: "dog-127", to: "dog-125" },
  { from: "dog-162", to: "dog-119" },
];

const animalNames = {
  Cat: [
    "Nala",
    "Oliver",
    "Willow",
    "Leo",
    "Bella",
    "Simba",
    "Cleo",
    "Jasper",
    "Misty",
    "Theo",
    "Pepper",
    "Ruby",
    "Finn",
    "Mochi",
    "Hazel",
    "Oscar",
    "Poppy",
    "Ziggy",
    "Ivy",
    "Archie",
    "Mango",
    "Suki",
    "Felix",
    "Mabel",
    "Tilly",
    "Salem",
    "Olive",
    "Smokey",
    "Maple",
    "Winnie",
    "Domino",
    "Socks",
    "Honey",
    "Blue",
    "Sage",
    "Peanut",
    "Biscuit",
    "Clover",
    "Pixie",
    "Sunny",
    "Ash",
    "Skye",
    "Juniper",
    "Cosmo",
    "Minnie",
    "Shadow",
    "Storm",
    "Marble",
    "Ginger",
    "Pearl",
    "Tofu",
    "Beans",
    "Blossom",
    "Cricket",
    "Dusty",
    "Echo",
    "Fudge",
    "Ghost",
    "Lyra",
    "Pixel",
  ],
  Dog: [
    "Bailey",
    "Rocky",
    "Daisy",
    "Charlie",
    "Sadie",
    "Toby",
    "Molly",
    "Bruno",
    "Rosie",
    "Jack",
    "Ellie",
    "Buster",
    "Kiki",
    "Scout",
    "Ollie",
    "Maya",
    "Rex",
    "Penny",
    "Zoe",
    "Sam",
    "Amber",
    "Rusty",
    "Mia",
    "Chase",
    "Indie",
    "Baxter",
    "Cooper",
    "Diesel",
    "Harper",
    "Juno",
    "Kona",
    "Loki",
    "Marley",
    "Murphy",
    "Piper",
    "Ranger",
    "Riley",
    "River",
    "Stella",
    "Tank",
    "Ace",
    "Alfie",
    "Benji",
    "Cody",
    "Duke",
    "Frankie",
    "Gizmo",
    "Hugo",
    "Jessie",
    "Kai",
    "Layla",
    "Otis",
    "Quinn",
    "Remy",
    "Rocco",
    "Sasha",
    "Thor",
    "Violet",
    "Wally",
    "Yara",
  ],
};

const profileDefaults = {
  Cat: {
    ages: ["6 months", "1 year", "2 years", "3 years", "4 years", "8 months"],
    sexes: ["Female", "Male"],
    breeds: ["Domestic shorthair", "Domestic mediumhair", "Domestic longhair"],
    sizes: ["Small", "Medium"],
    energies: ["Calm", "Playful", "Curious", "Gentle"],
    bestFor: ["Indoor homes", "Quiet spaces", "Patient adopters", "Cozy routines"],
    locations: ["Shelter cattery", "Foster care", "Cat room", "Recovery suite"],
    personalities: [
      ["Gentle", "Curious", "Affectionate"],
      ["Playful", "Social", "Bright"],
      ["Quiet", "Patient", "Sweet"],
      ["Confident", "Calm", "People-friendly"],
    ],
    storyAction: "settle into a warm home with patient people and plenty of cozy corners",
  },
  Dog: {
    ages: ["9 months", "1 year", "2 years", "3 years", "4 years", "5 years"],
    sexes: ["Male", "Female"],
    breeds: ["Mixed breed", "Terrier mix", "Shepherd mix", "Labrador mix"],
    sizes: ["Small", "Medium", "Large"],
    energies: ["Steady", "Active", "Playful", "Low-key"],
    bestFor: ["Family rhythm", "Training homes", "Active people", "Gentle routines"],
    locations: ["Kennel block A", "Kennel block B", "Shelter yard", "Foster care"],
    personalities: [
      ["Friendly", "Trainable", "Social"],
      ["Loyal", "Curious", "Bright"],
      ["Happy", "People-loving", "Brave"],
      ["Gentle", "Patient", "Sweet"],
    ],
    storyAction: "find a steady routine, kind guidance, and a person who enjoys daily companionship",
  },
};

function pick(items, index) {
  return items[index % items.length];
}

function getAnimalName(type, index) {
  const names = animalNames[type];
  return names[index] ?? `${type} ${index + 1}`;
}

function getPhotoPaths(photo) {
  return photo.imagePaths ?? [photo.imagePath];
}

function mergePhotoGroups(photoGroups, merges) {
  const groupsById = new Map(
    photoGroups.map((photo, index) => [
      photo.id,
      {
        ...photo,
        imagePaths: getPhotoPaths(photo),
        profileIndex: index,
      },
    ])
  );
  const mergedIds = new Set();

  for (const merge of merges) {
    const source = groupsById.get(merge.from);
    const target = groupsById.get(merge.to);

    if (!source || !target || source.id === target.id) {
      continue;
    }

    target.imagePaths.push(...source.imagePaths);
    mergedIds.add(source.id);
  }

  return photoGroups
    .map((photo) => groupsById.get(photo.id))
    .filter((photo) => photo && !mergedIds.has(photo.id));
}

function makeShelterAnimal(photo, index) {
  const defaults = profileDefaults[photo.type];
  const profileIndex = photo.profileIndex ?? index;
  const name = getAnimalName(photo.type, profileIndex);
  const imagePaths = getPhotoPaths(photo);

  return {
    id: photo.id,
    name,
    type: photo.type,
    age: pick(defaults.ages, profileIndex),
    sex: pick(defaults.sexes, profileIndex),
    breed: pick(defaults.breeds, profileIndex),
    size: pick(defaults.sizes, profileIndex),
    energy: pick(defaults.energies, profileIndex),
    bestFor: pick(defaults.bestFor, profileIndex),
    location: pick(defaults.locations, profileIndex),
    vaccinated: true,
    personality: pick(defaults.personalities, profileIndex),
    story: `${name} is ready to ${defaults.storyAction}.`,
    imagePaths,
  };
}

const shelterAnimals = [
  ...featuredShelterAnimals,
  ...mergePhotoGroups(catPhotos, catPhotoMerges).map(makeShelterAnimal),
  ...mergePhotoGroups(dogPhotos, dogPhotoMerges).map(makeShelterAnimal),
];

function seedShelterAnimals() {
  const insertAnimal = db.prepare(`
    INSERT INTO "ShelterAnimal" (
      "id",
      "name",
      "type",
      "age",
      "sex",
      "breed",
      "size",
      "energy",
      "bestFor",
      "location",
      "vaccinated",
      "personalityJson",
      "story",
      "imageDataUri",
      "imageMimeType",
      "status",
      "updatedAt"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', CURRENT_TIMESTAMP)
    ON CONFLICT("id") DO UPDATE SET
      "name" = excluded."name",
      "type" = excluded."type",
      "age" = excluded."age",
      "sex" = excluded."sex",
      "breed" = excluded."breed",
      "size" = excluded."size",
      "energy" = excluded."energy",
      "bestFor" = excluded."bestFor",
      "location" = excluded."location",
      "vaccinated" = excluded."vaccinated",
      "personalityJson" = excluded."personalityJson",
      "story" = excluded."story",
      "imageDataUri" = excluded."imageDataUri",
      "imageMimeType" = excluded."imageMimeType",
      "status" = excluded."status",
      "updatedAt" = CURRENT_TIMESTAMP;
  `);
  const deleteImages = db.prepare('DELETE FROM "ShelterAnimalImage" WHERE "animalId" = ?;');
  const insertImage = db.prepare(`
    INSERT INTO "ShelterAnimalImage" (
      "id",
      "animalId",
      "dataUri",
      "mimeType",
      "fileName",
      "sortOrder"
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT("id") DO UPDATE SET
      "animalId" = excluded."animalId",
      "dataUri" = excluded."dataUri",
      "mimeType" = excluded."mimeType",
      "fileName" = excluded."fileName",
      "sortOrder" = excluded."sortOrder";
  `);

  for (const animal of shelterAnimals) {
    const imagePaths = animal.imagePaths ?? [animal.imagePath];
    const primaryImage = getImageReference(imagePaths[0]);

    insertAnimal.run(
      animal.id,
      animal.name,
      animal.type,
      animal.age,
      animal.sex,
      animal.breed,
      animal.size,
      animal.energy,
      animal.bestFor,
      animal.location,
      animal.vaccinated ? 1 : 0,
      JSON.stringify(animal.personality),
      animal.story,
      primaryImage.dataUri,
      primaryImage.mimeType
    );

    deleteImages.run(animal.id);

    imagePaths.forEach((imagePath, index) => {
      const image = getImageReference(imagePath);

      insertImage.run(
        `${animal.id}-image-${index + 1}`,
        animal.id,
        image.dataUri,
        image.mimeType,
        path.basename(imagePath),
        index
      );
    });
  }

  mergeSplitAnimalProfiles();
}

function mergeSplitAnimalProfiles() {
  const profileMerges = [
    ["cat-110-picture2", "cat-110"],
    ["cat-110-picture3", "cat-110"],
    ["cat-128-pic2", "cat-128"],
    ...catPhotoMerges.map((merge) => [merge.from, merge.to]),
    ...dogPhotoMerges.map((merge) => [merge.from, merge.to]),
  ];
  const updateApplications = db.prepare(
    'UPDATE "AdoptionApplication" SET "animalId" = ? WHERE "animalId" = ?;'
  );
  const deleteAnimal = db.prepare('DELETE FROM "ShelterAnimal" WHERE "id" = ?;');

  for (const [fromId, toId] of profileMerges) {
    updateApplications.run(toId, fromId);
    deleteAnimal.run(fromId);
  }
}

reportColumns = db.prepare('PRAGMA table_info("StrayAnimalReport")').all();

if (!reportColumns.some((column) => column.name === "latitude")) {
  db.exec('ALTER TABLE "StrayAnimalReport" ADD COLUMN "latitude" REAL;');
}

if (!reportColumns.some((column) => column.name === "longitude")) {
  db.exec('ALTER TABLE "StrayAnimalReport" ADD COLUMN "longitude" REAL;');
}

const surrenderColumns = db.prepare('PRAGMA table_info("AnimalSurrenderRequest")').all();

if (surrenderColumns.some((column) => column.name === "canKeepUntil")) {
  db.exec('ALTER TABLE "AnimalSurrenderRequest" DROP COLUMN "canKeepUntil";');
}

for (const column of [
  { name: "isAnonymous", sql: 'ALTER TABLE "AnimalSurrenderRequest" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;' },
  { name: "scheduledIntakeAt", sql: 'ALTER TABLE "AnimalSurrenderRequest" ADD COLUMN "scheduledIntakeAt" DATETIME;' },
  { name: "scheduledIntakeNote", sql: 'ALTER TABLE "AnimalSurrenderRequest" ADD COLUMN "scheduledIntakeNote" TEXT;' },
  { name: "completedAt", sql: 'ALTER TABLE "AnimalSurrenderRequest" ADD COLUMN "completedAt" DATETIME;' },
  { name: "shelterAnimalId", sql: 'ALTER TABLE "AnimalSurrenderRequest" ADD COLUMN "shelterAnimalId" TEXT;' },
]) {
  if (!surrenderColumns.some((existingColumn) => existingColumn.name === column.name)) {
    db.exec(column.sql);
  }
}

const adoptionColumns = db.prepare('PRAGMA table_info("AdoptionApplication")').all();
for (const column of [
  { name: "assignedAgentId", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "assignedAgentId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;' },
  { name: "inspectionAssignedAt", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionAssignedAt" DATETIME;' },
  { name: "inspectionCompletedAt", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionCompletedAt" DATETIME;' },
  { name: "inspectionRecommendation", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionRecommendation" TEXT;' },
  { name: "inspectionPropertySafe", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionPropertySafe" BOOLEAN;' },
  { name: "inspectionSecureYard", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionSecureYard" BOOLEAN;' },
  { name: "inspectionPetsCompatible", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionPetsCompatible" BOOLEAN;' },
  { name: "inspectionNotes", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "inspectionNotes" TEXT;' },
  { name: "pickupScheduledAt", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "pickupScheduledAt" DATETIME;' },
  { name: "pickupNote", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "pickupNote" TEXT;' },
  { name: "adoptedAt", sql: 'ALTER TABLE "AdoptionApplication" ADD COLUMN "adoptedAt" DATETIME;' },
]) {
  if (!adoptionColumns.some((existingColumn) => existingColumn.name === column.name)) {
    db.exec(column.sql);
  }
}

db.exec(`
  CREATE INDEX IF NOT EXISTS "StrayAnimalReport_reporterId_idx" ON "StrayAnimalReport"("reporterId");
  CREATE INDEX IF NOT EXISTS "StrayAnimalReport_status_idx" ON "StrayAnimalReport"("status");
  CREATE INDEX IF NOT EXISTS "StrayAnimalReportImage_reportId_idx" ON "StrayAnimalReportImage"("reportId");
  CREATE INDEX IF NOT EXISTS "ShelterAnimal_status_idx" ON "ShelterAnimal"("status");
  CREATE INDEX IF NOT EXISTS "ShelterAnimal_type_idx" ON "ShelterAnimal"("type");
  CREATE INDEX IF NOT EXISTS "ShelterAnimalImage_animalId_idx" ON "ShelterAnimalImage"("animalId");
  CREATE INDEX IF NOT EXISTS "AdoptionApplication_animalId_idx" ON "AdoptionApplication"("animalId");
  CREATE INDEX IF NOT EXISTS "AdoptionApplication_applicantId_idx" ON "AdoptionApplication"("applicantId");
  CREATE INDEX IF NOT EXISTS "AdoptionApplication_status_idx" ON "AdoptionApplication"("status");
  CREATE INDEX IF NOT EXISTS "AdoptionApplication_assignedAgentId_idx" ON "AdoptionApplication"("assignedAgentId");
  CREATE UNIQUE INDEX IF NOT EXISTS "AdoptionApplicationDocument_applicationId_documentType_key" ON "AdoptionApplicationDocument"("applicationId", "documentType");
  CREATE INDEX IF NOT EXISTS "AdoptionApplicationDocument_applicationId_idx" ON "AdoptionApplicationDocument"("applicationId");
  CREATE INDEX IF NOT EXISTS "AnimalSurrenderRequest_ownerId_idx" ON "AnimalSurrenderRequest"("ownerId");
  CREATE INDEX IF NOT EXISTS "AnimalSurrenderRequest_status_idx" ON "AnimalSurrenderRequest"("status");
  CREATE INDEX IF NOT EXISTS "AnimalSurrenderRequest_animalType_idx" ON "AnimalSurrenderRequest"("animalType");
  CREATE UNIQUE INDEX IF NOT EXISTS "AnimalSurrenderRequest_shelterAnimalId_key" ON "AnimalSurrenderRequest"("shelterAnimalId");
  CREATE INDEX IF NOT EXISTS "AnimalSurrenderImage_surrenderId_idx" ON "AnimalSurrenderImage"("surrenderId");

  UPDATE "StrayAnimalReport"
  SET "reporterName" = COALESCE(
    (SELECT "fullName" FROM "User" WHERE "User"."id" = "StrayAnimalReport"."reporterId"),
    'Anonymous'
  )
  WHERE "reporterName" IS NULL OR "reporterName" = '' OR "reporterName" = 'Anonymous';

  UPDATE "AnimalSurrenderRequest"
  SET "status" = 'SUBMITTED'
  WHERE "status" = 'DECLINED';
`);

seedShelterAnimals();

db.close();

console.log(`SQLite database initialized at ${databasePath}`);
