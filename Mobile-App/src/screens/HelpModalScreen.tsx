import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import colors from "../theme/colors";
import { CONTENT_MAX_WIDTH, ms, PAGE_PADDING, rs, TOUCH_TARGET, vs } from "../theme/responsive";

type HelpAction = {
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  tone: "primary" | "success" | "danger";
  onPress: () => void;
};

function getToneStyle(tone: HelpAction["tone"]): ViewStyle {
  if (tone === "success") {
    return styles.successIcon;
  }

  if (tone === "danger") {
    return styles.dangerIcon;
  }

  return styles.primaryIcon;
}

function getToneColor(tone: HelpAction["tone"]) {
  if (tone === "success") {
    return colors.accent;
  }

  if (tone === "danger") {
    return colors.warning;
  }

  return colors.primaryDark;
}

export default function HelpModalScreen() {
  const actions: HelpAction[] = [
    {
      title: "Stray sighting",
      subtitle: "Create a report with location and condition notes.",
      icon: "paw-outline",
      tone: "primary",
      onPress: () => router.push("/report-stray"),
    },
    {
      title: "Adoption enquiry",
      subtitle: "Open the animal list and choose a match.",
      icon: "heart-outline",
      tone: "success",
      onPress: () => router.push("/adoption"),
    },
    {
      title: "Urgent cruelty case",
      subtitle: "Flag the workflow while the emergency handoff is wired in.",
      icon: "warning-outline",
      tone: "danger",
      onPress: () => router.push("/report-cruelty"),
    },
    {
      title: "Donate to care",
      subtitle: "Prepare food, transport, and medical support.",
      icon: "gift-outline",
      tone: "success",
      onPress: () => router.push("/donations"),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Help desk</Text>
            <Text style={styles.title}>Choose a next step</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>

        <View style={styles.actionList}>
          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={action.onPress}
              style={({ pressed }) => [styles.actionItem, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <View style={[styles.actionIcon, getToneStyle(action.tone)]}>
                <Ionicons name={action.icon} size={22} color={getToneColor(action.tone)} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        <View style={styles.infoPanel}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Response-ready front end</Text>
            <Text style={styles.infoBody}>
              These entry points are prepared for shelter routing, contact directories, and emergency
              escalation when those services are connected.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    alignSelf: "center",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(8),
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 8,
    height: vs(5),
    marginBottom: vs(18),
    width: rs(52),
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(18),
  },
  eyebrow: {
    color: colors.muted,
    fontSize: ms(13),
    fontWeight: "700",
    marginBottom: vs(2),
  },
  title: {
    color: colors.primaryDark,
    fontSize: ms(25),
    fontWeight: "900",
    lineHeight: ms(30),
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  pressed: {
    opacity: 0.76,
  },
  actionList: {
    gap: vs(10),
  },
  actionItem: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    minHeight: vs(82),
    padding: rs(12),
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  primaryIcon: {
    backgroundColor: colors.primarySoft,
  },
  successIcon: {
    backgroundColor: colors.accentSoft,
  },
  dangerIcon: {
    backgroundColor: colors.warningSoft,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginTop: vs(3),
  },
  infoPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.accentSoft,
    borderColor: "#B8DCC7",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    marginTop: vs(16),
    padding: rs(14),
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: colors.accent,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(19),
  },
  infoBody: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(18),
    marginTop: vs(4),
  },
});
