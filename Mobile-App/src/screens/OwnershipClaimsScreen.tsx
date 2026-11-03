import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdoptionPickupDateTimePicker from "../components/AdoptionPickupDateTimePicker";
import { useAuth } from "../context/AuthContext";
import {
  getStrayOwnershipClaims,
  scheduleStrayOwnershipPickup,
  type StrayOwnershipClaim,
} from "../services/api";
import colors from "../theme/colors";
import { CONTENT_MAX_WIDTH, ms, PAGE_PADDING, rs, vs } from "../theme/responsive";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (["APPROVED", "PICKUP_SCHEDULED", "COLLECTED"].includes(status)) {
    return { backgroundColor: colors.accentSoft, color: colors.accent, icon: "checkmark-circle-outline" as IoniconName };
  }
  if (status === "REJECTED") {
    return { backgroundColor: colors.warningSoft, color: colors.danger, icon: "close-circle-outline" as IoniconName };
  }
  return { backgroundColor: colors.primarySoft, color: colors.primaryDark, icon: "time-outline" as IoniconName };
}

function nextStep(claim: StrayOwnershipClaim) {
  if (claim.status === "PENDING") return "The SPCA team is reviewing your ownership details.";
  if (claim.status === "APPROVED") return "Your claim was approved. Choose when you would like to collect your pet.";
  if (claim.status === "PICKUP_SCHEDULED") return "Your collection time is booked. You can update it if needed.";
  if (claim.status === "COLLECTED") return "Your pet has been collected and the claim is complete.";
  return "The SPCA team could not approve this ownership claim.";
}

