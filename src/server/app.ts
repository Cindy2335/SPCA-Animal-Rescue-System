import express from 'express';
import cors from 'cors';
import path from "node:path";
import { adminRouter } from '../routes/admin';
import { adoptionRouter } from '../routes/adoptions';
import { authRouter } from '../routes/auth';
import { animalRouter } from '../routes/animals';
import { healthRouter } from '../routes/health';
import { notificationRouter } from '../routes/notifications';
import { reportRouter } from '../routes/reports';
import { surrenderRouter } from '../routes/surrenders';
import { userRouter } from '../routes/users';
import { errorHandler } from '../middleware/errorHandler';

const PHOTON_API_URL = "https://photon.komoot.io";
const ADDRESS_LOOKUP_TIMEOUT_MS = 8_000;

type PhotonFeature = {
    geometry?: {
        coordinates?: unknown[];
    };
    properties?: {
        city?: string;
        country?: string;
        countrycode?: string;
        county?: string;
        district?: string;
        housenumber?: string;
        locality?: string;
        name?: string;
        osm_id?: number | string;
        osm_type?: string;
        postcode?: string;
        state?: string;
        street?: string;
    };
};

type PhotonFeatureCollection = {
    features?: PhotonFeature[];
};

function uniqueAddressParts(parts: Array<string | undefined>) {
    const seen = new Set<string>();

    return parts.flatMap((part) => {
        const value = part?.trim().replace(/\s+/g, " ");
        const key = value?.toLocaleLowerCase("en-ZA");

        if (!value || !key || seen.has(key)) return [];

        seen.add(key);
        return [value];
    });
}

function photonAddressLabel(feature: PhotonFeature) {
    const properties = feature.properties ?? {};
    const streetAddress = properties.street
        ? [properties.housenumber, properties.street].filter(Boolean).join(" ")
        : properties.housenumber;
    const locality = properties.locality ?? properties.district;
    const district = properties.locality ? properties.district : undefined;
    const county = properties.city || properties.district ? undefined : properties.county;

    return uniqueAddressParts([
        properties.name,
        streetAddress,
        locality,
        district,
        properties.city,
        county,
        properties.state,
        properties.postcode,
        properties.country,
    ]).join(", ");
}

function photonAddressSuggestion(feature: PhotonFeature) {
    const coordinates = feature.geometry?.coordinates;
    const longitude = Number(coordinates?.[0]);
    const latitude = Number(coordinates?.[1]);
    const label = photonAddressLabel(feature);

    if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const properties = feature.properties ?? {};
    const sourceId = properties.osm_id;

    return {
        id: sourceId === undefined
            ? `${latitude}:${longitude}`
            : `${properties.osm_type ?? "osm"}:${sourceId}`,
        label,
        latitude,
        longitude,
    };
}

