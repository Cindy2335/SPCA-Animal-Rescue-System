import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { protos } from "@google-analytics/data";
import { accessSync, constants as fsConstants } from "node:fs";

export type Ga4AnalyticsDays = 7 | 30 | 90;
export type Ga4AnalyticsRange = Ga4AnalyticsDays | "all";

export type Ga4TrafficAnalytics = {
  source: "ga4" | "demo";
  generatedAt: string;
  isDemo: boolean;
  isStale: boolean;
  period: {
    days: Ga4AnalyticsRange;
    from: string;
    granularity: "day" | "month";
    to: string;
    label: string;
    summaryScope: "lifetime" | "selected-period";
    trendFrom: string;
    trendLimited: boolean;
  };
  summary: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    views: number;
    engagementRate: number;
    keyEvents: number;
  };
  trend: Array<{
    date: string;
    activeUsers: number;
    sessions: number;
    views: number;
  }>;
  topScreens: Array<{ label: string; value: number }>;
  channels: Array<{ label: string; value: number; users: number }>;
  keyEventBreakdown: Array<{ label: string; value: number }>;
};

export type Ga4RealtimeAnalytics = {
  source: "ga4";
  reportingMode: "realtime";
  generatedAt: string;
  isStale: boolean;
  period: {
    minutes: 30;
    label: "Last 30 minutes";
    summaryScope: "realtime";
  };
  summary: {
    activeUsers: number;
    eventCount: number;
    views: number;
    keyEvents: number;
  };
  eventBreakdown: Array<{
    label: string;
    eventCount: number;
    keyEvents: number;
  }>;
  screenBreakdown: Array<{
    label: string;
    views: number;
    activeUsers: number;
  }>;
};

type RunReportResponse = protos.google.analytics.data.v1beta.IRunReportResponse;
type RunRealtimeReportResponse =
  protos.google.analytics.data.v1beta.IRunRealtimeReportResponse;
type ReportRow = protos.google.analytics.data.v1beta.IRow;
type AnalyticsReportResponse = RunReportResponse | RunRealtimeReportResponse;

type CacheEntry = {
  expiresAt: number;
  retryAfter: number;
  staleUntil: number;
  value: Ga4TrafficAnalytics;
};

type RealtimeCacheEntry = {
  expiresAt: number;
  retryAfter: number;
  staleUntil: number;
  value: Ga4RealtimeAnalytics;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_RETRY_TTL_MS = 60 * 1000;
const REALTIME_CACHE_TTL_MS = 45 * 1000;
const REALTIME_STALE_TTL_MS = 5 * 60 * 1000;
const REALTIME_STALE_RETRY_TTL_MS = 30 * 1000;
// TYP began collecting GA4 data in 2026, so no earlier reporting period exists.
const GA4_HISTORY_START = "2026-01-01";
const DEMO_HISTORY_START_MONTH = 3;
const trafficCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<Ga4TrafficAnalytics>>();
const realtimeCache = new Map<string, RealtimeCacheEntry>();
const realtimeInFlightRequests = new Map<string, Promise<Ga4RealtimeAnalytics>>();

let analyticsClient: BetaAnalyticsDataClient | null = null;

export class Ga4AnalyticsError extends Error {
  readonly statusCode: number;

  constructor(
    readonly kind: "not-configured" | "unavailable",
    message: string,
    statusCode: number
  ) {
    super(message);
    this.name = "Ga4AnalyticsError";
    this.statusCode = statusCode;
  }
}

function getPropertyId() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();

  if (!propertyId || !/^\d+$/.test(propertyId)) {
    throw new Ga4AnalyticsError(
      "not-configured",
      "Google Analytics reporting is not configured",
      503
    );
  }

  return propertyId;
}

function getAnalyticsClient() {
  if (!analyticsClient) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    if (credentialsPath) {
      try {
        accessSync(credentialsPath, fsConstants.R_OK);
      } catch {
        throw new Ga4AnalyticsError(
          "not-configured",
          "Google Analytics reporting credentials are not configured",
          503
        );
      }
    }

    // With no explicit credentials, google-auth-library uses Application Default
    // Credentials and automatically honors GOOGLE_APPLICATION_CREDENTIALS.
    analyticsClient = new BetaAnalyticsDataClient();
  }

  return analyticsClient;
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");

    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // GA supplies an IANA time zone. UTC is a safe fallback if it is absent or invalid.
  }

  return formatUtcDate(date);
}