function ClaimCard({ claim, onUpdated }: { claim: StrayOwnershipClaim; onUpdated: (claim: StrayOwnershipClaim) => void }) {
  const tone = statusTone(claim.status);
  const image = claim.report.images[0]?.dataUri || claim.report.imageUrl;
  const [pickupDate, setPickupDate] = useState(() => {
    const current = claim.pickupScheduledAt ? new Date(claim.pickupScheduledAt) : new Date();
    if (claim.pickupScheduledAt && !Number.isNaN(current.getTime())) return current;
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
    return current;
  });
  const [pickupNote, setPickupNote] = useState(claim.pickupNote ?? "");
  const [saving, setSaving] = useState(false);
  const canSchedule = claim.status === "APPROVED" || claim.status === "PICKUP_SCHEDULED";

  async function savePickup() {
    if (pickupDate.getTime() <= Date.now()) {
      Alert.alert("Choose a future time", "Collection must be scheduled for a future date and time.");
      return;
    }
    setSaving(true);
    try {
      const updated = await scheduleStrayOwnershipPickup(claim.id, {
        pickupScheduledAt: pickupDate.toISOString(),
        pickupNote: pickupNote.trim() || undefined,
      });
      onUpdated(updated);
      Alert.alert("Collection scheduled", "The SPCA team has your collection time.");
    } catch (error) {
      Alert.alert("Could not schedule collection", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {image ? <Image source={{ uri: image }} style={styles.image} /> : <View style={[styles.image, styles.imageFallback]}><Ionicons name="paw-outline" size={28} color={colors.primary} /></View>}
        <View style={styles.copy}>
          <Text style={styles.petTitle}>{claim.petName || `Reported ${claim.report.animalType.toLowerCase()}`}</Text>
          <Text style={styles.location} numberOfLines={2}>{claim.report.location}</Text>
          <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
            <Ionicons name={tone.icon} size={14} color={tone.color} />
            <Text style={[styles.badgeText, { color: tone.color }]}>{formatStatus(claim.status)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.nextStep}>{nextStep(claim)}</Text>
      {claim.pickupScheduledAt ? <Text style={styles.pickupSummary}>Collection: {new Date(claim.pickupScheduledAt).toLocaleString()}</Text> : null}
      {canSchedule ? (
        <View style={styles.scheduleBox}>
          <Text style={styles.scheduleTitle}>{claim.status === "PICKUP_SCHEDULED" ? "Change collection time" : "Schedule collection"}</Text>
          <AdoptionPickupDateTimePicker disabled={saving} minimumDate={new Date()} onChange={setPickupDate} value={pickupDate} />
          <TextInput editable={!saving} onChangeText={setPickupNote} placeholder="Optional note for the shelter" placeholderTextColor={colors.muted} style={styles.noteInput} value={pickupNote} />
          <Pressable disabled={saving} onPress={() => void savePickup()} style={({ pressed }) => [styles.scheduleButton, pressed ? styles.pressed : null]}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.scheduleButtonText}>{claim.status === "PICKUP_SCHEDULED" ? "Update collection" : "Confirm collection"}</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function OwnershipClaimsScreen() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<StrayOwnershipClaim[]>([]);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClaims = useCallback(async (refresh = false) => {
    if (!user?.id) {
      setClaims([]);
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setClaims(await getStrayOwnershipClaims());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your claims.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void loadClaims(); }, [loadClaims]));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadClaims(true)} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.kicker}>OWNERSHIP</Text><Text style={styles.title}>My Claims</Text></View>
          <Pressable onPress={() => router.push("/claim-ownership" as Parameters<typeof router.push>[0])} style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]} accessibilityRole="button" accessibilityLabel="Find a lost pet"><Ionicons name="search" size={21} color={colors.white} /></Pressable>
        </View>
        <Text style={styles.intro}>Track your ownership claims and schedule collection after approval.</Text>
        {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateTitle}>Loading claims</Text></View> : error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={34} color={colors.warning} /><Text style={styles.stateTitle}>Claims unavailable</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={() => void loadClaims()} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View> : claims.length ? <View style={styles.stack}>{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} onUpdated={(updated) => setClaims((current) => current.map((item) => item.id === updated.id ? updated : item))} />)}</View> : <View style={styles.state}><Ionicons name="shield-checkmark-outline" size={36} color={colors.primary} /><Text style={styles.stateTitle}>No ownership claims yet</Text><Text style={styles.stateText}>Claims you submit for recent stray reports will appear here.</Text><Pressable onPress={() => router.push("/claim-ownership" as Parameters<typeof router.push>[0])} style={styles.retryButton}><Text style={styles.retryText}>Find your lost pet</Text></Pressable></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { alignSelf: "center", maxWidth: CONTENT_MAX_WIDTH, paddingBottom: vs(30), paddingHorizontal: PAGE_PADDING, paddingTop: vs(14), width: "100%" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: vs(8) },
  kicker: { color: colors.primary, fontSize: ms(10), fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.charcoal, fontSize: ms(27), fontWeight: "900", lineHeight: ms(33) },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, height: rs(44), justifyContent: "center", width: rs(44) },
  intro: { color: colors.textSecondary, fontSize: ms(13), fontWeight: "600", lineHeight: ms(19), marginBottom: vs(16) },
  stack: { gap: vs(12) },
  card: { backgroundColor: colors.white, borderColor: "#D6EAF6", borderRadius: 18, borderWidth: 1, padding: rs(13) },
  cardHeader: { flexDirection: "row", gap: rs(11) },
  image: { backgroundColor: colors.primarySoft, borderRadius: 13, height: rs(82), width: rs(82) },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  petTitle: { color: colors.charcoal, fontSize: ms(16), fontWeight: "900", lineHeight: ms(21) },
  location: { color: colors.textSecondary, fontSize: ms(11), fontWeight: "600", lineHeight: ms(15), marginTop: vs(3) },
  badge: { alignItems: "center", alignSelf: "flex-start", borderRadius: 999, flexDirection: "row", gap: rs(5), marginTop: vs(7), paddingHorizontal: rs(9), paddingVertical: vs(5) },
  badgeText: { fontSize: ms(10), fontWeight: "900" },
  nextStep: { color: colors.textSecondary, fontSize: ms(12), fontWeight: "600", lineHeight: ms(18), marginTop: vs(12) },
  pickupSummary: { color: colors.primaryDark, fontSize: ms(12), fontWeight: "900", marginTop: vs(8) },
  scheduleBox: { backgroundColor: colors.background, borderRadius: 14, marginTop: vs(12), padding: rs(10) },
  scheduleTitle: { color: colors.charcoal, fontSize: ms(12), fontWeight: "900", marginBottom: vs(7) },
  noteInput: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: ms(12), minHeight: vs(42), paddingHorizontal: rs(10), marginTop: vs(8) },
  scheduleButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, justifyContent: "center", marginTop: vs(9), minHeight: vs(44) },
  scheduleButtonText: { color: colors.white, fontSize: ms(12), fontWeight: "900" },
  state: { alignItems: "center", backgroundColor: colors.white, borderColor: "#D6EAF6", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: vs(230), padding: rs(24) },
  stateTitle: { color: colors.charcoal, fontSize: ms(17), fontWeight: "900", marginTop: vs(10), textAlign: "center" },
  stateText: { color: colors.textSecondary, fontSize: ms(12), fontWeight: "600", lineHeight: ms(18), marginTop: vs(6), textAlign: "center" },
  retryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, justifyContent: "center", marginTop: vs(14), minHeight: vs(44), paddingHorizontal: rs(17) },
  retryText: { color: colors.white, fontSize: ms(12), fontWeight: "900" },
  pressed: { opacity: 0.72 },
});
