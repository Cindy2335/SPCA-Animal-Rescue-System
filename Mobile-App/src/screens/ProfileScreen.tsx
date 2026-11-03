import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  getAnimalSurrenderRequests,
  getStrayAnimalReports,
  type AnimalSurrenderRequest,
  type StrayAnimalReport,
} from "../services/api";
import colors from "../theme/colors";
import {
  CONTENT_MAX_WIDTH,
  ms,
  PAGE_PADDING,
  rs,
  vs,
} from "../theme/responsive";

type AccountAction = {
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  destructive?: boolean;
  onPress: () => void;
};

function formatJoinedDate(value?: string) {
  if (!value) {
    return "Guest session";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently joined";
  }

  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function showFeatureNotice(title: string, body: string) {
  Alert.alert(title, body);
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [myReports, setMyReports] = useState<StrayAnimalReport[]>([]);
  const [mySurrenders, setMySurrenders] = useState<AnimalSurrenderRequest[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadMyReports() {
        if (!user?.id) {
          setMyReports([]);
          setMySurrenders([]);
          setReportsError(null);
          return;
        }

        try {
          const [reports, surrenders] = await Promise.all([
            getStrayAnimalReports({ reporterId: user.id }),
            getAnimalSurrenderRequests({ ownerId: user.id }),
          ]);

          if (!cancelled) {
            setMyReports(reports);
            setMySurrenders(surrenders);
            setReportsError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setReportsError(e instanceof Error ? e.message : "Could not load report stats");
          }
        }
      }

      void loadMyReports();

      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  const joinedDate = useMemo(() => formatJoinedDate(user?.createdAt), [user?.createdAt]);
  const openReports = myReports.filter((report) => report.status !== "RESOLVED").length;
  const openSurrenders = mySurrenders.filter((request) => request.status !== "COMPLETED").length;

  const confirmLogout = () => {
    Alert.alert("Sign out", "End this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: logout,
      },
    ]);
  };

  const accountOptions: AccountAction[] = [
    {
      title: "Profile",
      subtitle: user
        ? "View and manage your saved account details"
        : "Sign in to save reports and contact details",
      icon: "person-outline",
      onPress: () =>
        showFeatureNotice(
          "Profile",
          "Profile editing is ready for the next account-details endpoint."
        ),
    },
    {
      title: "Settings",
      subtitle: "Notifications, privacy, and app preferences",
      icon: "settings-outline",
      onPress: () =>
        showFeatureNotice(
          "Settings",
          "Notification and privacy settings can be connected once preferences are stored."
        ),
    },
    {
      title: "My reports",
      subtitle: "Track sightings you submitted or followed",
      icon: "file-tray-full-outline",
      onPress: () => router.push("/(tabs)/chat"),
    },
    {
      title: "Saved animals",
      subtitle: "Keep adoption matches you want to revisit",
      icon: "heart-outline",
      onPress: () => router.push("/adoption"),
    },
    {
      title: "Donation history",
      subtitle: "Receipts and pledges when checkout is connected",
      icon: "receipt-outline",
      onPress: () => router.push("/donations"),
    },
  ];

  const welfareOptions: AccountAction[] = [
    {
      title: "Report a stray",
      subtitle: "Send location and sighting notes",
      icon: "paw-outline",
      onPress: () => router.push("/report-stray"),
    },
    {
      title: "Surrender an animal",
      subtitle: "Request intake help for a pet you can no longer keep",
      icon: "home-outline",
      onPress: () => router.push("/(tabs)/surrender" as Parameters<typeof router.push>[0]),
    },
    {
      title: "Adoption centre",
      subtitle: "Browse animals waiting for homes",
      icon: "heart-outline",
      onPress: () => router.push("/adoption"),
    },
    {
      title: "Report cruelty",
      subtitle: "Prepare a case intake with clear details",
      icon: "warning-outline",
      onPress: () => router.push("/report-cruelty"),
    },
    {
      title: "Donate",
      subtitle: "Support food, medical care, and transport",
      icon: "gift-outline",
      onPress: () => router.push("/donations"),
    },
    {
      title: "Help and support",
      subtitle: "Choose the right next step for animal welfare help",
      icon: "help-buoy-outline",
      onPress: () => router.push("/modal"),
    },
    {
      title: "Emergency contacts",
      subtitle: "Local urgent-care numbers and escalation notes",
      icon: "call-outline",
      onPress: () =>
        showFeatureNotice(
          "Emergency contacts",
          "Emergency contact directories can be added here for local welfare teams and after-hours help."
        ),
    },
  ];

  const sessionOptions: AccountAction[] = user
    ? [
        {
          title: "Sign out",
          subtitle: "End this session on this device",
          icon: "log-out-outline",
          destructive: true,
          onPress: confirmLogout,
        },
      ]
    : [
        {
          title: "Sign in",
          subtitle: "Access saved reports and contact details",
          icon: "log-in-outline",
          onPress: () => router.push("/login"),
        },
        {
          title: "Register",
          subtitle: "Create an account to save reports",
          icon: "person-add-outline",
          onPress: () => router.push("/register"),
        },
      ];

  const renderActionRows = (actions: AccountAction[]) =>
    actions.map((action, index) => (
      <View key={action.title}>
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.actionRow, pressed ? styles.pressed : null]}
          accessibilityRole="button"
        >
          <View style={styles.actionIcon}>
            <Ionicons
              name={action.icon}
              size={25}
              color={action.destructive ? colors.danger : colors.textSecondary}
            />
          </View>
          <View style={styles.actionCopy}>
            <Text
              style={[styles.actionTitle, action.destructive ? styles.destructiveText : null]}
              numberOfLines={1}
            >
              {action.title}
            </Text>
            <Text style={styles.actionSubtitle} numberOfLines={2}>
              {action.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={23} color={colors.muted} />
        </Pressable>
        {index < actions.length - 1 ? <View style={styles.rowDivider} /> : null}
      </View>
    ));

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.identityPanel, { paddingTop: insets.top + vs(18) }]}>
          <View style={styles.identityTop}>
            <View style={styles.logoFrame}>
              <Image source={require("../../assets/logo.png")} style={styles.logo} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name} numberOfLines={2}>
                {user?.fullName ?? "Animal welfare helper"}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email ?? "Create an account to save reports"}
              </Text>
            </View>
          </View>

          <View style={styles.innerDivider} />

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>{joinedDate}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              <Text style={styles.detailText}>{user ? "Reporter account" : "Limited access"}</Text>
            </View>
          </View>

          <View style={styles.innerDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{myReports.length}</Text>
              <Text style={styles.statLabel}>reports</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{openReports}</Text>
              <Text style={styles.statLabel}>open</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{openSurrenders}</Text>
              <Text style={styles.statLabel}>intake</Text>
            </View>
          </View>
        </View>


        {reportsError ? (
          <View style={styles.noticePanel}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.noticeText}>{reportsError}</Text>
          </View>
        ) : null}
        <View style={styles.groupPanel}>{renderActionRows(accountOptions)}</View>

        <View style={styles.groupPanel}>{renderActionRows(welfareOptions)}</View>

        <View style={[styles.groupPanel, styles.bottomGroupPanel]}>
          {renderActionRows(sessionOptions)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.lightgray,
    flex: 1,
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    width: "100%",
  },
  identityPanel: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: vs(8),
    minHeight: vs(248),
    paddingBottom: vs(22),
    paddingHorizontal: rs(22),
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  identityTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(14),
  },
  logoFrame: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(68),
    justifyContent: "center",
    width: rs(68),
  },
  logo: {
    height: rs(48),
    width: rs(48),
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.charcoal,
    fontSize: ms(25),
    fontWeight: "900",
    lineHeight: ms(31),
  },
  email: {
    color: colors.textSecondary,
    fontSize: ms(14),
    fontWeight: "600",
    lineHeight: ms(20),
    marginTop: vs(3),
  },
  innerDivider: {
    backgroundColor: "rgba(82, 96, 109, 0.2)",
    height: 1,
    marginVertical: vs(16),
    width: "100%",
  },
  detailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(12),
  },
  detailItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(7),
    minHeight: vs(28),
    paddingRight: rs(8),
  },
  detailText: {
    color: colors.text,
    fontSize: ms(13),
    fontWeight: "800",
  },
  statsRow: {
    flexDirection: "row",
    paddingTop: vs(1),
  },
  statTile: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  statDivider: {
    alignSelf: "stretch",
    backgroundColor: "rgba(82, 96, 109, 0.18)",
    marginVertical: vs(4),
    width: 1,
  },
  statValue: {
    color: colors.charcoal,
    fontSize: ms(25),
    fontWeight: "900",
    lineHeight: ms(29),
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "800",
    marginTop: vs(3),
  },
  sectionHeader: {
    marginBottom: vs(8),
    paddingHorizontal: PAGE_PADDING,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: ms(17),
    fontWeight: "900",
    lineHeight: ms(22),
  },
  groupPanel: {
    backgroundColor: colors.white,
    borderRadius: 24,
    marginBottom: vs(8),
    overflow: "hidden",
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  bottomGroupPanel: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    flexGrow: 1,
    justifyContent: "flex-start",
    marginBottom: 0,
    minHeight: vs(140),
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(15),
    minHeight: vs(78),
    paddingHorizontal: rs(22),
    paddingVertical: vs(13),
  },
  actionIcon: {
    alignItems: "center",
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "700",
    lineHeight: ms(23),
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(14),
    fontWeight: "500",
    lineHeight: ms(19),
    marginTop: vs(2),
  },
  rowDivider: {
    backgroundColor: "rgba(82, 96, 109, 0.2)",
    height: 1,
    marginLeft: rs(79),
    marginRight: rs(22),
  },
  noticePanel: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: 18,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(16),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
  },
  noticeText: {
    color: colors.warning,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
  },
  destructiveText: {
    color: colors.danger,
  },
  pressed: {
    opacity: 0.72,
  },
});
