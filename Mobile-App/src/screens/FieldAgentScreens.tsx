import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  type RefreshControlProps,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  getStrayAnimalReports,
  updateFieldReport,
  type FieldReportStatus,
  type StrayAnimalReport,
} from "../services/api";
import colors from "../theme/colors";
import {
  CONTENT_MAX_WIDTH,
  PAGE_PADDING,
  TOUCH_TARGET,
  clamp,
  ms,
  rs,
  screen,
  vs,
} from "../theme/responsive";

type CaseBucket = "new" | "progress" | "completed";
type ReportsViewMode = "list" | "detail" | "update" | "navigate";
type FieldStatusChoice = {
  detail: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  note: string;
  outcome?: string;
  status: FieldReportStatus;
};

const AGENT_GREEN = colors.primary;
const AGENT_GREEN_DARK = colors.primaryDark;
const AGENT_GREEN_SOFT = colors.primarySoft;
const AGENT_MINT = colors.background;
const AGENT_RED = "#E85D5A";
const CARD_SHADOW = "rgba(15, 110, 168, 0.14)";

const fallbackDogImages: ImageSourcePropType[] = [
  require("../../assets/fieldagent/puppy rescue.jpg"),
  require("../../assets/fieldagent/rescued dog inside rescue van with worker image.jpg"),
  require("../../assets/animals/dogs/101.jpeg"),
  require("../../assets/animals/dogs/118.jpeg"),
  require("../../assets/animals/dogs/107.jpeg"),
  require("../../assets/animals/dogs/10.jpeg"),
];

const fallbackCatImages: ImageSourcePropType[] = [
  require("../../assets/animals/cats/105.jpeg"),
  require("../../assets/animals/cats/100.jpeg"),
  require("../../assets/animals/cats/110.jpeg"),
];

const statusChoices: FieldStatusChoice[] = [
  {
    detail: "I am travelling to the reported location.",
    icon: "navigate-outline",
    label: "On the way",
    note: "Field agent is on the way to the reported location.",
    status: "EN_ROUTE",
  },
  {
    detail: "I have reached the reported location.",
    icon: "map-outline",
    label: "Reached location",
    note: "Field agent reached the reported location.",
    status: "ON_SCENE",
  },
  {
    detail: "Animal is being checked and handled.",
    icon: "medkit-outline",
    label: "Rescue in progress",
    note: "Field agent is on scene and handling the animal.",
    status: "RESCUE_IN_PROGRESS",
  },
  {
    detail: "The animal has been helped or handed over.",
    icon: "shield-checkmark-outline",
    label: "Animal helped",
    note: "Animal was helped by the field team.",
    outcome: "Animal helped by the field team.",
    status: "HELPED",
  },
  {
    detail: "I searched the area but could not find the animal.",
    icon: "search-outline",
    label: "Unable to locate",
    note: "Field agent checked the area but could not locate the animal.",
    status: "UNABLE_TO_LOCATE",
  },
];

function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        delay,
        duration: 360,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        delay,
        damping: 18,
        mass: 0.8,
        stiffness: 130,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function formatReportId(report: StrayAnimalReport) {
  const hash = report.id
    .split("")
    .reduce((total, character) => (total + character.charCodeAt(0)) % 100000, 173);

  return `SR-${String(hash).padStart(5, "0")}`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  if (Number.isNaN(date.getTime()) || diff < 0) {
    return "Recently reported";
  }

  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (24 * 60))}d ago`;
}

function fieldStatusLabel(status: FieldReportStatus) {
  if (status === "ASSIGNED") return "New";
  if (status === "EN_ROUTE") return "On the way";
  if (status === "ON_SCENE") return "In progress";
  if (status === "RESCUE_IN_PROGRESS") return "Rescue in progress";
  if (status === "HELPED") return "Completed";
  if (status === "UNABLE_TO_LOCATE") return "Unable to locate";
  return "New";
}

function caseBucket(report: StrayAnimalReport): CaseBucket {
  if (report.fieldStatus === "HELPED" || report.fieldStatus === "UNABLE_TO_LOCATE" || report.status === "RESOLVED") {
    return "completed";
  }

  if (
    report.fieldStatus === "EN_ROUTE" ||
    report.fieldStatus === "ON_SCENE" ||
    report.fieldStatus === "RESCUE_IN_PROGRESS"
  ) {
    return "progress";
  }

  return "new";
}

function getReportTitle(report: StrayAnimalReport) {
  const firstLine = report.description
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.toLowerCase().startsWith("breed:"));

  if (firstLine && firstLine.length <= 54) {
    return firstLine;
  }

  if (report.condition?.trim()) {
    return `${report.condition.trim()} ${report.animalType.toLowerCase()}`;
  }

  return `${report.animalType} near ${report.location.split(",")[0] || "reported area"}`;
}

function getReportImage(report: StrayAnimalReport, index = 0): ImageSourcePropType {
  if (report.images?.[0]?.dataUri) {
    return { uri: report.images[0].dataUri };
  }

  if (report.imageUrl) {
    return { uri: report.imageUrl };
  }

  if (report.animalType === "Cat") {
    return fallbackCatImages[index % fallbackCatImages.length];
  }

  if (report.animalType === "Dog") {
    return fallbackDogImages[index % fallbackDogImages.length];
  }

  return require("../../assets/cat-dog illustration.png");
}

function statusTone(status: FieldReportStatus) {
  if (status === "HELPED") {
    return {
      bg: "#DDF5E7",
      text: "#0E7A42",
    };
  }

  if (status === "EN_ROUTE" || status === "ON_SCENE" || status === "RESCUE_IN_PROGRESS") {
    return {
      bg: "#FFF2D5",
      text: "#B46900",
    };
  }

  if (status === "UNABLE_TO_LOCATE") {
    return {
      bg: "#FFE9E7",
      text: "#B42318",
    };
  }

  return {
    bg: "#FFE8EA",
    text: "#BF2334",
  };
}

function useFieldAgentCases() {
  const { user } = useAuth();
  const [reports, setReports] = useState<StrayAnimalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications]
  );

  const loadCases = useCallback(
    async (showRefresh = false) => {
      if (!user?.id) {
        setReports([]);
        setNotifications([]);
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
        const [nextReports, notifications] = await Promise.all([
          getStrayAnimalReports(),
          getNotifications().catch(() => []),
        ]);

        setReports(nextReports);
        setNotifications(notifications);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load assigned reports");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      void loadCases(false);
    }, [loadCases])
  );

  const grouped = useMemo(
    () => ({
      completed: reports.filter((report) => caseBucket(report) === "completed"),
      newCases: reports.filter((report) => caseBucket(report) === "new"),
      progress: reports.filter((report) => caseBucket(report) === "progress"),
    }),
    [reports]
  );

  return {
    error,
    grouped,
    loadCases,
    loading,
    refreshing,
    reports,
    notifications,
    setReports,
    setNotifications,
    unreadNotifications,
    user,
  };
}

async function updateCaseStatus(
  report: StrayAnimalReport,
  choice: FieldStatusChoice,
  notes: string
) {
  const cleanNotes = notes.trim();

  return updateFieldReport(report.id, {
    fieldNotes: cleanNotes || choice.note,
    fieldOutcome:
      choice.status === "HELPED"
        ? cleanNotes || choice.outcome || "Animal helped by the field team."
        : undefined,
    fieldStatus: choice.status,
  });
}

function openMap(report: StrayAnimalReport) {
  const hasCoordinates = typeof report.latitude === "number" && typeof report.longitude === "number";
  const destination = hasCoordinates
    ? `${report.latitude},${report.longitude}`
    : encodeURIComponent(report.location);
  const url = `https://www.google.com/maps/search/?api=1&query=${destination}`;

  void Linking.openURL(url).catch(() => {
    Alert.alert("Map unavailable", "Could not open navigation on this device.");
  });
}

