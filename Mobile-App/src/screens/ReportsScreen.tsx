import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  getNotifications,
  getStrayAnimalReports,
  updateFieldReport,
  type FieldReportStatus,
  type StrayAnimalReport,
} from "../services/api";
import colors from "../theme/colors";
import {
  clamp,
  CONTENT_MAX_WIDTH,
  ms,
  PAGE_PADDING,
  rs,
  screen,
  TOUCH_TARGET,
  vs,
} from "../theme/responsive";

type ReportFilter = "all" | "active" | "previous";
type ReportGroup = Exclude<ReportFilter, "all">;

type ReportCardModel = {
  id: string;
  animalType: StrayAnimalReport["animalType"];
  assignedAgentName: string | null;
  fieldNotes: string | null;
  fieldOutcome: string | null;
  fieldStatus: FieldReportStatus;
  image: ImageSourcePropType;
  location: string;
  reportedDate: string;
  reportedTime: string;
  status: StrayAnimalReport["status"];
  statusLabel: string;
  ticket: string;
  timeline: CaseTimeline;
  title: string;
  updateDate: string;
  updateMessage: string;
  updateTime: string;
};

type CaseTimeline = {
  summaryBody: string;
  summaryTitle: string;
  steps: CaseTimelineStep[];
  tone: "active" | "alert" | "success";
};

type CaseTimelineStep = {
  body: string;
  label: string;
  state: "done" | "pending";
  time: string;
};

const activeReportImages: ImageSourcePropType[] = [
  require("../../assets/animals/dogs/101.jpeg"),
  require("../../assets/animals/cats/105.jpeg"),
  require("../../assets/animals/dogs/118.jpeg"),
];

const previousReportImages: ImageSourcePropType[] = [
  require("../../assets/animals/dogs/10.jpeg"),
  require("../../assets/animals/cats/100.jpeg"),
  require("../../assets/animals/dogs/107.jpeg"),
];

const reportFilters: { label: string; value: ReportFilter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Previous", value: "previous" },
];

const ACTIVE_IMAGE_WIDTH = clamp(screen.width * 0.15, 68, 100);
const ACTIVE_IMAGE_HEIGHT = clamp(screen.width * 0.10, 50, 70);
const PREVIOUS_IMAGE_WIDTH = clamp(screen.width * 0.25, 86, 122);
const PREVIOUS_IMAGE_HEIGHT = clamp(screen.width * 0.19, 66, 92);
const PRIMARY = colors.primary;
const PRIMARY_DARK = colors.primaryDark;
const SOFT_BLUE = colors.primarySoft;
const BORDER_BLUE = "#D6EAF6";
const SUPPORT_GREEN = colors.accent;
const SUPPORT_GREEN_SOFT = colors.accentSoft;

function formatStatus(status: StrayAnimalReport["status"]) {
  if (status === "IN_PROGRESS") {
    return "In Progress";
  }

  if (status === "RESOLVED") {
    return "Resolved";
  }

  return "Reported";
}

function formatFieldStatus(status: FieldReportStatus) {
  if (!status || status === "UNASSIGNED") {
    return "Not assigned";
  }

  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "Unknown date",
      time: "--",
    };
  }

  return {
    date: date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function getTicketNumber(report: StrayAnimalReport, index: number) {
  const createdAt = new Date(report.createdAt);
  const year = Number.isNaN(createdAt.getTime()) ? new Date().getFullYear() : createdAt.getFullYear();
  const hash = report.id
    .split("")
    .reduce((total, character) => (total + character.charCodeAt(0)) % 1000000, index + 124);

  return `#RPT-${year}-${String(hash).padStart(6, "0")}`;
}

function getReportTitle(report: StrayAnimalReport) {
  const cleanDescription = report.description
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.toLowerCase().startsWith("breed:"));

  if (cleanDescription && cleanDescription.length <= 52) {
    return cleanDescription;
  }

  if (report.condition?.toLowerCase().includes("injured")) {
    return `Injured ${report.animalType} on the Street`;
  }

  if (report.condition) {
    return `${report.condition} ${report.animalType} Report`;
  }

  return `${report.animalType} Report`;
}

