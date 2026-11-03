import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdoptionPickupDateTimePicker from "../components/AdoptionPickupDateTimePicker";
import { useAuth } from "../context/AuthContext";
import {
  getAdoptionApplications,
  scheduleAdoptionPickup,
  type AdoptionApplication,
  type AdoptionApplicationStatus,
} from "../services/api";
import colors from "../theme/colors";
import { CONTENT_MAX_WIDTH, ms, PAGE_PADDING, rs, TOUCH_TARGET, vs } from "../theme/responsive";

type FilterKey = "active" | "previous" | "all";
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const PRIMARY = colors.primary;
const PRIMARY_DARK = colors.primaryDark;
const SOFT_BLUE = colors.primarySoft;
const BORDER_BLUE = "#D6EAF6";
const SUPPORT_GREEN = colors.accent;
const SUPPORT_GREEN_SOFT = colors.accentSoft;
const filters: { label: string; value: FilterKey }[] = [
  { label: "Active", value: "active" },
  { label: "Previous", value: "previous" },
  { label: "All", value: "all" },
];


function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPickupDateTime(value: string | null) {
  if (value) {
    const scheduled = new Date(value);

    if (!Number.isNaN(scheduled.getTime())) return scheduled;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

function formatStatus(status: AdoptionApplicationStatus) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusTone(status: AdoptionApplicationStatus) {
  if (["APPROVED", "PICKUP_SCHEDULED", "ADOPTED"].includes(status)) {
    return {
      badge: styles.approvedBadge,
      icon: "checkmark-circle-outline" as IoniconName,
      text: styles.approvedBadgeText,
    };
  }

  if (status === "DECLINED") {
    return {
      badge: styles.declinedBadge,
      icon: "close-circle-outline" as IoniconName,
      text: styles.declinedBadgeText,
    };
  }

  if (status === "UNDER_REVIEW") {
    return {
      badge: styles.reviewBadge,
      icon: "time-outline" as IoniconName,
      text: styles.reviewBadgeText,
    };
  }

  return {
    badge: styles.submittedBadge,
    icon: "paper-plane-outline" as IoniconName,
    text: styles.submittedBadgeText,
  };
}

function getNextStep(status: AdoptionApplicationStatus, petName: string) {
  if (status === "UNDER_REVIEW") {
    return "The shelter team is reviewing your details and may contact you for a short interview.";
  }

  if (status === "APPROVED") {
    return `Great news. Your application is approved. Choose when you would like to collect ${petName}.`;
  }

  if (status === "PICKUP_SCHEDULED") {
    return `Your pickup for ${petName} is scheduled. Contact the shelter if you need to change it.`;
  }

  if (status === "ADOPTED") {
    return `${petName} has been collected and the adoption is complete.`;
  }

  if (status === "INSPECTION_ASSIGNED") {
    return "A field agent has been assigned to complete your home inspection.";
  }

  if (status === "INSPECTION_COMPLETED") {
    return "Your home inspection report is back with the admin team for a final decision.";
  }

  if (status === "INSPECTION_REQUIRED") {
    return "Your initial review passed. The shelter is arranging a home inspection.";
  }

  if (status === "DECLINED") {
    return "This application was not approved, but you can still browse pets that may be a better fit.";
  }

  return "Your application has been received and is waiting for the shelter team to review.";
}

function getFallbackImage(type: AdoptionApplication["animal"]["type"]): ImageSourcePropType {
  if (type === "Cat") {
    return require("../../assets/animals/cats/105.jpeg");
  }

  if (type === "Dog") {
    return require("../../assets/animals/dogs/101.jpeg");
  }

  return require("../../assets/cat-dog illustration.png");
}

function getApplicationImage(application: AdoptionApplication): ImageSourcePropType {
  const primaryImage = application.animal.images?.[0]?.dataUri;

  if (primaryImage) {
    return { uri: primaryImage };
  }

  return application.animal.imageDataUri
    ? { uri: application.animal.imageDataUri }
    : getFallbackImage(application.animal.type);
}

function StatusBadge({ status }: { status: AdoptionApplicationStatus }) {
  const tone = getStatusTone(status);

  return (
    <View style={[styles.statusBadge, tone.badge]}>
      <Ionicons name={tone.icon} size={rs(13)} color={tone.text.color} />
      <Text style={[styles.statusBadgeText, tone.text]}>{formatStatus(status)}</Text>
    </View>
  );
}

function StatTile({
  count,
  icon,
  label,
}: {
  count: number;
  icon: IoniconName;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIcon}>
        <Ionicons
          name={icon}
          size={rs(19)}
          color={label === "Approved" ? SUPPORT_GREEN : PRIMARY}
        />
      </View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ApplicationCard({
  application,
  onUpdated,
}: {
  application: AdoptionApplication;
  onUpdated: (application: AdoptionApplication) => void;
}) {
  const petName = application.animal.name;
  const [pickupDate, setPickupDate] = useState(() =>
    getPickupDateTime(application.pickupScheduledAt)
  );
  const [pickupNote, setPickupNote] = useState(application.pickupNote ?? "");
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const editingScheduledPickup = application.status === "PICKUP_SCHEDULED";

  async function schedulePickup() {
    if (Number.isNaN(pickupDate.getTime()) || pickupDate.getTime() <= Date.now()) {
      setPickupError("Choose a collection date and time in the future.");
      return;
    }

    setPickupError(null);
    setScheduling(true);
    try {
      onUpdated(await scheduleAdoptionPickup(application.id, {
        pickupScheduledAt: pickupDate.toISOString(),
        pickupNote: pickupNote.trim() || undefined,
      }));
      Alert.alert(
        editingScheduledPickup ? "Pickup updated" : "Pickup scheduled",
        `The shelter now expects you on ${pickupDate.toLocaleString()}.`
      );
    } catch (error) {
      Alert.alert("Could not schedule pickup", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <View style={styles.applicationCard}>
      <View style={styles.applicationMain}>
        <Image source={getApplicationImage(application)} style={styles.applicationImage} />
        <View style={styles.applicationCopy}>
        <View style={styles.cardTopRow}>
          <View style={styles.petTitleBlock}>
            <Text style={styles.petName} numberOfLines={1}>
              {petName}
            </Text>
            <Text style={styles.petMeta} numberOfLines={1}>
              {application.animal.age} / {application.animal.sex} / {application.animal.breed}
            </Text>
          </View>
          <StatusBadge status={application.status} />
        </View>

        <Text style={styles.nextStepText} numberOfLines={2}>
          {getNextStep(application.status, petName)}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>Applied {formatDate(application.createdAt)}</Text>
          <Ionicons name="chevron-forward" size={rs(18)} color={colors.textSecondary} />
        </View>
        </View>
      </View>
      {application.status === "APPROVED" || editingScheduledPickup ? (
        <View style={styles.pickupForm}>
          <Text style={styles.pickupTitle}>
            {editingScheduledPickup ? "Change collection time" : "Schedule collection"}
          </Text>
          <AdoptionPickupDateTimePicker
            disabled={scheduling}
            minimumDate={new Date()}
            onChange={(value) => {
              setPickupDate(value);
              setPickupError(null);
            }}
            value={pickupDate}
          />
          <TextInput
            editable={!scheduling}
            onChangeText={setPickupNote}
            placeholder="Optional note for the shelter"
            style={styles.pickupInput}
            value={pickupNote}
          />
          {pickupError ? <Text style={styles.pickupError}>{pickupError}</Text> : null}
          <Pressable disabled={scheduling} onPress={schedulePickup} style={styles.pickupButton}>
            <Text style={styles.pickupButtonText}>
              {scheduling
                ? "Saving..."
                : editingScheduledPickup
                  ? "Update pickup"
                  : "Confirm pickup"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {application.pickupScheduledAt ? (
        <Text style={styles.pickupScheduled}>Pickup: {new Date(application.pickupScheduledAt).toLocaleString()}</Text>
      ) : null}
    </View>
  );
}

function EmptyApplications({
  signedIn,
  type,
}: {
  signedIn: boolean;
  type: FilterKey;
}) {
  const title = signedIn
    ? type === "previous"
      ? "No previous applications"
      : "No applications yet"
    : "Sign in to track adoptions";
  const body = signedIn
    ? "Applications you submit will appear here with their current status."
    : "Create or sign into your account so adoption applications stay linked to you.";

  return (
    <View style={styles.emptyPanel}>
      <Ionicons name="heart-circle-outline" size={rs(36)} color={PRIMARY} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{body}</Text>
      <Pressable
        onPress={() => router.push(signedIn ? "/adoption" : "/login")}
        style={({ pressed }) => [styles.emptyButton, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonText}>{signedIn ? "Browse Pets" : "Sign In"}</Text>
      </Pressable>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed ? styles.pressed : null]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={rs(20)} color={label === "Ask support" ? SUPPORT_GREEN : PRIMARY} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

export default function AdoptionsTabScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<AdoptionApplication[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("active");
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(
    async (showRefresh = false) => {
      if (!user?.id) {
        setApplications([]);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const nextApplications = await getAdoptionApplications();
        setApplications(nextApplications);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load applications");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadApplications(false);
    }, [loadApplications])
  );

  const activeApplications = useMemo(
    () => applications.filter((application) => application.status !== "DECLINED"),
    [applications]
  );
  const previousApplications = useMemo(
    () => applications.filter((application) => application.status === "DECLINED"),
    [applications]
  );
  const visibleApplications =
    selectedFilter === "active"
      ? activeApplications
      : selectedFilter === "previous"
        ? previousApplications
        : applications;
  const approvedCount = applications.filter(
    (application) => application.status === "APPROVED"
  ).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadApplications(true)}
            tintColor={PRIMARY}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Adoptions</Text>
          </View>
          <Pressable
            onPress={() => router.push("/adoption")}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Browse pets"
          >
            <Ionicons name="add" size={rs(24)} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatTile count={activeApplications.length} icon="time-outline" label="Active" />
          <StatTile count={approvedCount} icon="checkmark-circle-outline" label="Approved" />
          <StatTile count={previousApplications.length} icon="archive-outline" label="Previous" />
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon="search-outline" label="Browse pets" onPress={() => router.push("/adoption")} />
          <QuickAction
            icon="help-circle-outline"
            label="Application tips"
            onPress={() =>
              Alert.alert(
                "Application tips",
                "Share honest details about your home, routine, other pets, and why the animal fits your lifestyle."
              )
            }
          />
          <QuickAction
            icon="chatbubble-ellipses-outline"
            label="Ask support"
            onPress={() => Alert.alert("Adoption support", "Adoption chat can be connected here.")}
          />
        </View>

        <View style={styles.segmentedControl}>
          {filters.map((filter) => {
            const selected = selectedFilter === filter.value;

            return (
              <Pressable
                key={filter.value}
                onPress={() => setSelectedFilter(filter.value)}
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

        {loading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.stateTitle}>Loading applications</Text>
          </View>
        ) : error ? (
          <View style={styles.statePanel}>
            <Ionicons name="cloud-offline-outline" size={rs(34)} color={colors.warning} />
            <Text style={styles.stateTitle}>Applications unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void loadApplications(false)}
              style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : visibleApplications.length > 0 ? (
          <View style={styles.applicationStack}>
            {visibleApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onUpdated={(next) =>
                  setApplications((current) => current.map((item) => item.id === next.id ? next : item))
                }
              />
            ))}
          </View>
        ) : (
          <EmptyApplications signedIn={Boolean(user?.id)} type={selectedFilter} />
        )}

      </ScrollView>
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
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(28),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(12),
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(14),
  },
  kicker: {
    color: PRIMARY,
    fontSize: ms(12),
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: ms(16),
  },
  title: {
    color: colors.charcoal,
    fontSize: ms(26),
    fontWeight: "900",
    lineHeight: ms(32),
    marginTop: vs(1),
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 999,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 26,
    flexDirection: "row",
    gap: rs(12),
    marginBottom: vs(12),
    padding: rs(16),
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    color: colors.white,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  summaryText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(18),
    marginTop: vs(5),
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    height: rs(58),
    justifyContent: "center",
    width: rs(58),
  },
  statsRow: {
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(12),
  },
  statTile: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: rs(8),
    paddingVertical: vs(11),
  },
  statIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(34),
    justifyContent: "center",
    width: rs(34),
  },
  statCount: {
    color: colors.charcoal,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
    marginTop: vs(5),
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "800",
    lineHeight: ms(15),
  },
  quickActions: {
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(14),
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: vs(5),
    minHeight: vs(72),
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: rs(6),
  },
  quickActionText: {
    color: colors.charcoal,
    fontSize: ms(11),
    fontWeight: "900",
    lineHeight: ms(15),
    textAlign: "center",
  },
  segmentedControl: {
    backgroundColor: SOFT_BLUE,
    borderColor: BORDER_BLUE,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: vs(14),
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
  },
  segmentTextSelected: {
    color: colors.white,
    fontWeight: "900",
  },
  applicationStack: {
    gap: vs(10),
  },
  applicationCard: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    padding: rs(11),
  },
  applicationMain: { alignItems: "center", flexDirection: "row", gap: rs(12) },
  pickupForm: {
    borderTopColor: BORDER_BLUE,
    borderTopWidth: 1,
    margin: rs(12),
    marginTop: 0,
    paddingTop: vs(10),
  },
  pickupTitle: { color: colors.charcoal, fontSize: ms(13), fontWeight: "900", marginBottom: vs(7) },
  pickupInput: { borderColor: BORDER_BLUE, borderRadius: 12, borderWidth: 1, color: colors.text, marginBottom: vs(7), minHeight: vs(42), paddingHorizontal: rs(10) },
  pickupError: { color: colors.danger, fontSize: ms(11), fontWeight: "800", marginBottom: vs(7) },
  pickupButton: { alignItems: "center", backgroundColor: SUPPORT_GREEN, borderRadius: 12, justifyContent: "center", minHeight: vs(42) },
  pickupButtonText: { color: colors.white, fontSize: ms(12), fontWeight: "900" },
  pickupScheduled: { color: SUPPORT_GREEN, fontSize: ms(12), fontWeight: "800", margin: rs(12), marginTop: 0 },
  applicationImage: {
    borderRadius: 18,
    height: rs(88),
    width: rs(88),
  },
  applicationCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: rs(8),
  },
  petTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  petMeta: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(1),
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: rs(4),
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
  },
  statusBadgeText: {
    fontSize: ms(10),
    fontWeight: "900",
    lineHeight: ms(13),
  },
  submittedBadge: {
    backgroundColor: SOFT_BLUE,
  },
  submittedBadgeText: {
    color: PRIMARY_DARK,
  },
  reviewBadge: {
    backgroundColor: "#FFF4DF",
  },
  reviewBadgeText: {
    color: "#9A5B20",
  },
  approvedBadge: {
    backgroundColor: SUPPORT_GREEN_SOFT,
  },
  approvedBadgeText: {
    color: SUPPORT_GREEN,
  },
  declinedBadge: {
    backgroundColor: colors.warningSoft,
  },
  declinedBadgeText: {
    color: colors.warning,
  },
  nextStepText: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(8),
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: vs(8),
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
  },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: vs(210),
    justifyContent: "center",
    padding: rs(20),
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: ms(17),
    fontWeight: "900",
    lineHeight: ms(22),
    marginTop: vs(8),
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    marginTop: vs(5),
    textAlign: "center",
  },
  emptyButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: vs(14),
    minHeight: TOUCH_TARGET,
    paddingHorizontal: rs(18),
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
    minHeight: vs(210),
    padding: rs(20),
  },
  stateTitle: {
    color: colors.charcoal,
    fontSize: ms(17),
    fontWeight: "900",
    lineHeight: ms(22),
    marginTop: vs(10),
    textAlign: "center",
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(5),
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: vs(14),
    minHeight: TOUCH_TARGET,
    minWidth: rs(110),
    paddingHorizontal: rs(16),
  },
  retryText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  checklistCard: {
    backgroundColor: SUPPORT_GREEN_SOFT,
    borderColor: "#D5E9DC",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: vs(16),
    padding: rs(15),
  },
  checklistHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(10),
  },
  checklistTitle: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  checklistRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    marginTop: vs(6),
  },
  checklistText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
  },
  pressed: {
    opacity: 0.72,
  },
});