function createApp() {
    const app = express();

    app.set("trust proxy", 1);

    app.use(
        cors({
            origin: true,
            credentials: true,
        })
    );
    app.use(express.json({ limit: "60mb" }));
    app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));

    app.get("/", (req, res) => {
        res.json({
            name: "mobile-app-api",
            endpoints: {
                health: "GET /health",
                register: "POST /api/auth/register",
                login: "POST /api/auth/login",
                registerUser: "POST /api/users",
                userById: "GET /api/users/:id",
                shelterAnimals: "GET /api/animals/shelter",
                createAdoptionApplication: "POST /api/adoptions/applications",
                adoptionApplications: "GET /api/adoptions/applications",
                adoptionApplicationDocument: "GET /api/adoptions/applications/:id/documents/:documentType",
                updateAdoptionApplicationStatus: "PATCH /api/adoptions/applications/:id/status",
                createStrayReport: "POST /api/reports/stray",
                strayReports: "GET /api/reports/stray",
                updateStrayReportStatus: "PATCH /api/reports/stray/:id/status",
                assignStrayReport: "PATCH /api/reports/stray/:id/assignment",
                updateFieldReport: "PATCH /api/reports/stray/:id/field-update",
                notifications: "GET /api/notifications",
                markNotificationRead: "PATCH /api/notifications/:id/read",
                markAllNotificationsRead: "PATCH /api/notifications/read-all",
                createSurrenderRequest: "POST /api/surrenders",
                surrenderRequests: "GET /api/surrenders",
                updateSurrenderStatus: "PATCH /api/surrenders/:id/status",
                scheduleSurrenderIntake: "PATCH /api/surrenders/:id/intake-schedule",
                adminDashboard: "GET /api/admin/dashboard",
                adminAnalytics: "GET /api/admin/analytics?days=7|30|90|all",
                adminTrafficAnalytics: "GET /api/admin/analytics/traffic?days=7|30|90|all",
                adminRealtimeTrafficAnalytics: "GET /api/admin/analytics/traffic/realtime",
                adminWorkers: "GET /api/admin/workers",
                createAdminWorker: "POST /api/admin/workers",
                adminAnimals: "GET /api/admin/animals",
                createAdminAnimal: "POST /api/admin/animals",
                updateAdminAnimal: "PATCH /api/admin/animals/:id",
                addAdminAnimalImage: "POST /api/admin/animals/:id/images",
                reorderAdminAnimalImages: "PATCH /api/admin/animals/:id/images/reorder",
                deleteAdminAnimalImage: "DELETE /api/admin/animals/:id/images/:imageId",
            },
        });
    });

    app.get("/api/addresses/search", async (req, res) => {
        try {
            const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

            if (!query) {
                res.json({ suggestions: [] });
                return;
            }

            const params = new URLSearchParams({
                countrycode: "ZA",
                lang: "en",
                limit: "10",
                q: query,
            });
            const response = await fetch(`${PHOTON_API_URL}/api/?${params.toString()}`, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "team08-spca-address-search/1.0",
                },
                signal: AbortSignal.timeout(ADDRESS_LOOKUP_TIMEOUT_MS),
            });

            if (!response.ok) {
                console.error(`Photon address search failed with status ${response.status}`);
                res.status(502).json({
                    error: "Address search is temporarily unavailable",
                    suggestions: [],
                });
                return;
            }

            const results = (await response.json()) as PhotonFeatureCollection;
            const seenLabels = new Set<string>();
            const suggestions = (results.features ?? [])
                .filter((feature) => feature.properties?.countrycode?.toUpperCase() === "ZA")
                .flatMap((feature) => {
                    const suggestion = photonAddressSuggestion(feature);
                    if (!suggestion) return [];

                    const labelKey = suggestion.label.toLocaleLowerCase("en-ZA");
                    if (seenLabels.has(labelKey)) return [];

                    seenLabels.add(labelKey);
                    return [suggestion];
                })
                .slice(0, 5);

            res.json({ suggestions });
        } catch (error) {
            console.error("Photon address search failed", error);
            res.status(503).json({
                error: "Address search is temporarily unavailable",
                suggestions: [],
            });
        }
    });

    app.get("/api/addresses/reverse", async (req, res) => {
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            res.status(400).json({ error: "Valid latitude and longitude are required" });
            return;
        }

        const coordinateFallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

        try {
            const params = new URLSearchParams({
                lang: "en",
                lat: String(latitude),
                lon: String(longitude),
            });
            const response = await fetch(`${PHOTON_API_URL}/reverse?${params.toString()}`, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "team08-spca-address-search/1.0",
                },
                signal: AbortSignal.timeout(ADDRESS_LOOKUP_TIMEOUT_MS),
            });

            if (!response.ok) {
                console.error(`Photon reverse lookup failed with status ${response.status}`);
                res.json({ address: coordinateFallback });
                return;
            }

            const result = (await response.json()) as PhotonFeatureCollection;
            const address = (result.features ?? [])
                .map(photonAddressLabel)
                .find(Boolean);

            res.json({ address: address || coordinateFallback });
        } catch (error) {
            console.error("Photon reverse lookup failed", error);
            res.json({ address: coordinateFallback });
        }
    });

    app.use("/health", healthRouter);
    app.use("/api/admin", adminRouter);
    app.use("/api/adoptions", adoptionRouter);
    app.use("/api/auth", authRouter);
    app.use("/api/animals", animalRouter);
    app.use("/api/notifications", notificationRouter);
    app.use("/api/users", userRouter);
    app.use("/api/reports", reportRouter);
    app.use("/api/surrenders", surrenderRouter);
    app.use(errorHandler);

    return app;
}

export default createApp;