function getUpdateMessage(report: StrayAnimalReport) {
  if (report.fieldStatus === "ASSIGNED") {
    return "A field agent has been assigned and is preparing to respond.";
  }

  if (report.fieldStatus === "ACCEPTED") {
    return "A field agent accepted the case and is preparing to respond.";
  }

  if (report.fieldStatus === "REJECTED") {
    return "The assigned field agent could not take this case. Admin will reassign it.";
  }

  if (report.fieldStatus === "EN_ROUTE") {
    return "A field agent is on the way to the reported location.";
  }

  if (report.fieldStatus === "ON_SCENE") {
    return "A field agent is on scene and checking on the animal.";
  }

  if (report.fieldStatus === "RESCUE_IN_PROGRESS") {
    return "A field agent has started helping the animal.";
  }

  if (report.fieldStatus === "HELPED") {
    return report.fieldOutcome || "The field team helped the animal and closed this case.";
  }

  if (report.fieldStatus === "UNABLE_TO_LOCATE") {
    return report.fieldNotes || "The field team visited the area but could not locate the animal yet.";
  }

  if (report.fieldStatus === "FAILED") {
    return report.fieldOutcome || report.fieldNotes || "The rescue could not be completed.";
  }

  if (report.status === "IN_PROGRESS") {
    return "Our rescue team has been notified and is on the way to the location.";
  }

  if (report.status === "RESOLVED") {
    return "This report has been resolved and closed by the rescue team.";
  }

  return "Your report has been received and is under review.";
}

function formatTimelineTime(value?: string | null) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return date.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function getCaseTimeline(report: StrayAnimalReport): CaseTimeline {
  const assigned = report.assignedAt;
  const accepted =
    report.acceptedAt ??
    (report.fieldStatus === "ACCEPTED" ||
    report.fieldStatus === "EN_ROUTE" ||
    report.fieldStatus === "ON_SCENE" ||
    report.fieldStatus === "RESCUE_IN_PROGRESS" ||
    report.fieldStatus === "HELPED" ||
    report.fieldStatus === "UNABLE_TO_LOCATE" ||
    report.fieldStatus === "FAILED"
      ? report.assignedAt ?? report.updatedAt
      : null);
  const rejected = report.rejectedAt ?? (report.fieldStatus === "REJECTED" ? report.updatedAt : null);
  const enRoute =
    report.dispatchedAt ??
    (report.fieldStatus === "EN_ROUTE" ? report.updatedAt : null);
  const onScene =
    report.onSceneAt ??
    (report.fieldStatus === "ON_SCENE" ? report.updatedAt : null);
  const rescueStarted =
    report.rescueStartedAt ??
    (report.fieldStatus === "RESCUE_IN_PROGRESS" ? report.updatedAt : null);
  const finished =
    report.fieldStatus === "FAILED"
      ? report.failedAt ?? report.updatedAt
      : report.fieldStatus === "UNABLE_TO_LOCATE"
      ? report.unableToLocateAt ?? report.updatedAt
      : report.resolvedAt;
  const completedLabel =
    report.fieldStatus === "FAILED"
      ? "Rescue failed"
      : report.fieldStatus === "UNABLE_TO_LOCATE"
        ? "Unable to locate"
        : "Completed";

  const baseSteps = [
    {
      body: "Your report has been received by the SPCA team.",
      label: "Report submitted",
      timeValue: report.createdAt,
    },
    {
      body: "A field agent has been assigned to the case.",
      label: "Field agent assigned",
      timeValue: assigned,
    },
    {
      body: "The field agent accepted the assignment.",
      label: "Case accepted",
      timeValue: accepted,
    },
    {
      body: "The field agent is travelling to the reported location.",
      label: "Agent en route",
      timeValue: enRoute,
    },
    {
      body: "The field agent has reached the area and is checking on the animal.",
      label: "At location",
      timeValue: onScene,
    },
    {
      body: "The field agent has started helping the animal.",
      label: "Rescue in progress",
      timeValue: rescueStarted,
    },
    {
      body:
        report.fieldStatus === "FAILED"
          ? report.fieldOutcome || report.fieldNotes || "The rescue could not be completed."
          : report.fieldStatus === "UNABLE_TO_LOCATE"
          ? "The team checked the area but could not locate the animal."
          : "The field team has helped the animal and closed the case.",
      label: completedLabel,
      timeValue: finished,
    },
  ];
  const rejectedStep = {
    body: "The assigned field agent could not take this case. Admin will reassign it.",
    label: "Assignment rejected",
    timeValue: rejected,
  };
  const timelineSteps = rejected ? [...baseSteps.slice(0, 2), rejectedStep] : baseSteps;
  const steps: CaseTimelineStep[] = timelineSteps.map((step) => ({
    body: step.body,
    label: step.label,
    state: step.timeValue ? "done" : "pending",
    time: formatTimelineTime(step.timeValue),
  }));
  const currentStep =
    [...steps].reverse().find((step) => step.state === "done") ??
    steps[0];

  return {
    steps,
    summaryBody: currentStep.body,
    summaryTitle: currentStep.label,
    tone:
      report.fieldStatus === "UNABLE_TO_LOCATE"
        ? "alert"
        : report.fieldStatus === "FAILED" || report.fieldStatus === "REJECTED"
        ? "alert"
        : report.fieldStatus === "HELPED" || report.status === "RESOLVED"
          ? "success"
          : "active",
  };
}