function getCurrentYearStart(to: string) {
  return `${to.slice(0, 4)}-01-01`;
}

function getPeriod(range: Ga4AnalyticsRange, timeZone = "UTC") {
  const to = formatDateInTimeZone(new Date(), timeZone);

  if (range === "all") {
    const trendFrom = getCurrentYearStart(to);

    return {
      days: range,
      from: GA4_HISTORY_START,
      granularity: "month" as const,
      to,
      label: "All time",
      summaryScope: "lifetime" as const,
      trendFrom,
      trendLimited: GA4_HISTORY_START < trendFrom,
    };
  }

  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (range - 1));
  const from = formatUtcDate(fromDate);

  return {
    days: range,
    from,
    granularity: "day" as const,
    to,
    label: `Last ${range} days`,
    summaryScope: "selected-period" as const,
    trendFrom: from,
    trendLimited: false,
  };
}

function parseNumber(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricValue(
  report: AnalyticsReportResponse,
  row: ReportRow | null | undefined,
  name: string
) {
  const metricIndex = (report.metricHeaders ?? []).findIndex((header) => header.name === name);

  if (metricIndex < 0) return 0;
  return parseNumber(row?.metricValues?.[metricIndex]?.value);
}

function dimensionValue(report: AnalyticsReportResponse, row: ReportRow, name: string) {
  const dimensionIndex = (report.dimensionHeaders ?? []).findIndex((header) => header.name === name);

  if (dimensionIndex < 0) return "";
  return row.dimensionValues?.[dimensionIndex]?.value?.trim() ?? "";
}

function displayLabel(value: string) {
  return value && value !== "(not set)" ? value : "Unknown";
}

function parseGa4Date(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
}

function parseGa4Month(value: string) {
  const match = /^(\d{4})(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}-01` : value;
}

function createEmptyDailyTrend(from: string, days: Ga4AnalyticsDays) {
  const firstDate = new Date(`${from}T00:00:00.000Z`);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(firstDate);
    date.setUTCDate(date.getUTCDate() + index);

    return {
      date: formatUtcDate(date),
      activeUsers: 0,
      sessions: 0,
      views: 0,
    };
  });
}

function createEmptyMonthlyTrend(from: string, to: string) {
  const firstMonth = new Date(`${from}T00:00:00.000Z`);
  const lastMonth = new Date(`${to}T00:00:00.000Z`);
  firstMonth.setUTCDate(1);
  lastMonth.setUTCDate(1);
  const trend: Ga4TrafficAnalytics["trend"] = [];

  for (let date = firstMonth; date <= lastMonth; ) {
    trend.push({
      date: formatUtcDate(date),
      activeUsers: 0,
      sessions: 0,
      views: 0,
    });

    const nextMonth = new Date(date);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    date = nextMonth;
  }

  return trend;
}

type DemoEngagementSession = {
  channel: string;
  date: string;
  engaged: boolean;
  keyEvent: string | null;
  screens: string[];
  userId: string;
};

function createDemoEngagementSessions(to: string) {
  const year = Number(to.slice(0, 4));
  const finalMonthIndex = Number(to.slice(5, 7)) - 1;
  const finalDay = Number(to.slice(8, 10));
  const monthlySessionTargets = [7, 10, 8, 12, 11];
  const screenNames = [
    "Home",
    "Adoptions",
    "Animal details",
    "Report stray",
    "Surrender",
    "Donations",
    "Profile",
  ];
  const channels = ["Direct", "Organic Search", "Referral", "Organic Social"];
  const keyEvents = [
    "adoption_application_submitted",
    "stray_report_submitted",
    "surrender_request_submitted",
    "donation_completed",
  ];
  const sessions: DemoEngagementSession[] = [];
  let globalIndex = 0;

  for (let monthIndex = DEMO_HISTORY_START_MONTH; monthIndex <= finalMonthIndex; monthIndex += 1) {
    const monthOffset = monthIndex - DEMO_HISTORY_START_MONTH;
    const sessionCount = monthlySessionTargets[monthOffset] ?? 9 + (monthOffset % 3);
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const maximumDay = monthIndex === finalMonthIndex ? finalDay : daysInMonth;
    const userPoolSize = Math.min(24, 7 + monthOffset * 4);

    for (let index = 0; index < sessionCount; index += 1) {
      const day = monthIndex === finalMonthIndex
        ? Math.max(1, maximumDay - (sessionCount - index - 1) * 2)
        : 2 + ((index * 3 + monthOffset * 2) % Math.max(2, maximumDay - 3));
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const views = globalIndex % 4 === 0 ? 2 : 1;
      const firstScreenIndex = (globalIndex * 2 + monthOffset) % screenNames.length;

      sessions.push({
        channel: channels[(globalIndex + monthOffset) % channels.length],
        date,
        engaged: globalIndex % 3 !== 0,
        keyEvent: globalIndex % 4 === 0 ? keyEvents[(globalIndex / 4) % keyEvents.length] : null,
        screens: Array.from(
          { length: views },
          (_, viewIndex) => screenNames[(firstScreenIndex + viewIndex * 3) % screenNames.length]
        ),
        userId: `demo-user-${1 + ((index * 5 + monthOffset * 7) % userPoolSize)}`,
      });
      globalIndex += 1;
    }
  }

  return sessions.sort((first, second) => first.date.localeCompare(second.date));
}

function buildDemoTrafficAnalytics(range: Ga4AnalyticsRange): Ga4TrafficAnalytics {
  const basePeriod = getPeriod(range, "Africa/Johannesburg");
  const year = basePeriod.to.slice(0, 4);
  const demoStart = `${year}-04-01`;
  const period = range === "all"
    ? {
        ...basePeriod,
        from: demoStart,
        trendFrom: demoStart,
        trendLimited: false,
      }
    : basePeriod;
  const allSessions = createDemoEngagementSessions(period.to);
  const sessions = allSessions.filter((session) => session.date >= period.from && session.date <= period.to);
  const firstSessionByUser = new Map<string, string>();

  for (const session of allSessions) {
    if (!firstSessionByUser.has(session.userId)) firstSessionByUser.set(session.userId, session.date);
  }

  const trend = range === "all"
    ? createEmptyMonthlyTrend(period.trendFrom, period.to)
    : createEmptyDailyTrend(period.from, range);
  const trendByDate = new Map(trend.map((item) => [item.date, item]));
  const usersByTrendDate = new Map<string, Set<string>>();
  const screenCounts = new Map<string, number>();
  const keyEventCounts = new Map<string, number>();
  const channelCounts = new Map<string, { sessions: number; users: Set<string> }>();

  for (const session of sessions) {
    const trendDate = range === "all" ? `${session.date.slice(0, 7)}-01` : session.date;
    const trendItem = trendByDate.get(trendDate);
    if (trendItem) {
      trendItem.sessions += 1;
      trendItem.views += session.screens.length;
      const bucketUsers = usersByTrendDate.get(trendDate) ?? new Set<string>();
      bucketUsers.add(session.userId);
      usersByTrendDate.set(trendDate, bucketUsers);
    }

    for (const screen of session.screens) {
      screenCounts.set(screen, (screenCounts.get(screen) ?? 0) + 1);
    }
    if (session.keyEvent) {
      keyEventCounts.set(session.keyEvent, (keyEventCounts.get(session.keyEvent) ?? 0) + 1);
    }
    const channel = channelCounts.get(session.channel) ?? { sessions: 0, users: new Set<string>() };
    channel.sessions += 1;
    channel.users.add(session.userId);
    channelCounts.set(session.channel, channel);
  }

  for (const [date, users] of usersByTrendDate) {
    const trendItem = trendByDate.get(date);
    if (trendItem) trendItem.activeUsers = users.size;
  }

  const activeUsers = new Set(sessions.map((session) => session.userId));
  const newUsers = new Set(
    sessions
      .filter((session) => firstSessionByUser.get(session.userId) === session.date)
      .map((session) => session.userId)
  );
  const engagedSessions = sessions.filter((session) => session.engaged).length;
  const views = sessions.reduce((sum, session) => sum + session.screens.length, 0);
  const keyEventCount = sessions.filter((session) => session.keyEvent).length;

  return {
    source: "demo",
    generatedAt: new Date().toISOString(),
    isDemo: true,
    isStale: false,
    period,
    summary: {
      activeUsers: activeUsers.size,
      newUsers: newUsers.size,
      sessions: sessions.length,
      views,
      engagementRate: sessions.length ? Math.round((engagedSessions / sessions.length) * 1000) / 10 : 0,
      keyEvents: keyEventCount,
    },
    trend,
    topScreens: Array.from(screenCounts, ([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value),
    channels: Array.from(channelCounts, ([label, value]) => ({
      label,
      value: value.sessions,
      users: value.users.size,
    })).sort((first, second) => second.value - first.value),
    keyEventBreakdown: Array.from(keyEventCounts, ([label, value]) => ({ label, value }))
      .sort((first, second) => second.value - first.value),
  };
}

function buildTrafficAnalytics(
  range: Ga4AnalyticsRange,
  reports: RunReportResponse[]
): Ga4TrafficAnalytics {
  const [summaryReport, trendReport, screensReport, channelsReport, keyEventsReport] = reports;

  if (!summaryReport || !trendReport || !screensReport || !channelsReport || !keyEventsReport) {
    throw new Error("Google Analytics returned an incomplete report batch");
  }

  const reportingTimeZone = summaryReport.metadata?.timeZone?.trim() || "UTC";
  const period = getPeriod(range, reportingTimeZone);

  const summaryRow = summaryReport.rows?.[0];
  const trend =
    range === "all"
      ? createEmptyMonthlyTrend(period.trendFrom, period.to)
      : createEmptyDailyTrend(period.from, range);
  const trendByDate = new Map(trend.map((item) => [item.date, item]));

  for (const row of trendReport.rows ?? []) {
    const date =
      range === "all"
        ? parseGa4Month(dimensionValue(trendReport, row, "yearMonth"))
        : parseGa4Date(dimensionValue(trendReport, row, "date"));
    const item = trendByDate.get(date);

    if (item) {
      item.activeUsers = metricValue(trendReport, row, "activeUsers");
      item.sessions = metricValue(trendReport, row, "sessions");
      item.views = metricValue(trendReport, row, "screenPageViews");
    }
  }

  return {
    source: "ga4",
    generatedAt: new Date().toISOString(),
    isDemo: false,
    isStale: false,
    period,
    summary: {
      activeUsers: metricValue(summaryReport, summaryRow, "activeUsers"),
      newUsers: metricValue(summaryReport, summaryRow, "newUsers"),
      sessions: metricValue(summaryReport, summaryRow, "sessions"),
      views: metricValue(summaryReport, summaryRow, "screenPageViews"),
      engagementRate:
        Math.round(metricValue(summaryReport, summaryRow, "engagementRate") * 1000) / 10,
      keyEvents: metricValue(summaryReport, summaryRow, "keyEvents"),
    },
    trend,
    topScreens: (screensReport.rows ?? []).map((row) => ({
      label: displayLabel(dimensionValue(screensReport, row, "unifiedScreenName")),
      value: metricValue(screensReport, row, "screenPageViews"),
    })),
    channels: (channelsReport.rows ?? []).map((row) => ({
      label: displayLabel(dimensionValue(channelsReport, row, "sessionDefaultChannelGroup")),
      value: metricValue(channelsReport, row, "sessions"),
      users: metricValue(channelsReport, row, "activeUsers"),
    })),
    keyEventBreakdown: (keyEventsReport.rows ?? [])
      .map((row) => ({
        label: displayLabel(dimensionValue(keyEventsReport, row, "eventName")),
        value: metricValue(keyEventsReport, row, "keyEvents"),
      }))
      .filter((item) => item.value > 0),
  };
}

function buildRealtimeAnalytics(
  reports: RunRealtimeReportResponse[]
): Ga4RealtimeAnalytics {
  const [summaryReport, eventsReport, screensReport] = reports;

  if (!summaryReport || !eventsReport || !screensReport) {
    throw new Error("Google Analytics returned an incomplete realtime report set");
  }

  const summaryRow = summaryReport.rows?.[0];

  return {
    source: "ga4",
    reportingMode: "realtime",
    generatedAt: new Date().toISOString(),
    isStale: false,
    period: {
      minutes: 30,
      label: "Last 30 minutes",
      summaryScope: "realtime",
    },
    summary: {
      activeUsers: metricValue(summaryReport, summaryRow, "activeUsers"),
      eventCount: metricValue(summaryReport, summaryRow, "eventCount"),
      views: metricValue(summaryReport, summaryRow, "screenPageViews"),
      keyEvents: metricValue(summaryReport, summaryRow, "keyEvents"),
    },
    eventBreakdown: (eventsReport.rows ?? [])
      .map((row) => ({
        label: displayLabel(dimensionValue(eventsReport, row, "eventName")),
        eventCount: metricValue(eventsReport, row, "eventCount"),
        keyEvents: metricValue(eventsReport, row, "keyEvents"),
      }))
      .filter((item) => item.eventCount > 0 || item.keyEvents > 0),
    screenBreakdown: (screensReport.rows ?? [])
      .map((row) => ({
        label: displayLabel(dimensionValue(screensReport, row, "unifiedScreenName")),
        views: metricValue(screensReport, row, "screenPageViews"),
        activeUsers: metricValue(screensReport, row, "activeUsers"),
      }))
      .filter((item) => item.views > 0 || item.activeUsers > 0),
  };
}

function providerErrorValues(error: unknown) {
  if (typeof error !== "object" || error === null) return [];

  const values: unknown[] = [];
  if ("code" in error) values.push(error.code);
  if ("status" in error) values.push(error.status);

  if ("response" in error && typeof error.response === "object" && error.response !== null) {
    if ("status" in error.response) values.push(error.response.status);
  }

  return values;
}

function isTransientProviderError(error: unknown) {
  const transientNumbers = new Set([4, 8, 10, 13, 14, 408, 429, 500, 502, 503, 504]);
  const transientCodes = new Set([
    "ABORTED",
    "DEADLINE_EXCEEDED",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "INTERNAL",
    "RESOURCE_EXHAUSTED",
    "UNAVAILABLE",
  ]);

  return providerErrorValues(error).some((value) => {
    if (typeof value === "number") return transientNumbers.has(value);
    if (typeof value === "string") {
      const numericValue = Number(value);
      return (
        (Number.isFinite(numericValue) && transientNumbers.has(numericValue)) ||
        transientCodes.has(value.toUpperCase())
      );
    }
    return false;
  });
}

function isConfigurationProviderError(error: unknown) {
  const configurationNumbers = new Set([5, 7, 16, 401, 403, 404]);
  const configurationCodes = new Set([
    "EACCES",
    "ENOENT",
    "NOT_FOUND",
    "PERMISSION_DENIED",
    "UNAUTHENTICATED",
  ]);

  return providerErrorValues(error).some((value) => {
    if (typeof value === "number") return configurationNumbers.has(value);
    if (typeof value === "string") {
      const numericValue = Number(value);
      return (
        (Number.isFinite(numericValue) && configurationNumbers.has(numericValue)) ||
        configurationCodes.has(value.toUpperCase())
      );
    }
    return false;
  });
}

function safeProviderErrorCode(error: unknown) {
  for (const value of providerErrorValues(error)) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && /^[A-Z0-9_-]{1,40}$/i.test(value)) return value;
  }

  return "unknown";
}

function throwGa4ProviderError(error: unknown): never {
  if (isConfigurationProviderError(error)) {
    console.error(`[ga4] Data API configuration failed (${safeProviderErrorCode(error)})`);
    throw new Ga4AnalyticsError(
      "not-configured",
      "Google Analytics reporting credentials or property access are not configured",
      503
    );
  }

  console.error(`[ga4] Data API request failed (${safeProviderErrorCode(error)})`);
  throw new Ga4AnalyticsError(
    "unavailable",
    "Google Analytics reporting is temporarily unavailable",
    502
  );
}

async function fetchTrafficAnalytics(
  propertyId: string,
  range: Ga4AnalyticsRange
): Promise<Ga4TrafficAnalytics> {
  // Relative dates are evaluated in the GA property's reporting time zone.
  const summaryDateRanges = [
    {
      startDate: range === "all" ? GA4_HISTORY_START : `${range - 1}daysAgo`,
      endDate: "today",
    },
  ];
  const trendDateRanges = range === "all"
    ? [{ startDate: `${new Date().getUTCFullYear()}-01-01`, endDate: "today" }]
    : summaryDateRanges;
  const [batch] = await getAnalyticsClient().batchRunReports({
    property: `properties/${propertyId}`,
    requests: [
      {
        dateRanges: summaryDateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagementRate" },
          { name: "keyEvents" },
        ],
      },
      {
        dateRanges: trendDateRanges,
        dimensions: [{ name: range === "all" ? "yearMonth" : "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        orderBys: [
          { dimension: { dimensionName: range === "all" ? "yearMonth" : "date" } },
        ],
        limit: 1200,
      },
      {
        dateRanges: summaryDateRanges,
        dimensions: [{ name: "unifiedScreenName" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      },
      {
        dateRanges: summaryDateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      },
      {
        dateRanges: summaryDateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "keyEvents" }],
        orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
        limit: 25,
      },
    ],
  });

  return buildTrafficAnalytics(range, batch.reports ?? []);
}

async function fetchRealtimeAnalytics(propertyId: string): Promise<Ga4RealtimeAnalytics> {
  const property = `properties/${propertyId}`;
  const minuteRanges = [{ startMinutesAgo: 29, endMinutesAgo: 0 }];
  const [summaryResult, eventsResult, screensResult] = await Promise.all([
    getAnalyticsClient().runRealtimeReport({
      property,
      minuteRanges,
      metrics: [
        { name: "activeUsers" },
        { name: "eventCount" },
        { name: "screenPageViews" },
        { name: "keyEvents" },
      ],
    }),
    getAnalyticsClient().runRealtimeReport({
      property,
      minuteRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }, { name: "keyEvents" }],
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 15,
    }),
    getAnalyticsClient().runRealtimeReport({
      property,
      minuteRanges,
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
  ]);

  return buildRealtimeAnalytics([
    summaryResult[0],
    eventsResult[0],
    screensResult[0],
  ]);
}

export async function getGa4TrafficAnalytics(range: Ga4AnalyticsRange) {
  if (process.env.GA4_DEMO_DATA?.trim().toLowerCase() === "true") {
    return buildDemoTrafficAnalytics(range);
  }

  const propertyId = getPropertyId();
  const cacheKey = `${propertyId}:${range}`;
  const now = Date.now();
  const cached = trafficCache.get(cacheKey);

  if (cached && cached.expiresAt > now) return cached.value;
  if (cached && cached.retryAfter > now) return { ...cached.value, isStale: true };

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const value = await fetchTrafficAnalytics(propertyId, range);
      const fetchedAt = Date.now();
      trafficCache.set(cacheKey, {
        value,
        expiresAt: fetchedAt + CACHE_TTL_MS,
        retryAfter: 0,
        staleUntil: fetchedAt + STALE_TTL_MS,
      });
      return value;
    } catch (error) {
      if (error instanceof Ga4AnalyticsError) throw error;

      const failedAt = Date.now();
      const canServeStale =
        isTransientProviderError(error) && cached && cached.staleUntil > failedAt;

      if (canServeStale) {
        cached.retryAfter = Math.min(cached.staleUntil, failedAt + STALE_RETRY_TTL_MS);
        console.warn(
          `[ga4] Data API temporarily unavailable (${safeProviderErrorCode(error)}); serving cached analytics`
        );
        return { ...cached.value, isStale: true };
      }

      throwGa4ProviderError(error);
    }
  })();

  inFlightRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

export async function getGa4RealtimeAnalytics(): Promise<Ga4RealtimeAnalytics> {
  const propertyId = getPropertyId();
  const now = Date.now();
  const cached = realtimeCache.get(propertyId);

  if (cached && cached.expiresAt > now) return cached.value;
  if (cached && cached.retryAfter > now) return { ...cached.value, isStale: true };

  const inFlight = realtimeInFlightRequests.get(propertyId);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const value = await fetchRealtimeAnalytics(propertyId);
      const fetchedAt = Date.now();
      realtimeCache.set(propertyId, {
        value,
        expiresAt: fetchedAt + REALTIME_CACHE_TTL_MS,
        retryAfter: 0,
        staleUntil: fetchedAt + REALTIME_STALE_TTL_MS,
      });
      return value;
    } catch (error) {
      if (error instanceof Ga4AnalyticsError) throw error;

      const failedAt = Date.now();
      const canServeStale =
        isTransientProviderError(error) && cached && cached.staleUntil > failedAt;

      if (canServeStale) {
        cached.retryAfter = Math.min(
          cached.staleUntil,
          failedAt + REALTIME_STALE_RETRY_TTL_MS
        );
        console.warn(
          `[ga4] Realtime Data API temporarily unavailable (${safeProviderErrorCode(error)}); serving cached analytics`
        );
        return { ...cached.value, isStale: true };
      }

      throwGa4ProviderError(error);
    }
  })();

  realtimeInFlightRequests.set(propertyId, request);

  try {
    return await request;
  } finally {
    realtimeInFlightRequests.delete(propertyId);
  }
}