function ScreenFrame({
  children,
  refreshControl,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({
  action,
  back,
  notificationCount,
  onNotificationsPress,
  showNotifications = false,
  title,
}: {
  action?: ReactNode;
  back?: () => void;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  showNotifications?: boolean;
  title: string;
}) {
  return (
    <View style={styles.topBar}>
      {back ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.charcoal} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => Alert.alert("Menu", "Field agent menu.")}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Ionicons name="menu-outline" size={25} color={colors.charcoal} />
        </Pressable>
      )}
      <Text style={styles.topBarTitle} numberOfLines={1}>
        {title}
      </Text>
      {action ?? (showNotifications ? (
        <Pressable
          onPress={onNotificationsPress}
          style={({ pressed }) => [styles.bellWrap, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel={
            notificationCount ? `View ${notificationCount} unread notifications` : "View notifications"
          }
        >
          <Ionicons name="notifications-outline" size={24} color={colors.charcoal} />
          {notificationCount ? (
            <View style={styles.bellDot}>
              <Text style={styles.bellDotText}>{Math.min(notificationCount, 9)}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : <View style={styles.topBarActionSpacer} />)}
    </View>
  );
}

function NotificationSheet({
  notifications,
  onClose,
  onMarkAllRead,
  onOpenNotification,
  visible,
}: {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notification: AppNotification) => void;
  visible: boolean;
}) {
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.notificationSafeArea} edges={["top", "left", "right"]}>
        <View style={styles.notificationHeader}>
          <View>
            <Text style={styles.notificationTitle}>Notifications</Text>
            <Text style={styles.notificationSubtitle}>
              {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
          >
            <Ionicons name="close" size={24} color={colors.charcoal} />
          </Pressable>
        </View>
        {unreadCount ? (
          <Pressable
            onPress={onMarkAllRead}
            style={({ pressed }) => [styles.markAllButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-done-outline" size={18} color={AGENT_GREEN} />
            <Text style={styles.markAllButtonText}>Mark all as read</Text>
          </Pressable>
        ) : null}
        <ScrollView contentContainerStyle={styles.notificationList} showsVerticalScrollIndicator={false}>
          {notifications.length ? notifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => onOpenNotification(notification)}
              style={({ pressed }) => [
                styles.notificationItem,
                !notification.readAt ? styles.notificationItemUnread : null,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open notification: ${notification.title}`}
            >
              <View style={styles.notificationIcon}>
                <Ionicons name="notifications-outline" size={20} color={AGENT_GREEN} />
              </View>
              <View style={styles.notificationCopy}>
                <View style={styles.notificationItemHeader}>
                  <Text style={styles.notificationItemTitle} numberOfLines={1}>{notification.title}</Text>
                  <Text style={styles.notificationTime}>{formatNotificationTime(notification.createdAt)}</Text>
                </View>
                <Text style={styles.notificationBody}>{notification.body}</Text>
                {notification.reportId ? <Text style={styles.notificationLink}>Open assigned case</Text> : null}
              </View>
              {!notification.readAt ? <View style={styles.unreadIndicator} /> : null}
            </Pressable>
          )) : (
            <View style={styles.emptyNotifications}>
              <Ionicons name="notifications-off-outline" size={34} color={colors.textSecondary} />
              <Text style={styles.emptyNotificationsTitle}>No notifications yet</Text>
              <Text style={styles.emptyNotificationsBody}>Updates about your assigned cases will appear here.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function StatePanel({
  error,
  loading,
  onRetry,
}: {
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.statePanel}>
        <ActivityIndicator color={AGENT_GREEN} />
        <Text style={styles.stateTitle}>Loading field cases</Text>
      </View>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <View style={styles.statePanel}>
      <Ionicons name="cloud-offline-outline" size={30} color={AGENT_RED} />
      <Text style={styles.stateTitle}>Could not load cases</Text>
      <Text style={styles.stateBody}>{error}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function StatusPill({ status }: { status: FieldReportStatus }) {
  const tone = statusTone(status);

  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.text }]}>
        {fieldStatusLabel(status)}
      </Text>
    </View>
  );
}

function CaseCard({
  index,
  onPress,
  report,
}: {
  index: number;
  onPress: (report: StrayAnimalReport) => void;
  report: StrayAnimalReport;
}) {
  return (
    <FadeInView delay={index * 55}>
      <Pressable
        onPress={() => onPress(report)}
        style={({ pressed }) => [styles.caseCard, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <Image source={getReportImage(report, index)} style={styles.caseThumb} resizeMode="cover" />
        <View style={styles.caseCopy}>
          <Text style={styles.caseTitle} numberOfLines={1}>
            {getReportTitle(report)}
          </Text>
          <View style={styles.caseMetaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.caseMetaText} numberOfLines={1}>
              {report.location}
            </Text>
          </View>
          <Text style={styles.caseTime}>{formatRelativeTime(report.createdAt)}</Text>
        </View>
        <StatusPill status={report.fieldStatus} />
      </Pressable>
    </FadeInView>
  );
}

function EmptyCases({ label }: { label: string }) {
  return (
    <View style={styles.emptyCases}>
      <Ionicons name="checkmark-done-circle-outline" size={34} color={AGENT_GREEN} />
      <Text style={styles.emptyCasesTitle}>Nothing here right now</Text>
      <Text style={styles.emptyCasesText}>{label}</Text>
    </View>
  );
}

function FieldAgentIntro({
  notificationCount,
  onNotificationsPress,
  onStart,
  userName,
}: {
  notificationCount: number;
  onNotificationsPress: () => void;
  onStart: () => void;
  userName?: string;
}) {
  return (
    <SafeAreaView style={styles.introSafeArea} edges={["top", "bottom", "left", "right"]}>
      <FadeInView style={styles.introCard}>
        <Image
          source={require("../../assets/fieldagent/SPCA worker helping an animal.jpg")}
          style={styles.introBackgroundImage}
          resizeMode="cover"
        />
        <View style={styles.introImageShade} />
        <View style={styles.introTopRow}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          <Pressable
            onPress={onNotificationsPress}
            style={({ pressed }) => [styles.introBellButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel={
              notificationCount ? `View ${notificationCount} unread notifications` : "View notifications"
            }
          >
            <Ionicons name="notifications-outline" size={24} color={colors.white} />
            {notificationCount ? (
              <View style={styles.bellDot}>
                <Text style={styles.bellDotText}>{Math.min(notificationCount, 9)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>Field Agent</Text>
          <Text style={styles.introWelcome}>Welcome back{userName ? `, ${userName}` : ""}</Text>
          <Pressable
            onPress={onStart}
            style={({ pressed }) => [styles.fullPrimaryButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Text style={styles.fullPrimaryButtonText}>Get Started</Text>
          </Pressable>
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}

export function FieldAgentHomeScreen() {
  const {
    grouped,
    loadCases,
    loading,
    notifications,
    refreshing,
    reports,
    setNotifications,
    unreadNotifications,
    user,
    error,
  } =
    useFieldAgentCases();
  const [showIntro, setShowIntro] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeCase = grouped.progress[0] ?? grouped.newCases[0];

  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        const updated = await markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
      }
    }

    setNotificationsOpen(false);
    if (notification.reportId) {
      router.push({ pathname: "/(tabs)/chat", params: { reportId: notification.reportId } });
    }
  };

  const markAllRead = async () => {
    try {
      setNotifications(await markAllNotificationsRead());
    } catch (e) {
      Alert.alert("Could not update notifications", e instanceof Error ? e.message : "Please try again.");
    }
  };

  if (showIntro) {
    return (
      <>
        <FieldAgentIntro
          notificationCount={unreadNotifications}
          onNotificationsPress={() => setNotificationsOpen(true)}
          onStart={() => setShowIntro(false)}
          userName={user?.fullName}
        />
        <NotificationSheet
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
          onMarkAllRead={() => void markAllRead()}
          onOpenNotification={(notification) => void openNotification(notification)}
          visible={notificationsOpen}
        />
      </>
    );
  }

  return (
    <>
      <ScreenFrame
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadCases(true)}
          tintColor={AGENT_GREEN}
        />
      }
    >
      <TopBar
        notificationCount={unreadNotifications}
        onNotificationsPress={() => setNotificationsOpen(true)}
        showNotifications
        title=""
      />
      <FadeInView style={styles.agentGreeting}>
        <Text style={styles.greetingKicker}>Good morning,</Text>
        <Text style={styles.greetingName}>{user?.fullName || "Field Agent"}</Text>
      </FadeInView>
      <View style={styles.statRow}>
        <FadeInView delay={60} style={[styles.agentStatCard, styles.agentStatCardPrimary]}>
          <Text style={styles.agentStatValuePrimary}>{grouped.newCases.length}</Text>
          <Text style={styles.agentStatLabelPrimary}>New Reports</Text>
        </FadeInView>
        <FadeInView delay={100} style={styles.agentStatCard}>
          <Text style={styles.agentStatValue}>{grouped.progress.length}</Text>
          <Text style={styles.agentStatLabel}>In Progress</Text>
        </FadeInView>
        <FadeInView delay={140} style={styles.agentStatCard}>
          <Text style={styles.agentStatValue}>{grouped.completed.length}</Text>
          <Text style={styles.agentStatLabel}>Completed</Text>
        </FadeInView>
      </View>
      <StatePanel error={error} loading={loading} onRetry={() => void loadCases(false)} />
      {!loading && !error ? (
        <>
          {activeCase ? (
            <FadeInView delay={180} style={styles.priorityCard}>
              <View style={styles.priorityHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Priority case</Text>
                  <Text style={styles.priorityTitle} numberOfLines={1}>
                    {getReportTitle(activeCase)}
                  </Text>
                </View>
                <StatusPill status={activeCase.fieldStatus} />
              </View>
              <Image source={getReportImage(activeCase)} style={styles.priorityImage} resizeMode="cover" />
              <View style={styles.caseMetaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.caseMetaText} numberOfLines={1}>
                  {activeCase.location}
                </Text>
              </View>
              <View style={styles.priorityActions}>
                <Pressable
                  onPress={() => openMap(activeCase)}
                  style={({ pressed }) => [styles.outlineActionButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Ionicons name="navigate-outline" size={18} color={AGENT_GREEN} />
                  <Text style={styles.outlineActionText}>Navigate</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/chat")}
                  style={({ pressed }) => [styles.solidActionButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Text style={styles.solidActionText}>Open Case</Text>
                </Pressable>
              </View>
            </FadeInView>
          ) : (
            <EmptyCases label="Assigned cases will appear here once admin dispatches you." />
          )}
          <View style={styles.homeSectionHeader}>
            <Text style={styles.screenSectionTitle}>Reports</Text>
            <Pressable
              onPress={() => router.push("/(tabs)/chat")}
              style={({ pressed }) => [styles.filterButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <Ionicons name="options-outline" size={21} color={colors.charcoal} />
            </Pressable>
          </View>
          {reports.slice(0, 4).map((report, index) => (
            <CaseCard
              index={index}
              key={report.id}
              onPress={() => router.push("/(tabs)/chat")}
              report={report}
            />
          ))}
        </>
      ) : null}
      </ScreenFrame>
      <NotificationSheet
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
        onMarkAllRead={() => void markAllRead()}
        onOpenNotification={(notification) => void openNotification(notification)}
        visible={notificationsOpen}
      />
    </>
  );
}

function AgentReportsList({
  grouped,
  loading,
  onOpen,
}: {
  grouped: ReturnType<typeof useFieldAgentCases>["grouped"];
  loading: boolean;
  onOpen: (report: StrayAnimalReport) => void;
}) {
  const [bucket, setBucket] = useState<CaseBucket>("new");
  const tabs = [
    { count: grouped.newCases.length, label: "New", value: "new" as const },
    { count: grouped.progress.length, label: "In Progress", value: "progress" as const },
    { count: grouped.completed.length, label: "Completed", value: "completed" as const },
  ];
  const visibleReports =
    bucket === "new" ? grouped.newCases : bucket === "progress" ? grouped.progress : grouped.completed;

  return (
    <>
      <View style={styles.reportsHeader}>
        <Text style={styles.screenSectionTitle}>Reports</Text>
        <Pressable
          onPress={() => Alert.alert("Filters", "Filters can be expanded for distance, urgency, and animal type.")}
          style={({ pressed }) => [styles.filterButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <Ionicons name="options-outline" size={21} color={colors.charcoal} />
        </Pressable>
      </View>
      <View style={styles.agentTabs}>
        {tabs.map((tab) => {
          const selected = bucket === tab.value;

          return (
            <Pressable
              key={tab.value}
              onPress={() => setBucket(tab.value)}
              style={styles.agentTab}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.agentTabText, selected ? styles.agentTabTextSelected : null]}>
                {tab.label} ({tab.count})
              </Text>
              {selected ? <View style={styles.agentTabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>
      {loading ? null : visibleReports.length ? (
        <View style={styles.caseList}>
          {visibleReports.map((report, index) => (
            <CaseCard index={index} key={report.id} onPress={onOpen} report={report} />
          ))}
        </View>
      ) : (
        <EmptyCases
          label={
            bucket === "new"
              ? "No new assigned reports at the moment."
              : bucket === "progress"
                ? "Cases you start will move here."
                : "Closed field cases will appear here."
          }
        />
      )}
    </>
  );
}

function ReportDetailView({
  busy,
  onAccept,
  onBack,
  onNavigate,
  onUpdateStatus,
  report,
}: {
  busy: boolean;
  onAccept: () => void;
  onBack: () => void;
  onNavigate: () => void;
  onUpdateStatus: () => void;
  report: StrayAnimalReport;
}) {
  return (
    <>
      <TopBar
        action={<Ionicons name="ellipsis-vertical" size={23} color={colors.charcoal} />}
        back={onBack}
        title="Report Details"
      />
      <FadeInView style={styles.detailHero}>
        <View style={styles.detailMetaRow}>
          <StatusPill status={report.fieldStatus} />
          <Text style={styles.reportId}>Report ID: {formatReportId(report)}</Text>
        </View>
        <Text style={styles.detailTitle}>{getReportTitle(report)}</Text>
        <View style={styles.detailLocationRow}>
          <Ionicons name="location-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.detailLocation} numberOfLines={2}>
            {report.location}
          </Text>
        </View>
        <Text style={styles.reportedSmall}>Reported {formatRelativeTime(report.createdAt)}</Text>
        <Image source={getReportImage(report)} style={styles.detailImage} resizeMode="cover" />
      </FadeInView>
      <FadeInView delay={80} style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Description</Text>
        <Text style={styles.detailBody}>{report.description || "No description was provided."}</Text>
      </FadeInView>
      <FadeInView delay={120} style={styles.reporterCard}>
        <View>
          <Text style={styles.detailSectionTitle}>Reported by</Text>
          <View style={styles.reporterRow}>
            <View style={styles.reporterAvatar}>
              <Ionicons name="person-outline" size={21} color={colors.charcoal} />
            </View>
            <Text style={styles.reporterName}>{report.reporterName || "Anonymous reporter"}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => Alert.alert("Reporter contact", "Reporter contact details can be connected when phone numbers are stored for reports.")}
          style={({ pressed }) => [styles.callButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <Ionicons name="call-outline" size={22} color={AGENT_GREEN} />
        </Pressable>
      </FadeInView>
      <FadeInView delay={160} style={styles.actionBlock}>
        <Text style={styles.detailSectionTitle}>Actions</Text>
        <View style={styles.detailActionRow}>
          <Pressable
            onPress={onNavigate}
            style={({ pressed }) => [styles.outlineActionButton, styles.flexAction, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Ionicons name="navigate-outline" size={18} color={AGENT_GREEN} />
            <Text style={styles.outlineActionText}>Navigate</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={report.fieldStatus === "ASSIGNED" || report.fieldStatus === "UNASSIGNED" ? onAccept : onUpdateStatus}
            style={({ pressed }) => [styles.solidActionButton, styles.flexAction, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
            <Text style={styles.solidActionText}>
              {busy
                ? "Saving..."
                : report.fieldStatus === "ASSIGNED" || report.fieldStatus === "UNASSIGNED"
                  ? "Accept Case"
                  : "Update Status"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.actionHint}>
          Accepting a case starts your field response and sends an update to admin.
        </Text>
      </FadeInView>
    </>
  );
}

function StatusUpdateView({
  busy,
  onBack,
  onSubmit,
  report,
}: {
  busy: boolean;
  onBack: () => void;
  onSubmit: (choice: FieldStatusChoice, notes: string) => void;
  report: StrayAnimalReport;
}) {
  const [choice, setChoice] = useState<FieldStatusChoice>(statusChoices[1]);
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const addPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photos blocked", "Allow photo access to attach field images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
    });

    if (!result.canceled) {
      setPhotoUris((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
    }
  };

  return (
    <>
      <TopBar back={onBack} title="Update Status" />
      <FadeInView style={styles.currentStatusRow}>
        <Text style={styles.currentStatusLabel}>Current Status</Text>
        <StatusPill status={report.fieldStatus} />
      </FadeInView>
      <FadeInView delay={60} style={styles.updatePanel}>
        <Text style={styles.detailSectionTitle}>Update to</Text>
        <View style={styles.choiceList}>
          {statusChoices.map((item) => {
            const selected = choice.label === item.label;

            return (
              <Pressable
                key={item.label}
                onPress={() => setChoice(item)}
                style={({ pressed }) => [
                  styles.choiceRow,
                  selected ? styles.choiceRowSelected : null,
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <View style={styles.choiceIcon}>
                  <Ionicons name={item.icon} size={18} color={AGENT_GREEN} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceLabel}>{item.label}</Text>
                  <Text style={styles.choiceDetail}>{item.detail}</Text>
                </View>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={21}
                  color={selected ? AGENT_GREEN : colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      </FadeInView>
      <FadeInView delay={100} style={styles.notesPanel}>
        <Text style={styles.detailSectionTitle}>Add Notes</Text>
        <TextInput
          multiline
          onChangeText={setNotes}
          placeholder="Write any notes about the situation..."
          placeholderTextColor="#9AA6A0"
          style={styles.notesInput}
          textAlignVertical="top"
          value={notes}
        />
        <Text style={styles.noteCount}>{notes.length}/300</Text>
      </FadeInView>
      <FadeInView delay={140} style={styles.photosPanel}>
        <Text style={styles.detailSectionTitle}>Add Photos <Text style={styles.optionalText}>(Optional)</Text></Text>
        <View style={styles.photoRow}>
          {photoUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.updatePhoto} resizeMode="cover" />
          ))}
          <Pressable
            onPress={addPhotos}
            style={({ pressed }) => [styles.addPhotoButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={26} color={colors.charcoal} />
          </Pressable>
        </View>
      </FadeInView>
      <Pressable
        disabled={busy}
        onPress={() => onSubmit(choice, notes)}
        style={({ pressed }) => [styles.stickySubmitButton, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <Ionicons name="sync-outline" size={17} color={colors.white} />
        <Text style={styles.fullPrimaryButtonText}>{busy ? "Updating..." : "Update Status"}</Text>
      </Pressable>
    </>
  );
}

function NavigationView({
  onBack,
  report,
}: {
  onBack: () => void;
  report: StrayAnimalReport;
}) {
  return (
    <>
      <TopBar back={onBack} title="Navigate" />
      <FadeInView style={styles.mapPanel}>
        <View style={styles.fakeMap}>
          <View style={[styles.mapRoad, styles.mapRoadOne]} />
          <View style={[styles.mapRoad, styles.mapRoadTwo]} />
          <View style={[styles.mapRoad, styles.mapRoadThree]} />
          <View style={styles.routeLine} />
          <View style={styles.routeStart} />
          <View style={styles.routeEnd}>
            <Ionicons name="location" size={26} color="#E2533F" />
          </View>
          <Text style={[styles.mapLabel, styles.mapLabelOne]}>Main Road</Text>
          <Text style={[styles.mapLabel, styles.mapLabelTwo]}>Shelter Route</Text>
        </View>
        <View style={styles.navigateCard}>
          <Image source={getReportImage(report)} style={styles.navigateThumb} resizeMode="cover" />
          <View style={styles.navigateCopy}>
            <Text style={styles.caseTitle} numberOfLines={1}>
              {getReportTitle(report)}
            </Text>
            <View style={styles.caseMetaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.caseMetaText} numberOfLines={1}>
                {report.location}
              </Text>
            </View>
          </View>
          <View style={styles.compassButton}>
            <Ionicons name="navigate" size={21} color={AGENT_GREEN} />
          </View>
        </View>
        <View style={styles.etaPanel}>
          <Text style={styles.etaLabel}>ETA</Text>
          <Text style={styles.etaValue}>8 min <Text style={styles.etaDistance}>(2.4 km)</Text></Text>
        </View>
        <Pressable
          onPress={() => openMap(report)}
          style={({ pressed }) => [styles.fullPrimaryButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <Ionicons name="navigate" size={18} color={colors.white} />
          <Text style={styles.fullPrimaryButtonText}>Start Navigation</Text>
        </Pressable>
      </FadeInView>
    </>
  );
}

export function FieldAgentReportsScreen() {
  const { error, grouped, loadCases, loading, refreshing, reports, setReports, unreadNotifications } =
    useFieldAgentCases();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const [mode, setMode] = useState<ReportsViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId]
  );

  const openReport = (report: StrayAnimalReport) => {
    setSelectedId(report.id);
    setMode("detail");
  };

  useEffect(() => {
    if (!reportId) return;

    const report = reports.find((item) => item.id === reportId);
    if (report) {
      openReport(report);
      router.setParams({ reportId: "" });
    }
  }, [reportId, reports]);

  const applyUpdate = async (report: StrayAnimalReport, choice: FieldStatusChoice, notes = "") => {
    setBusy(true);

    try {
      const updatedReport = await updateCaseStatus(report, choice, notes);
      setReports((current) => current.map((item) => (item.id === updatedReport.id ? updatedReport : item)));
      setSelectedId(updatedReport.id);
      setMode("detail");
    } catch (e) {
      Alert.alert("Could not update case", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (selectedReport && mode === "detail") {
    return (
      <ScreenFrame>
        <ReportDetailView
          busy={busy}
          onAccept={() => void applyUpdate(selectedReport, statusChoices[0])}
          onBack={() => setMode("list")}
          onNavigate={() => setMode("navigate")}
          onUpdateStatus={() => setMode("update")}
          report={selectedReport}
        />
      </ScreenFrame>
    );
  }

  if (selectedReport && mode === "update") {
    return (
      <ScreenFrame>
        <StatusUpdateView
          busy={busy}
          onBack={() => setMode("detail")}
          onSubmit={(choice, notes) => void applyUpdate(selectedReport, choice, notes)}
          report={selectedReport}
        />
      </ScreenFrame>
    );
  }

  if (selectedReport && mode === "navigate") {
    return (
      <ScreenFrame>
        <NavigationView onBack={() => setMode("detail")} report={selectedReport} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadCases(true)}
          tintColor={AGENT_GREEN}
        />
      }
    >
      <TopBar notificationCount={unreadNotifications} title="" />
      <View style={styles.agentGreetingCompact}>
        <Text style={styles.greetingKicker}>Good morning,</Text>
        <Text style={styles.greetingName}>Field Agent</Text>
      </View>
      <View style={styles.statRow}>
        <FadeInView style={[styles.agentStatCard, styles.agentStatCardPrimary]}>
          <Text style={styles.agentStatValuePrimary}>{grouped.newCases.length}</Text>
          <Text style={styles.agentStatLabelPrimary}>New Reports</Text>
        </FadeInView>
        <FadeInView delay={60} style={styles.agentStatCard}>
          <Text style={styles.agentStatValue}>{grouped.progress.length}</Text>
          <Text style={styles.agentStatLabel}>In Progress</Text>
        </FadeInView>
        <FadeInView delay={100} style={styles.agentStatCard}>
          <Text style={styles.agentStatValue}>{grouped.completed.length}</Text>
          <Text style={styles.agentStatLabel}>Completed</Text>
        </FadeInView>
      </View>
      <StatePanel error={error} loading={loading} onRetry={() => void loadCases(false)} />
      {!error ? <AgentReportsList grouped={grouped} loading={loading} onOpen={openReport} /> : null}
    </ScreenFrame>
  );
}

export function FieldAgentMapScreen() {
  const { error, grouped, loadCases, loading, refreshing } = useFieldAgentCases();
  const activeReport = grouped.progress[0] ?? grouped.newCases[0] ?? grouped.completed[0] ?? null;

  return (
    <ScreenFrame
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadCases(true)}
          tintColor={AGENT_GREEN}
        />
      }
    >
      <StatePanel error={error} loading={loading} onRetry={() => void loadCases(false)} />
      {!loading && !error && activeReport ? (
        <NavigationView onBack={() => router.push("/(tabs)/chat")} report={activeReport} />
      ) : !loading && !error ? (
        <EmptyCases label="No mapped cases yet. Assigned reports will appear here." />
      ) : null}
    </ScreenFrame>
  );
}

export function FieldAgentQuickActionScreen() {
  const { grouped, loadCases, loading, reports } = useFieldAgentCases();
  const nextCase = grouped.progress[0] ?? grouped.newCases[0] ?? null;

  const actions = [
    {
      body: "Open your assigned reports and start the next rescue step.",
      icon: "document-text-outline" as const,
      onPress: () => router.push("/(tabs)/chat"),
      title: "View Reports",
    },
    {
      body: nextCase ? getReportTitle(nextCase) : "No active case right now.",
      icon: "sync-outline" as const,
      onPress: () => router.push("/(tabs)/chat"),
      title: "Update Current Case",
    },
    {
      body: "Open the route view for the next assigned case.",
      icon: "navigate-outline" as const,
      onPress: () => router.push("/(tabs)/surrender" as Parameters<typeof router.push>[0]),
      title: "Navigate",
    },
    {
      body: `${reports.length} assigned case${reports.length === 1 ? "" : "s"} in your queue.`,
      icon: "refresh-outline" as const,
      onPress: () => void loadCases(true),
      title: "Refresh Queue",
    },
  ];

  return (
    <ScreenFrame>
      <TopBar title="Quick Actions" />
      <FadeInView style={styles.quickHero}>
        <View style={styles.quickPlus}>
          <Ionicons name="add" size={34} color={colors.white} />
        </View>
        <Text style={styles.quickTitle}>Field action centre</Text>
        <Text style={styles.quickBody}>
          Jump into the next case, update admin, or open navigation from one place.
        </Text>
      </FadeInView>
      {loading ? <ActivityIndicator color={AGENT_GREEN} /> : null}
      <View style={styles.quickList}>
        {actions.map((action, index) => (
          <FadeInView delay={index * 60} key={action.title}>
            <Pressable
              onPress={action.onPress}
              style={({ pressed }) => [styles.profileRow, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <View style={styles.profileIcon}>
                <Ionicons name={action.icon} size={22} color={AGENT_GREEN} />
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileRowTitle}>{action.title}</Text>
                <Text style={styles.profileRowBody} numberOfLines={1}>
                  {action.body}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          </FadeInView>
        ))}
      </View>
    </ScreenFrame>
  );
}

export function FieldAgentProfileScreen() {
  const { grouped, reports, user } = useFieldAgentCases();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const options = [
    {
      body: "View your activity and performance",
      icon: "navigate-outline" as const,
      title: "My Stats",
    },
    {
      body: "View all reports you have handled",
      icon: "clipboard-outline" as const,
      title: "Reports History",
    },
    {
      body: "Important contacts and helplines",
      icon: "people-outline" as const,
      title: "NGO / Shelter Contacts",
    },
    {
      body: "FAQs and support",
      icon: "help-circle-outline" as const,
      title: "Help & Support",
    },
  ];

  const confirmLogout = () => {
    Alert.alert("Logout", "End this field-agent session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, vs(14)) + vs(90),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TopBar
          action={<Ionicons name="settings-outline" size={24} color={colors.charcoal} />}
          title="Profile"
        />
        <FadeInView style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Image
              source={require("../../assets/fieldagent/Field-agent avatar.png")}
              style={styles.profileAvatarImage}
              resizeMode="cover"
            />
            <View style={styles.profileEditBadge}>
              <Ionicons name="pencil" size={13} color={colors.white} />
            </View>
          </View>
          <Text style={styles.profileName}>{user?.fullName || "Field Agent"}</Text>
          <Text style={styles.profileRole}>Field Agent</Text>
          <View style={styles.profileIdBadge}>
            <Text style={styles.profileIdText}>ID: FA-{String(user?.id?.length || 2567).padStart(4, "0").slice(0, 4)}</Text>
          </View>
        </FadeInView>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{reports.length}</Text>
            <Text style={styles.profileStatLabel}>Assigned</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{grouped.progress.length}</Text>
            <Text style={styles.profileStatLabel}>Active</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{grouped.completed.length}</Text>
            <Text style={styles.profileStatLabel}>Completed</Text>
          </View>
        </View>
        <View style={styles.profileList}>
          {options.map((option, index) => (
            <FadeInView delay={index * 55} key={option.title}>
              <Pressable
                onPress={() => Alert.alert(option.title, "This section is ready for the next field-agent endpoint.")}
                style={({ pressed }) => [styles.profileRow, pressed ? styles.pressed : null]}
                accessibilityRole="button"
              >
                <View style={styles.profileIcon}>
                  <Ionicons name={option.icon} size={22} color={colors.charcoal} />
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileRowTitle}>{option.title}</Text>
                  <Text style={styles.profileRowBody}>{option.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            </FadeInView>
          ))}
        </View>
        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logoutButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <Ionicons name="log-out-outline" size={22} color={AGENT_RED} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const LOGO_SIZE = clamp(screen.height * 0.14, 88, 126);

const styles = StyleSheet.create({
  actionBlock: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: vs(12),
    paddingTop: vs(14),
  },
  actionHint: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(17),
    textAlign: "center",
  },
  addPhotoButton: {
    alignItems: "center",
    backgroundColor: "#F1F4F1",
    borderColor: colors.border,
    borderRadius: rs(12),
    borderWidth: 1,
    height: rs(68),
    justifyContent: "center",
    width: rs(76),
  },
  agentGreeting: {
    marginBottom: vs(14),
    marginTop: vs(-6),
    paddingHorizontal: rs(4),
  },
  agentGreetingCompact: {
    marginBottom: vs(10),
    paddingHorizontal: rs(4),
  },
  agentStatCard: {
    backgroundColor: AGENT_MINT,
    borderRadius: rs(10),
    flex: 1,
    minHeight: vs(76),
    paddingHorizontal: rs(12),
    paddingVertical: vs(12),
  },
  agentStatCardPrimary: {
    backgroundColor: AGENT_GREEN,
    shadowColor: CARD_SHADOW,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  agentStatLabel: {
    color: colors.charcoal,
    fontSize: ms(11),
    fontWeight: "700",
    marginTop: vs(4),
  },
  agentStatLabelPrimary: {
    color: colors.white,
    fontSize: ms(11),
    fontWeight: "800",
    marginTop: vs(4),
  },
  agentStatValue: {
    color: colors.charcoal,
    fontSize: ms(27),
    fontWeight: "900",
  },
  agentStatValuePrimary: {
    color: colors.white,
    fontSize: ms(27),
    fontWeight: "900",
  },
  agentTab: {
    alignItems: "center",
    flex: 1,
    gap: vs(8),
    paddingTop: vs(10),
  },
  agentTabText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "800",
  },
  agentTabTextSelected: {
    color: AGENT_GREEN,
  },
  agentTabUnderline: {
    backgroundColor: AGENT_GREEN,
    borderRadius: 999,
    height: 2,
    width: "76%",
  },
  agentTabs: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    marginBottom: vs(12),
  },
  bellDot: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: 999,
    height: rs(18),
    justifyContent: "center",
    position: "absolute",
    right: rs(1),
    top: rs(1),
    width: rs(18),
  },
  bellDotText: {
    color: colors.white,
    fontSize: ms(10),
    fontWeight: "900",
  },
  bellWrap: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  callButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: rs(44),
    justifyContent: "center",
    width: rs(44),
  },
  caseCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#E0E8E2",
    borderRadius: rs(12),
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(10),
    padding: rs(9),
    shadowColor: CARD_SHADOW,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  caseCopy: {
    flex: 1,
    minWidth: 0,
  },
  caseList: {
    paddingTop: vs(2),
  },
  caseMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(4),
    marginTop: vs(4),
  },
  caseMetaText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "600",
  },
  caseThumb: {
    borderRadius: rs(9),
    height: rs(64),
    width: rs(76),
  },
  caseTime: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    marginTop: vs(4),
  },
  caseTitle: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "900",
  },
  choiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  choiceDetail: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    marginTop: vs(2),
  },
  choiceIcon: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN_SOFT,
    borderRadius: rs(9),
    height: rs(34),
    justifyContent: "center",
    width: rs(34),
  },
  choiceLabel: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
  },
  choiceList: {
    borderColor: colors.border,
    borderRadius: rs(12),
    borderWidth: 1,
    overflow: "hidden",
  },
  choiceRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: rs(10),
    padding: rs(10),
  },
  choiceRowSelected: {
    backgroundColor: "#F2F8F2",
  },
  compassButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: rs(46),
    justifyContent: "center",
    width: rs(46),
  },
  content: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(108),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(6),
    width: "100%",
  },
  currentStatusLabel: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
  },
  currentStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(14),
  },
  detailActionRow: {
    flexDirection: "row",
    gap: rs(10),
  },
  detailBody: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "600",
    lineHeight: ms(21),
  },
  detailHero: {
    gap: vs(9),
  },
  detailImage: {
    borderRadius: rs(12),
    height: clamp(screen.height * 0.28, 210, 300),
    width: "100%",
  },
  detailLocation: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "600",
  },
  detailLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(5),
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: vs(6),
    paddingBottom: vs(14),
    paddingTop: vs(14),
  },
  detailSectionTitle: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
  },
  detailTitle: {
    color: colors.charcoal,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
  },
  emptyCases: {
    alignItems: "center",
    backgroundColor: AGENT_MINT,
    borderColor: "#DDE8D8",
    borderRadius: rs(16),
    borderWidth: 1,
    marginTop: vs(12),
    padding: rs(22),
  },
  emptyCasesText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(5),
    textAlign: "center",
  },
  emptyCasesTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    marginTop: vs(8),
  },
  etaDistance: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  etaLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
  },
  etaPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(12),
    borderWidth: 1,
    gap: vs(6),
    padding: rs(14),
  },
  etaValue: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
  },
  fakeMap: {
    backgroundColor: "#E8F1E6",
    borderRadius: rs(12),
    height: clamp(screen.height * 0.38, 270, 360),
    overflow: "hidden",
    position: "relative",
  },
  featureIcon: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN_SOFT,
    borderRadius: rs(10),
    height: rs(34),
    justifyContent: "center",
    width: rs(34),
  },
  featureList: {
    gap: vs(8),
    marginBottom: vs(12),
    width: "100%",
  },
  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
  },
  featureText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
  },
  filterButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  flexAction: {
    flex: 1,
  },
  fullPrimaryButton: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: rs(14),
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(44),
    paddingHorizontal: rs(16),
  },
  fullPrimaryButtonText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
  greetingKicker: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
  },
  greetingName: {
    color: colors.charcoal,
    fontSize: ms(19),
    fontWeight: "900",
    marginTop: vs(2),
  },
  homeSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: vs(20),
  },
  iconButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  introBadge: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: rs(19),
    height: rs(72),
    justifyContent: "center",
    marginTop: vs(8),
    width: rs(72),
  },
  introCard: {
    alignItems: "center",
    backgroundColor: "#DCE9F0",
    borderRadius: rs(22),
    flex: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    minHeight: 0,
    overflow: "hidden",
    shadowColor: CARD_SHADOW,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    width: "100%",
  },
  introBackgroundImage: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  introContent: {
    backgroundColor: "rgba(246, 249, 241, 0.78)",
    borderRadius: rs(18),
    margin: rs(16),
    marginTop: "auto",
    paddingHorizontal: rs(16),
    paddingVertical: vs(16),
    width: "92%",
  },
  introImageShade: {
    backgroundColor: "rgba(17, 55, 77, 0.08)",
    ...StyleSheet.absoluteFill,
  },
  introSafeArea: {
    backgroundColor: colors.white,
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: vs(10),
  },
  introSubtitle: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "700",
    marginTop: vs(6),
  },
  introWelcome: {
    color: AGENT_GREEN_DARK,
    fontSize: ms(17),
    fontWeight: "800",
    marginBottom: vs(14),
    marginTop: vs(4),
  },
  introTitle: {
    color: AGENT_GREEN_DARK,
    fontSize: ms(25),
    fontWeight: "900",
    marginTop: vs(2),
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#F1D6D4",
    borderRadius: rs(12),
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    justifyContent: "center",
    marginTop: vs(16),
    minHeight: vs(52),
  },
  logoutText: {
    color: AGENT_RED,
    fontSize: ms(14),
    fontWeight: "900",
  },
  mapLabel: {
    color: "#9BA9A0",
    fontSize: ms(10),
    fontWeight: "800",
    position: "absolute",
  },
  mapLabelOne: {
    left: "22%",
    top: "18%",
    transform: [{ rotate: "-28deg" }],
  },
  mapLabelTwo: {
    right: "18%",
    top: "34%",
    transform: [{ rotate: "20deg" }],
  },
  mapPanel: {
    gap: vs(12),
  },
  mapRoad: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderRadius: 999,
    height: 8,
    position: "absolute",
    width: "120%",
  },
  mapRoadOne: {
    left: "-18%",
    top: "20%",
    transform: [{ rotate: "-28deg" }],
  },
  mapRoadThree: {
    left: "-6%",
    top: "66%",
    transform: [{ rotate: "17deg" }],
  },
  mapRoadTwo: {
    right: "-20%",
    top: "47%",
    transform: [{ rotate: "32deg" }],
  },
  navigateCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(14),
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    padding: rs(10),
  },
  navigateCopy: {
    flex: 1,
    minWidth: 0,
  },
  navigateThumb: {
    borderRadius: rs(9),
    height: rs(58),
    width: rs(62),
  },
  noteCount: {
    alignSelf: "flex-end",
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "700",
    marginTop: vs(-18),
    paddingRight: rs(10),
  },
  notesInput: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(12),
    borderWidth: 1,
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "600",
    minHeight: vs(96),
    padding: rs(12),
  },
  notesPanel: {
    gap: vs(8),
    marginTop: vs(14),
  },
  optionalText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  outlineActionButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: AGENT_GREEN,
    borderRadius: rs(10),
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    minHeight: vs(46),
    paddingHorizontal: rs(14),
  },
  outlineActionText: {
    color: AGENT_GREEN,
    fontSize: ms(13),
    fontWeight: "900",
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
  },
  photosPanel: {
    gap: vs(8),
    marginTop: vs(14),
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  priorityActions: {
    flexDirection: "row",
    gap: rs(10),
    marginTop: vs(12),
  },
  priorityCard: {
    backgroundColor: colors.white,
    borderColor: "#DDE8D8",
    borderRadius: rs(16),
    borderWidth: 1,
    gap: vs(10),
    padding: rs(12),
    shadowColor: CARD_SHADOW,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 22,
  },
  priorityHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: rs(10),
    justifyContent: "space-between",
  },
  priorityImage: {
    borderRadius: rs(12),
    height: clamp(screen.height * 0.2, 150, 220),
    width: "100%",
  },
  priorityTitle: {
    color: colors.charcoal,
    fontSize: ms(17),
    fontWeight: "900",
    maxWidth: rs(220),
  },
  profileAvatar: {
    position: "relative",
  },
  profileAvatarImage: {
    borderRadius: 999,
    height: rs(82),
    width: rs(82),
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileEditBadge: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderColor: colors.white,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 0,
    height: rs(26),
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: rs(26),
  },
  profileHeader: {
    alignItems: "center",
    paddingBottom: vs(18),
    paddingTop: vs(12),
  },
  profileIcon: {
    alignItems: "center",
    height: rs(36),
    justifyContent: "center",
    width: rs(36),
  },
  profileIdBadge: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(9),
    borderWidth: 1,
    marginTop: vs(8),
    paddingHorizontal: rs(12),
    paddingVertical: vs(5),
  },
  profileIdText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "800",
  },
  profileList: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(14),
    borderWidth: 1,
    overflow: "hidden",
  },
  profileName: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    marginTop: vs(12),
  },
  profileRole: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "700",
    marginTop: vs(3),
  },
  profileRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(62),
    paddingHorizontal: rs(12),
  },
  profileRowBody: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    marginTop: vs(2),
  },
  profileRowTitle: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
  },
  profileStat: {
    alignItems: "center",
    flex: 1,
  },
  profileStatLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    marginTop: vs(2),
  },
  profileStatValue: {
    color: AGENT_GREEN,
    fontSize: ms(18),
    fontWeight: "900",
  },
  profileStats: {
    backgroundColor: AGENT_MINT,
    borderColor: "#DDE8D8",
    borderRadius: rs(14),
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: vs(14),
    paddingVertical: vs(12),
  },
  quickBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    maxWidth: rs(260),
    textAlign: "center",
  },
  quickHero: {
    alignItems: "center",
    backgroundColor: AGENT_MINT,
    borderColor: "#DDE8D8",
    borderRadius: rs(18),
    borderWidth: 1,
    gap: vs(8),
    marginBottom: vs(14),
    padding: rs(22),
  },
  quickList: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: rs(14),
    borderWidth: 1,
    overflow: "hidden",
  },
  quickPlus: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: 999,
    height: rs(68),
    justifyContent: "center",
    marginBottom: vs(4),
    width: rs(68),
  },
  quickTitle: {
    color: colors.charcoal,
    fontSize: ms(21),
    fontWeight: "900",
  },
  reportedSmall: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
  },
  reporterAvatar: {
    alignItems: "center",
    backgroundColor: AGENT_MINT,
    borderRadius: 999,
    height: rs(44),
    justifyContent: "center",
    width: rs(44),
  },
  reporterCard: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: vs(14),
    paddingTop: vs(14),
  },
  reporterName: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "800",
  },
  reporterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
    marginTop: vs(10),
  },
  reportId: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
  },
  reportsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: vs(12),
  },
  routeEnd: {
    bottom: "19%",
    position: "absolute",
    right: "18%",
  },
  routeLine: {
    backgroundColor: AGENT_GREEN,
    borderRadius: 999,
    height: 7,
    left: "18%",
    position: "absolute",
    top: "48%",
    transform: [{ rotate: "18deg" }],
    width: "56%",
  },
  routeStart: {
    backgroundColor: "#2F80ED",
    borderColor: colors.white,
    borderRadius: 999,
    borderWidth: 3,
    height: rs(20),
    left: "16%",
    position: "absolute",
    top: "35%",
    width: rs(20),
  },
  safeArea: {
    backgroundColor: colors.white,
    flex: 1,
  },
  screenSectionTitle: {
    color: colors.charcoal,
    fontSize: ms(19),
    fontWeight: "900",
  },
  secondaryButton: {
    borderColor: AGENT_GREEN,
    borderRadius: rs(10),
    borderWidth: 1,
    marginTop: vs(10),
    paddingHorizontal: rs(18),
    paddingVertical: vs(9),
  },
  secondaryButtonText: {
    color: AGENT_GREEN,
    fontSize: ms(13),
    fontWeight: "900",
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "900",
    marginBottom: vs(3),
    textTransform: "uppercase",
  },
  solidActionButton: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: rs(10),
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    minHeight: vs(46),
    paddingHorizontal: rs(14),
  },
  solidActionText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  statRow: {
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(18),
  },
  stateBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(4),
    textAlign: "center",
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: AGENT_MINT,
    borderColor: "#DDE8D8",
    borderRadius: rs(16),
    borderWidth: 1,
    marginTop: vs(12),
    padding: rs(22),
  },
  stateTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    marginTop: vs(8),
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: rs(9),
    paddingVertical: vs(6),
  },
  statusPillText: {
    fontSize: ms(11),
    fontWeight: "900",
  },
  stickySubmitButton: {
    alignItems: "center",
    backgroundColor: AGENT_GREEN,
    borderRadius: rs(12),
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    marginTop: vs(18),
    minHeight: vs(52),
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: vs(50),
  },
  topBarTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(17),
    fontWeight: "900",
    textAlign: "center",
  },
  updatePanel: {
    gap: vs(9),
  },
  updatePhoto: {
    borderRadius: rs(11),
    height: rs(68),
    width: rs(76),
  },
  logo: {
      alignSelf: "center",
      height: clamp(LOGO_SIZE * 1.16, 104, 148),
      marginBottom: 0,
      width: clamp(LOGO_SIZE * 1.16, 104, 148),
    },
    emptyNotifications: {
      alignItems: "center",
      paddingHorizontal: rs(28),
      paddingTop: vs(72),
    },
    emptyNotificationsBody: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      marginTop: vs(6),
      textAlign: "center",
    },
    emptyNotificationsTitle: {
      color: colors.charcoal,
      fontSize: ms(17),
      fontWeight: "900",
      marginTop: vs(12),
    },
    introBellButton: {
      alignItems: "center",
      backgroundColor: AGENT_GREEN,
      borderRadius: 999,
      height: TOUCH_TARGET,
      justifyContent: "center",
      position: "absolute",
      right: rs(10),
      top: vs(10),
      width: TOUCH_TARGET,
    },
    introTopRow: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: vs(18),
      position: "relative",
      width: "100%",
    },
    markAllButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: rs(6),
      marginHorizontal: PAGE_PADDING,
      marginTop: vs(12),
      paddingHorizontal: rs(4),
      paddingVertical: vs(8),
    },
    markAllButtonText: {
      color: AGENT_GREEN,
      fontSize: ms(13),
      fontWeight: "900",
    },
    notificationBody: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      marginTop: vs(3),
    },
    notificationCopy: {
      flex: 1,
    },
    notificationHeader: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: vs(14),
      paddingHorizontal: PAGE_PADDING,
      paddingTop: vs(8),
    },
    notificationIcon: {
      alignItems: "center",
      backgroundColor: AGENT_GREEN_SOFT,
      borderRadius: 999,
      height: rs(40),
      justifyContent: "center",
      width: rs(40),
    },
    notificationItem: {
      alignItems: "flex-start",
      backgroundColor: colors.white,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: rs(11),
      paddingHorizontal: PAGE_PADDING,
      paddingVertical: vs(15),
    },
    notificationItemHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: rs(8),
    },
    notificationItemTitle: {
      color: colors.charcoal,
      flex: 1,
      fontSize: ms(14),
      fontWeight: "900",
    },
    notificationItemUnread: {
      backgroundColor: "#F2FAF0",
    },
    notificationLink: {
      color: AGENT_GREEN,
      fontSize: ms(12),
      fontWeight: "900",
      marginTop: vs(7),
    },
    notificationList: {
      paddingBottom: vs(32),
    },
    notificationSafeArea: {
      backgroundColor: colors.white,
      flex: 1,
    },
    notificationSubtitle: {
      color: colors.textSecondary,
      fontSize: ms(13),
      marginTop: vs(2),
    },
    notificationTime: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontWeight: "700",
    },
    notificationTitle: {
      color: colors.charcoal,
      fontSize: ms(22),
      fontWeight: "900",
    },
    unreadIndicator: {
      backgroundColor: AGENT_GREEN,
      borderRadius: 999,
      height: rs(8),
      marginTop: vs(6),
      width: rs(8),
    },
    topBarActionSpacer: {
      height: TOUCH_TARGET,
      width: TOUCH_TARGET,
    },
});
