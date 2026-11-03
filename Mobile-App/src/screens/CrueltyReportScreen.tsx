import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ComponentProps } from "react";
import {
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

type Severity = "Welfare concern" | "Injured animal" | "Immediate danger";
type EvidenceItem = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

const severityOptions: Severity[] = ["Welfare concern", "Injured animal", "Immediate danger"];

const evidenceItems: EvidenceItem[] = [
  { label: "Photos", icon: "camera-outline" },
  { label: "Address", icon: "location-outline" },
  { label: "Vehicle or person details", icon: "document-text-outline" },
];

const HERO_HEIGHT = clamp(screen.height * 0.26, 190, 250);

export default function CrueltyReportScreen() {
  const [severity, setSeverity] = useState<Severity>("Welfare concern");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [contactPermission, setContactPermission] = useState(true);

  const submitReport = () => {
    if (location.trim().length < 2 || details.trim().length < 10) {
      Alert.alert("More detail needed", "Add a location and a short description before submitting.");
      return;
    }

    Alert.alert(
      "Cruelty report prepared",
      "This front end is ready for the case intake endpoint and emergency contact handoff."
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Animal protection</Text>
            <Text style={styles.title}>Report cruelty</Text>
          </View>
        </View>

        <ImageBackground
          source={require("../../assets/Adopt.png")}
          style={styles.hero}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <View style={styles.heroShade} />
          <View style={styles.heroBadge}>
            <Ionicons name="shield-outline" size={15} color={colors.warning} />
            <Text style={styles.heroBadgeText}>Case intake</Text>
          </View>
          <Text style={styles.heroTitle}>Capture clear details for fast triage.</Text>
        </ImageBackground>

        <View style={styles.alertPanel}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={styles.alertText}>
            If there is immediate danger, contact local emergency services or your nearest animal
            welfare organisation first.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Severity</Text>
        </View>
        <View style={styles.severityList}>
          {severityOptions.map((option) => {
            const selected = severity === option;

            return (
              <Pressable
                key={option}
                onPress={() => setSeverity(option)}
                style={({ pressed }) => [
                  styles.severityChip,
                  selected ? styles.severityChipSelected : null,
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.severityText,
                    selected ? styles.severityTextSelected : null,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.formPanel}>
          <Text style={styles.inputLabel}>Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Street, suburb, landmark, or nearby place"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />

          <Text style={styles.inputLabel}>What happened?</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Describe the animal, people involved, timing, and visible injuries."
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.detailsInput]}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Useful evidence</Text>
        </View>
        <View style={styles.evidenceList}>
          {evidenceItems.map((item) => (
            <View key={item.label} style={styles.evidenceItem}>
              <View style={styles.evidenceIcon}>
                <Ionicons name={item.icon} size={18} color={colors.primaryDark} />
              </View>
              <Text style={styles.evidenceText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setContactPermission((value) => !value)}
          style={({ pressed }) => [
            styles.contactToggle,
            contactPermission ? styles.contactToggleSelected : null,
            pressed ? styles.pressed : null,
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: contactPermission }}
        >
          <View style={styles.contactCopy}>
            <Text style={styles.contactTitle}>Allow follow-up</Text>
            <Text style={styles.contactBody}>Shelter staff can ask for more detail if needed.</Text>
          </View>
          <Ionicons
            name={contactPermission ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={contactPermission ? colors.accent : colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={submitReport}
          style={({ pressed }) => [styles.submitButton, pressed ? styles.submitButtonPressed : null]}
          accessibilityRole="button"
        >
          <Ionicons name="send-outline" size={20} color={colors.white} />
          <Text style={styles.submitText}>Submit cruelty report</Text>
        </Pressable>
      </ScrollView>
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
    paddingBottom: vs(28),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(12),
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(12),
    marginBottom: vs(16),
  },
  iconButton: {
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
  headerCopy: {
    flex: 1,
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
  hero: {
    borderRadius: 8,
    justifyContent: "space-between",
    marginBottom: vs(12),
    minHeight: HERO_HEIGHT,
    overflow: "hidden",
    padding: rs(14),
  },
  heroImage: {
    borderRadius: 8,
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 24, 32, 0.42)",
  },
  heroBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(6),
    paddingHorizontal: rs(9),
    paddingVertical: vs(6),
  },
  heroBadgeText: {
    color: colors.warning,
    fontSize: ms(12),
    fontWeight: "900",
  },
  heroTitle: {
    color: colors.white,
    fontSize: ms(25),
    fontWeight: "900",
    lineHeight: ms(31),
    maxWidth: 310,
  },
  alertPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderColor: "#F5C2BD",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(14),
    padding: rs(12),
  },
  alertText: {
    color: colors.warning,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(18),
  },
  sectionHeader: {
    marginBottom: vs(10),
  },
  sectionTitle: {
    color: colors.text,
    fontSize: ms(18),
    fontWeight: "900",
  },
  severityList: {
    gap: vs(8),
    marginBottom: vs(12),
  },
  severityChip: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: TOUCH_TARGET,
    justifyContent: "center",
    paddingHorizontal: rs(12),
  },
  severityChipSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  severityText: {
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "900",
  },
  severityTextSelected: {
    color: colors.white,
  },
  formPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: vs(14),
    padding: rs(12),
  },
  inputLabel: {
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "800",
    marginBottom: vs(6),
  },
  input: {
    backgroundColor: colors.lightgray,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "600",
    marginBottom: vs(12),
    minHeight: TOUCH_TARGET,
    paddingHorizontal: rs(12),
    paddingVertical: vs(11),
  },
  detailsInput: {
    minHeight: vs(132),
  },
  evidenceList: {
    gap: vs(8),
    marginBottom: vs(12),
  },
  evidenceItem: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    minHeight: vs(54),
    paddingHorizontal: rs(12),
  },
  evidenceIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: rs(34),
    justifyContent: "center",
    width: rs(34),
  },
  evidenceText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(14),
    fontWeight: "800",
  },
  contactToggle: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    justifyContent: "space-between",
    marginBottom: vs(14),
    minHeight: vs(68),
    paddingHorizontal: rs(12),
  },
  contactToggleSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: "#B8DCC7",
  },
  contactCopy: {
    flex: 1,
  },
  contactTitle: {
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "900",
  },
  contactBody: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginTop: vs(2),
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(52),
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitText: {
    color: colors.white,
    fontSize: ms(15),
    fontWeight: "900",
  },
});
