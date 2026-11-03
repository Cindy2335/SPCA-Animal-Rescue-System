import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAdoptionApplications,
  submitAdoptionInspection,
  type AdoptionApplication,
} from "../services/api";
import colors from "../theme/colors";
import { CONTENT_MAX_WIDTH, ms, PAGE_PADDING, rs, vs } from "../theme/responsive";

type Recommendation = "APPROVE" | "DECLINE" | "FOLLOW_UP";

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function InspectionCard({
  application,
  onSubmitted,
}: {
  application: AdoptionApplication;
  onSubmitted: (next: AdoptionApplication) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [propertySafe, setPropertySafe] = useState(false);
  const [secureYard, setSecureYard] = useState(false);
  const [petsCompatible, setPetsCompatible] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation>("APPROVE");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const completed = application.status === "INSPECTION_COMPLETED";

  async function openMaps() {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(application.address)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Address", application.address);
  }

  async function submit() {
    if (notes.trim().length < 20) {
      Alert.alert("More detail needed", "Add at least 20 characters of inspection notes.");
      return;
    }
    setBusy(true);
    try {
      const next = await submitAdoptionInspection(application.id, {
        recommendation,
        propertySafe,
        secureYard,
        petsCompatible,
        notes: notes.trim(),
      });
      onSubmitted(next);
      setExpanded(false);
      Alert.alert("Report submitted", "The admin team can now make the final adoption decision.");
    } catch (error) {
      Alert.alert("Could not submit", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}><Ionicons name="home-outline" size={22} color={colors.primary} /></View>
        <View style={styles.grow}>
          <Text style={styles.name}>{application.applicantName}</Text>
          <Text style={styles.pet}>Home check for {application.animal.name}</Text>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>{pretty(application.status)}</Text></View>
      </View>
      <Pressable onPress={openMaps} style={styles.addressButton}>
        <Ionicons name="navigate-outline" size={18} color={colors.primary} />
        <Text style={styles.address}>{application.address}</Text>
        <Ionicons name="open-outline" size={16} color={colors.primary} />
      </Pressable>
      <View style={styles.details}>
        <Text style={styles.detail}>Phone: {application.phone}</Text>
        <Text style={styles.detail}>Housing: {application.housingType}</Text>
        <Text style={styles.detail}>Yard declared: {application.hasYard ? "Yes" : "No"}</Text>
        <Text style={styles.detail}>Other pets: {application.hasOtherPets ? application.otherPetsDetails || "Yes" : "No"}</Text>
      </View>
      {completed ? (
        <View style={styles.completed}>
          <Text style={styles.completedTitle}>Recommendation: {pretty(application.inspectionRecommendation || "")}</Text>
          <Text style={styles.completedText}>{application.inspectionNotes}</Text>
        </View>
      ) : (
        <>
          <Pressable onPress={() => setExpanded((value) => !value)} style={styles.primaryButton}>
            <Ionicons name="clipboard-outline" size={18} color={colors.white} />
            <Text style={styles.primaryButtonText}>{expanded ? "Close report" : "Complete inspection report"}</Text>
          </Pressable>
          {expanded ? (
            <View style={styles.form}>
              {[
                ["Property is safe", propertySafe, setPropertySafe],
                ["Yard / exits are secure", secureYard, setSecureYard],
                ["Existing pets are compatible", petsCompatible, setPetsCompatible],
              ].map(([label, value, setter]) => (
                <Pressable key={String(label)} onPress={() => (setter as (v: boolean) => void)(!value)} style={styles.checkRow}>
                  <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={colors.primary} />
                  <Text style={styles.checkText}>{String(label)}</Text>
                </Pressable>
              ))}
              <Text style={styles.label}>Recommendation</Text>
              <View style={styles.options}>
                {(["APPROVE", "FOLLOW_UP", "DECLINE"] as Recommendation[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setRecommendation(option)}
                    style={[styles.option, recommendation === option && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, recommendation === option && styles.optionTextActive]}>{pretty(option)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Inspection notes</Text>
              <TextInput
                multiline
                onChangeText={setNotes}
                placeholder="Describe the home, fencing, household discussion, risks, and any follow-up needed..."
                style={styles.notes}
                value={notes}
              />
              <Pressable disabled={busy} onPress={submit} style={[styles.submitButton, busy && styles.disabled]}>
                <Text style={styles.primaryButtonText}>{busy ? "Submitting..." : "Submit to admin"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function FieldAgentAdoptionsScreen() {
  const [applications, setApplications] = useState<AdoptionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      setApplications(await getAdoptionApplications());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load assigned inspections.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const pending = useMemo(() => applications.filter((item) => item.status === "INSPECTION_ASSIGNED"), [applications]);
  const completed = useMemo(() => applications.filter((item) => item.status === "INSPECTION_COMPLETED"), [applications]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <Text style={styles.title}>Adoption Inspections</Text>
        <Text style={styles.subtitle}>Visit assigned homes and return your inspection report to the admin team.</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryNumber}>{pending.length}</Text><Text style={styles.summaryLabel}>Pending home checks</Text>
          <Text style={styles.summaryNumber}>{completed.length}</Text><Text style={styles.summaryLabel}>Reports returned</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !applications.length ? <Text style={styles.empty}>No adoption inspections have been assigned to you.</Text> : null}
        {[...pending, ...completed].map((application) => (
          <InspectionCard
            application={application}
            key={application.id}
            onSubmitted={(next) => setApplications((current) => current.map((item) => item.id === next.id ? next : item))}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { alignSelf: "center", maxWidth: CONTENT_MAX_WIDTH, padding: PAGE_PADDING, paddingBottom: vs(32), width: "100%" },
  title: { color: colors.charcoal, fontSize: ms(27), fontWeight: "900", marginTop: vs(6) },
  subtitle: { color: colors.textSecondary, fontSize: ms(13), lineHeight: ms(19), marginTop: vs(4) },
  summary: { alignItems: "baseline", backgroundColor: colors.primary, borderRadius: 22, flexDirection: "row", gap: rs(7), marginVertical: vs(16), padding: rs(16) },
  summaryNumber: { color: colors.white, fontSize: ms(23), fontWeight: "900" },
  summaryLabel: { color: colors.white, flex: 1, fontSize: ms(11), fontWeight: "700" },
  card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 22, borderWidth: 1, marginBottom: vs(14), padding: rs(14) },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: rs(10) },
  avatar: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 16, height: rs(44), justifyContent: "center", width: rs(44) },
  grow: { flex: 1 },
  name: { color: colors.charcoal, fontSize: ms(16), fontWeight: "900" },
  pet: { color: colors.textSecondary, fontSize: ms(12), marginTop: 2 },
  badge: { backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: rs(8), paddingVertical: vs(5) },
  badgeText: { color: colors.accent, fontSize: ms(9), fontWeight: "900" },
  addressButton: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 14, flexDirection: "row", gap: rs(7), marginTop: vs(12), padding: rs(11) },
  address: { color: colors.primaryDark, flex: 1, fontSize: ms(12), fontWeight: "800" },
  details: { gap: vs(4), marginVertical: vs(11) },
  detail: { color: colors.text, fontSize: ms(12), lineHeight: ms(17) },
  primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, flexDirection: "row", gap: rs(7), justifyContent: "center", minHeight: vs(45) },
  primaryButtonText: { color: colors.white, fontSize: ms(13), fontWeight: "900" },
  form: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: vs(12), paddingTop: vs(12) },
  checkRow: { alignItems: "center", flexDirection: "row", gap: rs(8), marginBottom: vs(9) },
  checkText: { color: colors.text, fontSize: ms(13), fontWeight: "700" },
  label: { color: colors.charcoal, fontSize: ms(12), fontWeight: "900", marginBottom: vs(7), marginTop: vs(8) },
  options: { flexDirection: "row", gap: rs(6) },
  option: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, flex: 1, paddingVertical: vs(8) },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.textSecondary, fontSize: ms(10), fontWeight: "800", textAlign: "center" },
  optionTextActive: { color: colors.white },
  notes: { borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, minHeight: vs(100), padding: rs(11), textAlignVertical: "top" },
  submitButton: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", marginTop: vs(11), minHeight: vs(46) },
  disabled: { opacity: 0.6 },
  completed: { backgroundColor: colors.accentSoft, borderRadius: 14, padding: rs(11) },
  completedTitle: { color: colors.accent, fontSize: ms(12), fontWeight: "900" },
  completedText: { color: colors.text, fontSize: ms(12), lineHeight: ms(17), marginTop: vs(5) },
  loader: { marginTop: vs(28) },
  error: { color: colors.danger, marginBottom: vs(12) },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: vs(30) },
});
