export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: "USER" | "ADMIN" | "FIELD_AGENT" | string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
};

const DEFAULT_API_URL = "https://team08-api.onrender.com";
const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
let authToken: string | null = null;

export type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export function setAuthToken(token: string) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_URL}/api/addresses/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Address search is temporarily unavailable.");
  }

  const results = (await response.json()) as { suggestions?: AddressSuggestion[] };

  return results.suggestions ?? [];
}

export async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<string> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const response = await fetch(`${API_URL}/api/addresses/reverse?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Address lookup is temporarily unavailable.");
  }

  const data = (await response.json()) as { address?: string };
  return data.address ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function request<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (authToken && !skipAuth) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong");
  }

  return data as T;
}

export async function registerUser(input: {
  fullname: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  const data = await request<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data;
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const data = await request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data;
}

export type StrayAnimalReport = {
  id: string;
  animalType: "Dog" | "Cat" | "Other";
  condition: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  imageUrl: string | null;
  images: StrayAnimalReportImage[];
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  fieldStatus: FieldReportStatus;
  fieldNotes: string | null;
  fieldOutcome: string | null;
  reporterName: string;
  reporterId: string | null;
  assignedAgentId: string | null;
  assignedAgent: ReportUser | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  dispatchedAt: string | null;
  onSceneAt: string | null;
  rescueStartedAt: string | null;
  unableToLocateAt: string | null;
  failedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldReportStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "REJECTED"
  | "EN_ROUTE"
  | "ON_SCENE"
  | "RESCUE_IN_PROGRESS"
  | "HELPED"
  | "UNABLE_TO_LOCATE"
  | "FAILED";

export type ReportUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
};

export type StrayAnimalReportImage = {
  id: string;
  dataUri: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
};

export type ReportImageInput = {
  dataUri: string;
  fileName?: string;
  mimeType?: string;
};

export type ClaimableStrayReport = {
  id: string;
  animalType: "Dog" | "Cat" | "Other";
  condition: string | null;
  area: string;
  breed: string | null;
  color: string | null;
  age: string | null;
  gender: string | null;
  imageUrl: string | null;
  images: StrayAnimalReportImage[];
  createdAt: string;
  claimExpiresAt: string;
  hasSubmittedClaim: boolean;
};

export type StrayOwnershipClaim = {
  id: string;
  reportId: string;
  claimantId: string;
  petName: string | null;
  identifyingFeatures: string;
  proofDetails: string | null;
  contactPhone: string;
  consentConfirmed: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PICKUP_SCHEDULED" | "COLLECTED" | string;
  pickupScheduledAt: string | null;
  pickupNote: string | null;
  createdAt: string;
  updatedAt: string;
  report: {
    id: string;
    animalType: "Dog" | "Cat" | "Other";
    condition: string | null;
    location: string;
    imageUrl: string | null;
    createdAt: string;
    images: StrayAnimalReportImage[];
  };
  claimant: { id: string; fullName: string; email: string };
  proofImages: StrayOwnershipClaimImage[];
};

export type StrayOwnershipClaimImage = {
  id: string;
  dataUri: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
};

export type CreateStrayOwnershipClaimInput = {
  petName?: string;
  identifyingFeatures: string;
  proofDetails?: string;
  contactPhone: string;
  consentConfirmed: true;
  proofPhotos?: ReportImageInput[];
};

export type CreateStrayAnimalReportInput = {
  animalType: "Dog" | "Cat" | "Other";
  condition?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  description: string;
  images?: ReportImageInput[];
};

export async function createStrayAnimalReport(
  input: CreateStrayAnimalReportInput
): Promise<StrayAnimalReport> {
  const data = await request<{ report: StrayAnimalReport }>("/api/reports/stray", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.report;
}

export async function getStrayAnimalReports(input?: {
  reporterId?: string;
}): Promise<StrayAnimalReport[]> {
  const params = new URLSearchParams();

  if (input?.reporterId) {
    params.set("reporterId", input.reporterId);
  }

  const query = params.toString();
  const data = await request<{ reports: StrayAnimalReport[] }>(`/api/reports/stray${query ? `?${query}` : ""}`, {
    method: "GET",
  });

  return data.reports;
}

export async function getClaimableStrayReports(): Promise<ClaimableStrayReport[]> {
  const data = await request<{ reports: ClaimableStrayReport[] }>(
    "/api/reports/stray/claimable",
    {
      method: "GET",
    }
  );

  return data.reports;
}

export async function createStrayOwnershipClaim(
  reportId: string,
  input: CreateStrayOwnershipClaimInput
): Promise<StrayOwnershipClaim> {
  const data = await request<{ claim: StrayOwnershipClaim }>(
    `/api/reports/stray/${encodeURIComponent(reportId)}/claims`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  return data.claim;
}

export async function getStrayOwnershipClaims(): Promise<StrayOwnershipClaim[]> {
  const data = await request<{ claims: StrayOwnershipClaim[] }>("/api/reports/stray/claims", {
    method: "GET",
  });
  return data.claims;
}

export async function scheduleStrayOwnershipPickup(
  id: string,
  input: { pickupScheduledAt: string; pickupNote?: string }
): Promise<StrayOwnershipClaim> {
  const data = await request<{ claim: StrayOwnershipClaim }>(
    `/api/reports/stray/claims/${encodeURIComponent(id)}/pickup-schedule`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return data.claim;
}

export async function updateFieldReport(
  id: string,
  input: {
    fieldNotes?: string;
    fieldOutcome?: string;
    fieldStatus: FieldReportStatus;
  }
): Promise<StrayAnimalReport> {
  const data = await request<{ report: StrayAnimalReport }>(
    `/api/reports/stray/${encodeURIComponent(id)}/field-update`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );

  return data.report;
}

export type AppNotification = {
  id: string;
  recipientId: string;
  reportId: string | null;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const data = await request<{ notifications: AppNotification[] }>("/api/notifications", {
    method: "GET",
  });

  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const data = await request<{ notification: AppNotification }>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "PATCH",
    }
  );

  return data.notification;
}

export async function markAllNotificationsRead(): Promise<AppNotification[]> {
  const data = await request<{ notifications: AppNotification[] }>("/api/notifications/read-all", {
    method: "PATCH",
  });

  return data.notifications;
}

export type AnimalSurrenderStatus =
  | "SUBMITTED"
  | "CONTACTED"
  | "INTAKE_SCHEDULED"
  | "COMPLETED"
  | "DECLINED";

export type AnimalSurrenderRequest = {
  id: string;
  ownerId: string | null;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  preferredContactMethod: "Phone" | "Email" | "WhatsApp";
  animalName: string | null;
  animalType: "Dog" | "Cat" | "Other";
  breed: string | null;
  age: string | null;
  sex: string | null;
  color: string | null;
  vaccinated: boolean;
  sterilized: boolean;
  microchipped: boolean;
  healthNotes: string | null;
  behaviorNotes: string | null;
  reason: string;
  urgency: "This week" | "Within two weeks" | "This month" | "Flexible";
  canKeepUntil: string | null;
  scheduledIntakeAt: string | null;
  scheduledIntakeNote: string | null;
  completedAt: string | null;
  shelterAnimalId: string | null;
  status: AnimalSurrenderStatus;
  images: AnimalSurrenderImage[];
  createdAt: string;
  updatedAt: string;
};

export type AnimalSurrenderImage = {
  id: string;
  dataUri: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
};

export type CreateAnimalSurrenderInput = {
  anonymous?: boolean;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  preferredContactMethod: "Phone" | "Email" | "WhatsApp";
  animalName?: string;
  animalType: "Dog" | "Cat" | "Other";
  breed?: string;
  age?: string;
  sex?: string;
  color?: string;
  vaccinated: boolean;
  sterilized: boolean;
  microchipped: boolean;
  healthNotes?: string;
  behaviorNotes?: string;
  reason: string;
  urgency: "This week" | "Within two weeks" | "This month" | "Flexible";
  canKeepUntil?: string;
  images?: ReportImageInput[];
};

export async function createAnimalSurrenderRequest(
  input: CreateAnimalSurrenderInput,
  options?: { anonymous?: boolean }
): Promise<AnimalSurrenderRequest> {
  const data = await request<{ surrender: AnimalSurrenderRequest }>("/api/surrenders", {
    method: "POST",
    skipAuth: options?.anonymous,
    body: JSON.stringify(input),
  });

  return data.surrender;
}

export async function getAnimalSurrenderRequests(input?: {
  ownerId?: string;
}): Promise<AnimalSurrenderRequest[]> {
  const params = new URLSearchParams();

  if (input?.ownerId) {
    params.set("ownerId", input.ownerId);
  }

  const query = params.toString();
  const data = await request<{ surrenders: AnimalSurrenderRequest[] }>(
    `/api/surrenders${query ? `?${query}` : ""}`,
    {
      method: "GET",
    }
  );

  return data.surrenders;
}

export async function scheduleAnimalSurrenderIntake(
  id: string,
  input: {
    scheduledIntakeAt: string;
    scheduledIntakeNote?: string;
  }
): Promise<AnimalSurrenderRequest> {
  const data = await request<{ surrender: AnimalSurrenderRequest }>(
    `/api/surrenders/${encodeURIComponent(id)}/intake-schedule`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );

  return data.surrender;
}

export type ShelterAnimal = {
  id: string;
  name: string;
  type: "Dog" | "Cat" | "Other";
  age: string;
  sex: string;
  breed: string;
  size: string;
  energy: string;
  bestFor: string;
  location: string;
  vaccinated: boolean;
  personality: string[];
  story: string;
  imageDataUri: string;
  imageMimeType: string;
  images: ShelterAnimalImage[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ShelterAnimalImage = {
  id: string;
  dataUri: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
};

export async function getShelterAnimals(): Promise<ShelterAnimal[]> {
  const data = await request<{ animals: ShelterAnimal[] }>("/api/animals/shelter", {
    method: "GET",
  });

  return data.animals.filter((animal) => animal.status === "AVAILABLE");
}

export async function getShelterAnimalById(id: string): Promise<ShelterAnimal> {
  const data = await request<{ animal: ShelterAnimal }>(
    `/api/animals/shelter/${encodeURIComponent(id)}`,
    {
      method: "GET",
    }
  );

  return data.animal;
}

export type AdoptionApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INSPECTION_REQUIRED"
  | "INSPECTION_ASSIGNED"
  | "INSPECTION_COMPLETED"
  | "APPROVED"
  | "DECLINED"
  | "PICKUP_SCHEDULED"
  | "ADOPTED";

export type AdoptionDocumentInput = {
  dataUri: string;
  fileName?: string;
  mimeType?: string;
};

export type AdoptionApplication = {
  id: string;
  animalId: string;
  applicantId: string | null;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  housingType: string;
  hasYard: boolean;
  hasOtherPets: boolean;
  otherPetsDetails: string | null;
  experience: string | null;
  reason: string;
  schedule: string | null;
  householdAgreement: boolean;
  status: AdoptionApplicationStatus;
  assignedAgentId: string | null;
  assignedAgent: { id: string; email: string; fullName: string; role: string } | null;
  inspectionAssignedAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionRecommendation: "APPROVE" | "DECLINE" | "FOLLOW_UP" | null;
  inspectionPropertySafe: boolean | null;
  inspectionSecureYard: boolean | null;
  inspectionPetsCompatible: boolean | null;
  inspectionNotes: string | null;
  pickupScheduledAt: string | null;
  pickupNote: string | null;
  adoptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  animal: Pick<
    ShelterAnimal,
    | "id"
    | "name"
    | "type"
    | "age"
    | "sex"
    | "breed"
    | "imageDataUri"
    | "imageMimeType"
    | "images"
    | "status"
  >;
};

export type CreateAdoptionApplicationInput = {
  animalId: string;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  housingType: string;
  hasYard: boolean;
  hasOtherPets: boolean;
  otherPetsDetails?: string;
  experience?: string;
  reason: string;
  schedule?: string;
  householdAgreement: true;
  identityDocument: AdoptionDocumentInput;
  proofOfResidenceDocument: AdoptionDocumentInput;
};

export async function createAdoptionApplication(
  input: CreateAdoptionApplicationInput
): Promise<AdoptionApplication> {
  const data = await request<{ application: AdoptionApplication }>("/api/adoptions/applications", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.application;
}

export async function getAdoptionApplications(
  input?: {
    applicantId?: string;
  }
): Promise<AdoptionApplication[]> {
  const params = new URLSearchParams();

  if (input?.applicantId) {
    params.set("applicantId", input.applicantId);
  }

  const query = params.toString();
  const data = await request<{ applications: AdoptionApplication[] }>(
    `/api/adoptions/applications${query ? `?${query}` : ""}`,
    {
      method: "GET",
    }
  );

  return data.applications;
}

export async function submitAdoptionInspection(
  id: string,
  input: {
    recommendation: "APPROVE" | "DECLINE" | "FOLLOW_UP";
    propertySafe: boolean;
    secureYard: boolean;
    petsCompatible: boolean;
    notes: string;
  }
): Promise<AdoptionApplication> {
  const data = await request<{ application: AdoptionApplication }>(
    `/api/adoptions/applications/${encodeURIComponent(id)}/inspection-report`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return data.application;
}

export async function scheduleAdoptionPickup(
  id: string,
  input: { pickupScheduledAt: string; pickupNote?: string }
): Promise<AdoptionApplication> {
  const data = await request<{ application: AdoptionApplication }>(
    `/api/adoptions/applications/${encodeURIComponent(id)}/pickup-schedule`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return data.application;
}