function getFallbackImage(report: StrayAnimalReport, index: number) {
  const imagePool = report.status === "RESOLVED" ? previousReportImages : activeReportImages;

  if (report.animalType === "Cat") {
    return report.status === "RESOLVED"
      ? require("../../assets/animals/cats/100.jpeg")
      : require("../../assets/animals/cats/105.jpeg");
  }

  if (report.animalType === "Dog") {
    return imagePool[index % imagePool.length];
  }

  return require("../../assets/cat-dog illustration.png");
}

function toReportCard(report: StrayAnimalReport, index: number): ReportCardModel {
  const created = formatDateTime(report.createdAt);
  const updated = formatDateTime(report.updatedAt);

  return {
    id: report.id,
    animalType: report.animalType,
    assignedAgentName: report.assignedAgent?.fullName ?? null,
    fieldNotes: report.fieldNotes,
    fieldOutcome: report.fieldOutcome,
    fieldStatus: report.fieldStatus,
    image: report.images?.[0]?.dataUri
      ? { uri: report.images[0].dataUri }
      : report.imageUrl
        ? { uri: report.imageUrl }
        : getFallbackImage(report, index),
    location: report.location,
    reportedDate: created.date,
    reportedTime: created.time,
    status: report.status,
    statusLabel: formatStatus(report.status),
    ticket: getTicketNumber(report, index),
    timeline: getCaseTimeline(report),
    title: getReportTitle(report),
    updateDate: updated.date,
    updateMessage: getUpdateMessage(report),
    updateTime: updated.time,
  };
}

function openReportDetails(report: ReportCardModel) {
  Alert.alert(
    report.ticket,
    `${report.title}\n${report.location}\nStatus: ${report.statusLabel}\nField: ${formatFieldStatus(report.fieldStatus)}`
  );
}

function SectionHeader({
  count,
  subtitle,
  title,
}: {
  count: number;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatusBadge({ status, label }: { label: string; status: StrayAnimalReport["status"] }) {
  const badgeStyle =
    status === "RESOLVED"
      ? styles.resolvedBadge
      : status === "IN_PROGRESS"
        ? styles.progressBadge
        : styles.reportedBadge;
  const textStyle =
    status === "RESOLVED"
      ? styles.resolvedBadgeText
      : status === "IN_PROGRESS"
        ? styles.progressBadgeText
        : styles.reportedBadgeText;

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusBadgeText, textStyle]}>{label}</Text>
    </View>
  );
}

function CaseStatusTimeline({ timeline }: { timeline: CaseTimeline }) {
  const summaryTone =
    timeline.tone === "alert"
      ? styles.caseTimelineSummaryAlert
      : timeline.tone === "success"
        ? styles.caseTimelineSummarySuccess
        : null;
  const iconColor =
    timeline.tone === "alert"
      ? colors.danger
      : timeline.tone === "success"
        ? SUPPORT_GREEN
        : PRIMARY;

  return (
    <View style={styles.caseTimelineCard}>
      <View style={[styles.caseTimelineSummary, summaryTone]}>
        <View style={styles.caseTimelineIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={iconColor} />
        </View>
        <View style={styles.updateCopy}>
          <Text style={styles.updateTitle}>{timeline.summaryTitle}</Text>
          <Text style={styles.updateText}>{timeline.summaryBody}</Text>
        </View>
      </View>
      <View style={styles.caseTimelineList}>
        {timeline.steps.map((step, index) => (
          <View key={step.label} style={styles.caseTimelineStep}>
            <View style={styles.caseTimelineRail}>
              {index ? <View style={styles.caseTimelineRailLineTop} /> : null}
              <View
                style={[
                  styles.caseTimelineDot,
                  step.label.toLowerCase().includes("unable") && step.state === "done"
                    ? styles.caseTimelineDotAlert
                    : null,
                  step.state === "pending" ? styles.caseTimelineDotPending : null,
                ]}
              >
                {step.state === "done" ? (
                  <Ionicons name="checkmark" size={11} color={colors.white} />
                ) : null}
              </View>
              {index < timeline.steps.length - 1 ? (
                <View style={styles.caseTimelineRailLineBottom} />
              ) : null}
            </View>
            <View style={styles.caseTimelineStepCopy}>
              <Text
                style={[
                  styles.caseTimelineStepLabel,
                  step.state === "pending" ? styles.caseTimelineStepPending : null,
                ]}
              >
                {step.label}
              </Text>
              <Text style={styles.caseTimelineStepBody}>{step.body}</Text>
            </View>
            <Text
              style={[
                styles.caseTimelineTime,
                step.state === "pending" ? styles.caseTimelineStepPending : null,
              ]}
            >
              {step.time}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FieldAgentActions({
  busy,
  onUpdate,
  report,
  updatingStatus,
}: {
  busy: boolean;
  onUpdate: (id: string, fieldStatus: FieldReportStatus) => void;
  report: ReportCardModel;
  updatingStatus: FieldReportStatus | null;
}) {
  const actions: { label: string; status: FieldReportStatus }[] = [
    { label: "En route", status: "EN_ROUTE" },
    { label: "On scene", status: "ON_SCENE" },
    { label: "Rescue", status: "RESCUE_IN_PROGRESS" },
    { label: "Helped", status: "HELPED" },
    { label: "Could not find", status: "UNABLE_TO_LOCATE" },
  ];

  return (
    <View style={styles.fieldActions}>
      <View style={styles.fieldActionsHeader}>
        <Ionicons name="navigate-outline" size={17} color={PRIMARY} />
        <Text style={styles.fieldActionsTitle}>Update case</Text>
        <Text style={styles.fieldActionsStatus}>{formatFieldStatus(report.fieldStatus)}</Text>
      </View>
      <View style={styles.fieldActionGrid}>
        {actions.map((action) => {
          const selected = report.fieldStatus === action.status;

          return (
            <Pressable
              key={action.status}
              disabled={busy || selected}
              onPress={() => onUpdate(report.id, action.status)}
              style={({ pressed }) => [
                styles.fieldActionButton,
                selected ? styles.fieldActionButtonSelected : null,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.fieldActionText,
                  selected ? styles.fieldActionTextSelected : null,
                ]}
              >
                {updatingStatus === action.status ? "Saving..." : action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ActiveReportCard({
  fieldAgent,
  onFieldUpdate,
  report,
  updating,
  updatingStatus,
}: {
  fieldAgent: boolean;
  onFieldUpdate: (id: string, fieldStatus: FieldReportStatus) => void;
  report: ReportCardModel;
  updating: boolean;
  updatingStatus: FieldReportStatus | null;
}) {
  return (
    <View style={styles.activeCard}>
      <View style={styles.reportSummaryRow}>
        <Image source={report.image} style={styles.activeImage} resizeMode="cover" />
        <View style={styles.reportInfo}>
          <View style={styles.ticketRow}>
            <View style={styles.ticketStatusGroup}>
              <Text style={styles.ticketText} numberOfLines={1}>
                {report.ticket}
              </Text>
              <StatusBadge label={report.statusLabel} status={report.status} />
            </View>
            <Pressable
              onPress={() => openReportDetails(report)}
              style={({ pressed }) => [styles.menuButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Report options"
            >
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.reportTitle} numberOfLines={1}>
            {report.title}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={17} color={colors.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {report.location}
            </Text>
          </View>
          <Text style={styles.reportedMeta} numberOfLines={1}>
            Reported on {report.reportedDate}
            {" \u2022 "}
            {report.reportedTime}
          </Text>
        </View>
      </View>

      <CaseStatusTimeline timeline={report.timeline} />

      {fieldAgent ? (
        <FieldAgentActions
          busy={updating}
          onUpdate={onFieldUpdate}
          report={report}
          updatingStatus={updatingStatus}
        />
      ) : null}

      <Pressable
        onPress={() => openReportDetails(report)}
        style={({ pressed }) => [styles.detailsButton, pressed ? styles.pressed : null]}
        accessibilityRole="button"
        accessibilityLabel="View report details"
      >
        <Text style={styles.detailsButtonText}>View Details</Text>
        <Ionicons name="chevron-forward" size={25} color={PRIMARY} />
      </Pressable>
    </View>
  );
}

function PreviousReportCard({ report }: { report: ReportCardModel }) {
  return (
    <Pressable
      onPress={() => openReportDetails(report)}
      style={({ pressed }) => [styles.previousCard, pressed ? styles.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel="View previous report"
    >
      <Image source={report.image} style={styles.previousImage} resizeMode="cover" />
      <View style={styles.previousInfo}>
        <View style={styles.previousTicketRow}>
          <Text style={styles.ticketText} numberOfLines={1}>
            {report.ticket}
          </Text>
          <StatusBadge label={report.statusLabel} status={report.status} />
        </View>
        <Text style={styles.previousTitle} numberOfLines={2}>
          {report.title}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.previousLocationText} numberOfLines={1}>
            {report.location}
          </Text>
        </View>
        <Text style={styles.previousMeta} numberOfLines={1}>
          Reported on {report.reportedDate}
          {" \u2022 "}
          {report.reportedTime}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
    </Pressable>
  );
}

function EmptySection({
  fieldAgent,
  group,
  signedIn,
}: {
  fieldAgent: boolean;
  group: ReportGroup;
  signedIn: boolean;
}) {
  const isActive = group === "active";
  const title = signedIn
    ? fieldAgent
      ? isActive
        ? "No assigned cases"
        : "No completed cases"
      : isActive
        ? "No active reports yet"
        : "No previous reports yet"
    : "Sign in to view reports";
  const body = signedIn
    ? fieldAgent
      ? isActive
        ? "Cases assigned by admin will appear here for field response."
        : "Cases you resolve will appear here."
      : isActive
        ? "New reports you submit will appear here while they are being handled."
        : "Resolved or closed reports will appear here."
    : "Anonymous reports are handled, but updates only appear here when a report is linked to your account.";

  return (
    <View style={styles.emptyPanel}>
      <Ionicons
        name={isActive ? "file-tray-outline" : "checkmark-circle-outline"}
        size={30}
        color={SUPPORT_GREEN}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
      {isActive && !fieldAgent ? (
        <Pressable
          onPress={() => router.push("/report-stray")}
          style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <Text style={styles.emptyButtonText}>Create Report</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FloatingChatBar() {
  return (
    <View style={styles.floatingChatWrap} pointerEvents="box-none">
      <Pressable
        onPress={() =>
          Alert.alert("Start Chat", "Live report support can be connected here.")
        }
        style={({ pressed }) => [styles.floatingChatBar, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <View style={styles.floatingChatIcon}>
          <Ionicons name="headset-outline" size={21} color={SUPPORT_GREEN} />
        </View>
        <View style={styles.floatingChatCopy}>
          <Text style={styles.floatingChatTitle}>Need help?</Text>
          <Text style={styles.floatingChatText}>Report support is here</Text>
        </View>
        <View style={styles.floatingChatButton}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.white} />
          <Text style={styles.floatingChatButtonText}>Start Chat</Text>
        </View>
      </Pressable>
    </View>
  );
}

function CreateReportButton() {
  return (
    <Pressable
      onPress={() => router.push("/report-stray")}
      style={({ pressed }) => [styles.createReportButton, pressed ? styles.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel="Create a stray animal report"
    >
      <View style={styles.createReportIcon}>
        <Ionicons name="add" size={22} color={colors.white} />
      </View>
      <View style={styles.createReportCopy}>
        <Text style={styles.createReportTitle}>Create Report</Text>
        <Text style={styles.createReportText}>Report a stray animal</Text>
      </View>
      <Ionicons name="chevron-forward" size={23} color={PRIMARY} />
    </Pressable>
  );
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<StrayAnimalReport[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<ReportFilter>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingCase, setUpdatingCase] = useState<{
    id: string;
    status: FieldReportStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFieldAgent = user?.role === "FIELD_AGENT";

  const loadReports = useCallback(async (showRefresh = false, silent = false) => {
    if (!user?.id) {
      setReports([]);
      setUnreadNotifications(0);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    setError(null);

    if (showRefresh) {
      setRefreshing(true);
    } else if (!silent) {
      setLoading(true);
    }

    try {
      const [nextReports, nextNotifications] = await Promise.all([
        getStrayAnimalReports(),
        getNotifications().catch(() => []),
      ]);
      setReports(nextReports);
      setUnreadNotifications(nextNotifications.filter((notification) => !notification.readAt).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const handleFieldUpdate = useCallback(async (id: string, fieldStatus: FieldReportStatus) => {
    const fieldNotes =
      fieldStatus === "EN_ROUTE"
        ? "Field agent is heading to the location."
        : fieldStatus === "ON_SCENE"
          ? "Field agent is on scene checking the animal."
          : fieldStatus === "RESCUE_IN_PROGRESS"
            ? "Field agent has started helping the animal."
            : fieldStatus === "UNABLE_TO_LOCATE"
              ? "Field agent checked the area but could not locate the animal."
              : undefined;
    const fieldOutcome =
      fieldStatus === "HELPED" ? "Animal helped by the field team." : undefined;

    setUpdatingCase({ id, status: fieldStatus });
    setError(null);

    try {
      const updatedReport = await updateFieldReport(id, {
        fieldNotes,
        fieldOutcome,
        fieldStatus,
      });
      setReports((current) =>
        current.map((report) => (report.id === id ? updatedReport : report))
      );
      const nextNotifications = await getNotifications().catch(() => []);
      setUnreadNotifications(nextNotifications.filter((notification) => !notification.readAt).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update field case");
    } finally {
      setUpdatingCase(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports(false);
    }, [loadReports])
  );

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const timer = setInterval(() => {
      void loadReports(false, true);
    }, 10000);

    return () => clearInterval(timer);
  }, [loadReports, user?.id]);

  const myReports = useMemo(() => reports, [reports]);

  const reportCards = useMemo(
    () => myReports.map((report, index) => toReportCard(report, index)),
    [myReports]
  );

  const activeReports = reportCards.filter((report) => report.status !== "RESOLVED");
  const previousReports = reportCards.filter((report) => report.status === "RESOLVED");
  const signedIn = Boolean(user?.id);

  const activeSection = (
    <View style={styles.sectionBlock}>
      <SectionHeader
        count={activeReports.length}
        title={isFieldAgent ? "Active Cases" : "Active Reports"}
        subtitle={isFieldAgent ? "Cases assigned for field response" : "Reports that are currently being handled"}
      />
      {activeReports.length > 0 ? (
        <View style={styles.cardStack}>
          {activeReports.map((report) => (
            <ActiveReportCard
              fieldAgent={isFieldAgent}
              key={report.id}
              onFieldUpdate={handleFieldUpdate}
              report={report}
              updating={updatingCase?.id === report.id}
              updatingStatus={updatingCase?.id === report.id ? updatingCase.status : null}
            />
          ))}
        </View>
      ) : (
        <EmptySection fieldAgent={isFieldAgent} group="active" signedIn={signedIn} />
      )}
    </View>
  );

  const previousSection = (
    <View style={styles.sectionBlock}>
      <SectionHeader
        count={previousReports.length}
        title={isFieldAgent ? "Completed Cases" : "Previous Reports"}
        subtitle={isFieldAgent ? "Field cases marked as helped" : "Reports that have been resolved or closed"}
      />
      {previousReports.length > 0 ? (
        <View style={styles.previousStack}>
          {previousReports.map((report) => (
            <PreviousReportCard key={report.id} report={report} />
          ))}
        </View>
      ) : (
        <EmptySection fieldAgent={isFieldAgent} group="previous" signedIn={signedIn} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadReports(true)}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title} numberOfLines={1}>
            {isFieldAgent ? "Field Cases" : "My Reports"}
          </Text>
          {isFieldAgent ? (
            <View style={styles.headerSpacer} />
          ) : (
            <Pressable
              onPress={() => router.push("/report-stray")}
              style={({ pressed }) => [styles.bellButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Create report"
            >
              <Ionicons name="add-circle-outline" size={29} color={PRIMARY} />
            </Pressable>
          )}
        </View>

        <View style={styles.segmentedControl}>
          {reportFilters.map((filter) => {
            const selected = selectedGroup === filter.value;

            return (
              <Pressable
                key={filter.value}
                onPress={() => setSelectedGroup(filter.value)}
                style={({ pressed }) => [
                  styles.segment,
                  selected ? styles.segmentSelected : null,
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {unreadNotifications ? (
          <View style={styles.notificationStrip}>
            <Ionicons name="notifications-outline" size={18} color={PRIMARY} />
            <Text style={styles.notificationStripText}>
              {unreadNotifications} unread case update{unreadNotifications === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null}

        {isFieldAgent ? null : <CreateReportButton />}

        {loading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.stateTitle}>Loading reports</Text>
          </View>
        ) : error ? (
          <View style={styles.statePanel}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.warning} />
            <Text style={styles.stateTitle}>Reports unavailable</Text>
            <Text style={styles.stateBody}>{error}</Text>
            <Pressable
              onPress={() => void loadReports(false)}
              style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : selectedGroup === "active" ? (
          activeSection
        ) : selectedGroup === "previous" ? (
          previousSection
        ) : (
          <>
            {activeSection}
            {previousSection}
          </>
        )}
      </ScrollView>
      {isFieldAgent ? null : <FloatingChatBar />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
    flex: 1,
  },
  content: {
    alignSelf: "center",
    backgroundColor: colors.white,
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(112),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(8),
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: vs(56),
  },
  headerSpacer: {
    width: TOUCH_TARGET,
  },
  title: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(25),
    fontWeight: "900",
    lineHeight: ms(31),
    textAlign: "center",
  },
  bellButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  segmentedControl: {
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: vs(18),
    marginTop: vs(4),
    padding: rs(4),
  },
  segment: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: vs(38),
  },
  segmentSelected: {
    backgroundColor: PRIMARY,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(18),
  },
  segmentTextSelected: {
    color: colors.white,
    fontWeight: "900",
  },
  createReportButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(18),
    minHeight: vs(62),
    paddingHorizontal: rs(12),
    paddingVertical: vs(9),
  },
  createReportIcon: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 999,
    height: rs(38),
    justifyContent: "center",
    width: rs(38),
  },
  createReportCopy: {
    flex: 1,
    minWidth: 0,
  },
  createReportTitle: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  createReportText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(16),
    marginTop: vs(1),
  },
  notificationStrip: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(12),
    minHeight: vs(42),
    paddingHorizontal: rs(12),
  },
  notificationStripText: {
    color: PRIMARY_DARK,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(17),
  },
  sectionBlock: {
    marginBottom: vs(18),
  },
  sectionHeader: {
    marginBottom: vs(9),
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderRadius: 999,
    height: rs(27),
    justifyContent: "center",
    minWidth: rs(27),
    paddingHorizontal: rs(8),
  },
  countText: {
    color: PRIMARY_DARK,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(19),
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(4),
  },
  cardStack: {
    gap: vs(9),
  },
  activeCard: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    padding: rs(9),
  },
  reportSummaryRow: {
    flexDirection: "row",
    gap: rs(9),
  },
  activeImage: {
    borderRadius: 18,
    height: ACTIVE_IMAGE_HEIGHT,
    width: ACTIVE_IMAGE_WIDTH,
  },
  reportInfo: {
    flex: 1,
    minWidth: 0,
  },
  ticketRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(6),
    justifyContent: "space-between",
    minHeight: rs(26),
  },
  ticketStatusGroup: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(6),
    minWidth: 0,
  },
  ticketText: {
    color: PRIMARY,
    flexShrink: 1,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
  },
  menuButton: {
    alignItems: "center",
    height: rs(26),
    justifyContent: "center",
    width: rs(24),
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: rs(8),
    paddingVertical: vs(3),
  },
  statusBadgeText: {
    fontSize: ms(10),
    fontWeight: "900",
    lineHeight: ms(13),
  },
  progressBadge: {
    backgroundColor: "#FDEBCE",
  },
  progressBadgeText: {
    color: "#BA5B00",
  },
  reportedBadge: {
    backgroundColor: "#E6F1FF",
  },
  reportedBadgeText: {
    color: "#0B5EA8",
  },
  resolvedBadge: {
    backgroundColor: SUPPORT_GREEN_SOFT,
  },
  resolvedBadgeText: {
    color: SUPPORT_GREEN,
  },
  reportTitle: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(19),
    marginTop: vs(4),
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(5),
    marginTop: vs(5),
  },
  locationText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  reportedMeta: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(5),
  },
  caseTimelineCard: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    gap: vs(12),
    marginTop: vs(10),
    padding: rs(12),
  },
  caseTimelineDot: {
    alignItems: "center",
    backgroundColor: SUPPORT_GREEN,
    borderRadius: 999,
    height: rs(18),
    justifyContent: "center",
    width: rs(18),
    zIndex: 2,
  },
  caseTimelineDotAlert: {
    backgroundColor: colors.danger,
  },
  caseTimelineDotPending: {
    backgroundColor: colors.white,
    borderColor: "#B7C5D4",
    borderWidth: 2,
  },
  caseTimelineIcon: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderRadius: 999,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  caseTimelineList: {
    gap: vs(1),
  },
  caseTimelineRail: {
    alignItems: "center",
    alignSelf: "stretch",
    position: "relative",
    width: rs(24),
  },
  caseTimelineRailLineBottom: {
    backgroundColor: "#CFE2EE",
    bottom: 0,
    position: "absolute",
    top: "50%",
    width: 2,
  },
  caseTimelineRailLineTop: {
    backgroundColor: "#CFE2EE",
    bottom: "50%",
    position: "absolute",
    top: 0,
    width: 2,
  },
  caseTimelineStep: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(48),
  },
  caseTimelineStepBody: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "600",
    lineHeight: ms(14),
    marginTop: vs(1),
  },
  caseTimelineStepCopy: {
    flex: 1,
    minWidth: 0,
  },
  caseTimelineStepLabel: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "900",
  },
  caseTimelineStepPending: {
    color: colors.textSecondary,
  },
  caseTimelineSummary: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    padding: rs(10),
  },
  caseTimelineSummaryAlert: {
    backgroundColor: colors.warningSoft,
    borderColor: "#F2AAA6",
  },
  caseTimelineSummarySuccess: {
    backgroundColor: SUPPORT_GREEN_SOFT,
    borderColor: "#9BD8B4",
  },
  caseTimelineTime: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "800",
    maxWidth: rs(82),
    textAlign: "right",
  },
  updateBox: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: "#D5E9DC",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginTop: vs(8),
    minHeight: vs(66),
    paddingHorizontal: rs(9),
    paddingVertical: vs(8),
  },
  timelineWrap: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "flex-start",
    paddingTop: vs(13),
    position: "relative",
    width: rs(20),
  },
  timelineLine: {
    backgroundColor: "#B8DCC7",
    bottom: vs(6),
    position: "absolute",
    top: vs(6),
    width: 1,
  },
  timelineDot: {
    backgroundColor: SUPPORT_GREEN,
    borderRadius: 999,
    height: rs(10),
    width: rs(10),
  },
  updateCopy: {
    flex: 1,
    minWidth: 0,
  },
  updateTitle: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
  },
  updateText: {
    color: colors.text,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(3),
  },
  updateMeta: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "600",
    lineHeight: ms(13),
    marginTop: vs(2),
  },
  updateIconBox: {
    alignItems: "center",
    backgroundColor: SUPPORT_GREEN_SOFT,
    borderRadius: 999,
    height: rs(36),
    justifyContent: "center",
    width: rs(36),
  },
  detailsButton: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: vs(8),
    minHeight: vs(36),
    paddingHorizontal: rs(11),
  },
  detailsButtonText: {
    color: PRIMARY,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(17),
  },
  fieldActions: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    gap: vs(9),
    marginTop: vs(8),
    padding: rs(10),
  },
  fieldActionsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(6),
  },
  fieldActionsTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
  },
  fieldActionsStatus: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "800",
    lineHeight: ms(14),
  },
  fieldActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(7),
  },
  fieldActionButton: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: vs(36),
    paddingHorizontal: rs(10),
    justifyContent: "center",
  },
  fieldActionButtonSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  fieldActionText: {
    color: PRIMARY,
    fontSize: ms(11),
    fontWeight: "900",
    lineHeight: ms(15),
  },
  fieldActionTextSelected: {
    color: colors.white,
  },
  floatingChatWrap: {
    alignSelf: "center",
    bottom: vs(10),
    maxWidth: CONTENT_MAX_WIDTH,
    paddingHorizontal: PAGE_PADDING,
    position: "absolute",
    width: "100%",
  },
  floatingChatBar: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 22,
    borderWidth: 1,
    elevation: 8,
    flexDirection: "row",
    gap: rs(10),
    minHeight: vs(58),
    paddingHorizontal: rs(10),
    paddingVertical: vs(8),
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  floatingChatIcon: {
    alignItems: "center",
    backgroundColor: SUPPORT_GREEN_SOFT,
    borderRadius: 999,
    height: rs(38),
    justifyContent: "center",
    width: rs(38),
  },
  floatingChatCopy: {
    flex: 1,
    minWidth: 0,
  },
  floatingChatTitle: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(17),
  },
  floatingChatText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(1),
  },
  floatingChatButton: {
    alignItems: "center",
    backgroundColor: SUPPORT_GREEN,
    borderRadius: 16,
    flexDirection: "row",
    gap: rs(6),
    minHeight: vs(38),
    paddingHorizontal: rs(11),
  },
  floatingChatButtonText: {
    color: colors.white,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
  },
  previousStack: {
    gap: vs(10),
  },
  previousCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(11),
    padding: rs(10),
  },
  previousImage: {
    borderRadius: 18,
    height: PREVIOUS_IMAGE_HEIGHT,
    width: PREVIOUS_IMAGE_WIDTH,
  },
  previousInfo: {
    flex: 1,
    minWidth: 0,
  },
  previousTicketRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(7),
  },
  previousTitle: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
    marginTop: vs(5),
  },
  previousLocationText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  previousMeta: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(16),
    marginTop: vs(5),
  },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: vs(8),
    minHeight: vs(160),
    justifyContent: "center",
    padding: rs(18),
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(21),
    marginTop: vs(8),
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    marginTop: vs(6),
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    marginTop: vs(12),
    paddingHorizontal: rs(16),
    paddingVertical: vs(10),
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: vs(240),
    padding: rs(24),
  },
  stateTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
    marginTop: vs(10),
    textAlign: "center",
  },
  stateBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    marginTop: vs(6),
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: vs(14),
    minHeight: TOUCH_TARGET,
    minWidth: rs(104),
    paddingHorizontal: rs(16),
  },
  retryText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
