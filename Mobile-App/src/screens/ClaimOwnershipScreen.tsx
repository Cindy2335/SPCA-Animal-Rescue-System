import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import {
  createStrayOwnershipClaim,
  getClaimableStrayReports,
  type ClaimableStrayReport,
} from "../services/api";
import colors from "../theme/colors";
import {
  CONTENT_MAX_WIDTH,
  ms,
  PAGE_PADDING,
  rs,
  TOUCH_TARGET,
  vs,
} from "../theme/responsive";

type AnimalFilter = "All" | ClaimableStrayReport["animalType"];
type SortMode = "closing" | "newest";

type ClaimReportItem = ClaimableStrayReport & {
  preview?: boolean;
  source: ImageSourcePropType | null;
};

const CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const URGENT_WINDOW_MS = 2 * DAY_MS;
const INITIAL_NOW = Date.now();
const BORDER_BLUE = "#D6EAF6";
const filters: { label: string; value: AnimalFilter }[] = [
  { label: "All", value: "All" },
  { label: "Dogs", value: "Dog" },
  { label: "Cats", value: "Cat" },
];

function previewReport(
  input: Omit<ClaimableStrayReport, "claimExpiresAt" | "createdAt" | "imageUrl" | "images"> & {
    ageInHours: number;
    source: ImageSourcePropType;
  }
): ClaimReportItem {
  const createdAt = new Date(Date.now() - input.ageInHours * HOUR_MS);

  return {
    id: input.id,
    animalType: input.animalType,
    condition: input.condition,
    area: input.area,
    breed: input.breed,
    color: input.color,
    age: input.age,
    gender: input.gender,
    imageUrl: null,
    images: [],
    createdAt: createdAt.toISOString(),
    claimExpiresAt: new Date(createdAt.getTime() + CLAIM_WINDOW_MS).toISOString(),
    hasSubmittedClaim: input.hasSubmittedClaim,
    preview: true,
    source: input.source,
  };
}

function buildPreviewReports(): ClaimReportItem[] {
  return [
    previewReport({
      id: "preview-cat-randburg",
      animalType: "Cat",
      condition: "Healthy and alert",
      area: "Randburg, Johannesburg",
      breed: "Domestic long hair",
      color: "Grey and white",
      age: "Adult",
      gender: "Unknown",
      ageInHours: 5 * 24,
      hasSubmittedClaim: false,
      source: require("../../assets/animals/cats/105.jpeg"),
    }),
    previewReport({
      id: "preview-dog-roodepoort",
      animalType: "Dog",
      condition: "Friendly, no visible injuries",
      area: "Roodepoort, Johannesburg",
      breed: "Retriever mix",
      color: "Golden",
      age: "Young adult",
      gender: "Female",
      ageInHours: 2 * 24,
      hasSubmittedClaim: false,
      source: require("../../assets/animals/dogs/101.jpeg"),
    }),
    previewReport({
      id: "preview-dog-soweto",
      animalType: "Dog",
      condition: "Wearing a brown collar",
      area: "Soweto, Johannesburg",
      breed: "Mixed breed",
      color: "Tan",
      age: "Adult",
      gender: "Male",
      ageInHours: 24,
      hasSubmittedClaim: false,
      source: require("../../assets/animals/dogs/107.jpeg"),
    }),
  ];
}

function toReportItem(report: ClaimableStrayReport): ClaimReportItem {
  const firstImage = report.images?.find((image) => Boolean(image.dataUri));

  return {
    ...report,
    source: firstImage?.dataUri
      ? { uri: firstImage.dataUri }
      : report.imageUrl
        ? { uri: report.imageUrl }
        : null,
  };
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getExpiryMs(report: ClaimableStrayReport) {
  const explicitExpiry = validDate(report.claimExpiresAt)?.getTime();

  if (explicitExpiry) {
    return explicitExpiry;
  }

  const createdAt = validDate(report.createdAt)?.getTime() ?? Date.now();
  return createdAt + CLAIM_WINDOW_MS;
}

function formatReportAge(createdAt: string, now: number) {
  const created = validDate(createdAt)?.getTime();

  if (!created) {
    return "Reported recently";
  }

  const elapsed = Math.max(0, now - created);

  if (elapsed < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(elapsed / (60 * 1000)));
    return `Reported ${minutes} min ago`;
  }

  if (elapsed < DAY_MS) {
    const hours = Math.max(1, Math.floor(elapsed / HOUR_MS));
    return `Reported ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.max(1, Math.floor(elapsed / DAY_MS));
  return `Reported ${days} ${days === 1 ? "day" : "days"} ago`;
}

function formatTimeLeft(milliseconds: number) {
  if (milliseconds <= 0) {
    return "Claim window closed";
  }

  if (milliseconds < HOUR_MS) {
    return "Less than 1 hour left to claim";
  }

  if (milliseconds < DAY_MS) {
    const hours = Math.max(1, Math.ceil(milliseconds / HOUR_MS));
    return `${hours} ${hours === 1 ? "hour" : "hours"} left to claim`;
  }

  const days = Math.max(1, Math.ceil(milliseconds / DAY_MS));
  return `${days} ${days === 1 ? "day" : "days"} left to claim`;
}

function formatClosingTime(expiryMs: number) {
  return new Date(expiryMs).toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function reportTitle(report: ClaimableStrayReport) {
  const details = [report.color, report.breed]
    .filter((value): value is string => Boolean(value?.trim()) && value !== "Unknown")
    .map((value) => value.trim());
  const kind = report.animalType.toLowerCase();

  return details.length ? `${details.join(" ")} ${kind}` : `Reported ${kind}`;
}

function reportDescription(report: ClaimableStrayReport) {
  const details = [report.age, report.gender]
    .filter((value): value is string => Boolean(value?.trim()) && value !== "Unknown")
    .map((value) => value.trim());

  return details.length ? details.join(" · ") : report.condition || "Details being verified";
}

function SkeletonCards() {
  return (
    <View style={styles.skeletonStack} accessibilityLabel="Loading recent stray reports">
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonCopy}>
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
            <View style={[styles.skeletonLine, styles.skeletonButton]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Photo({ report, style }: { report: ClaimReportItem; style: object }) {
  if (report.source) {
    return <Image source={report.source} style={style} resizeMode="cover" />;
  }

  return (
    <View style={[style, styles.photoFallback]}>
      <Ionicons name="paw-outline" size={34} color={colors.primary} />
      <Text style={styles.photoFallbackText}>No photo</Text>
    </View>
  );
}

function ReportCard({
  now,
  onClaim,
  report,
}: {
  now: number;
  onClaim: (report: ClaimReportItem) => void;
  report: ClaimReportItem;
}) {
  const expiryMs = getExpiryMs(report);
  const remainingMs = expiryMs - now;
  const urgent = remainingMs > 0 && remainingMs <= URGENT_WINDOW_MS;
  const expired = remainingMs <= 0;
  const remainingSegments = Math.max(0, Math.min(7, Math.ceil(remainingMs / DAY_MS)));
  const submitted = report.hasSubmittedClaim;
  const buttonDisabled = expired || submitted;

  return (
    <Pressable
      onPress={() => onClaim(report)}
      disabled={submitted || expired}
      accessibilityRole="button"
      accessibilityLabel={
        submitted
          ? `Ownership claim already submitted for ${reportTitle(report)}`
          : `Open ownership claim form for ${reportTitle(report)}`
      }
      style={({ pressed }) => [styles.reportCard, pressed ? styles.pressed : null]}
    >
      <View style={styles.reportTopRow}>
        <Photo report={report} style={styles.reportImage} />
        <View style={styles.reportCopy}>
          <View style={styles.reportChipRow}>
            <View style={styles.animalChip}>
              <Text style={styles.animalChipText}>{report.animalType}</Text>
            </View>
          </View>
          <Text style={styles.reportTitle} numberOfLines={2}>
            {reportTitle(report)}
          </Text>
          <Text style={styles.reportDetails} numberOfLines={1}>
            {reportDescription(report)}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={2}>
              {report.area}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatReportAge(report.createdAt, now)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.claimWindow, urgent ? styles.claimWindowUrgent : null]}>
        <View
          style={styles.dayMeter}
          accessibilityRole="image"
          accessibilityLabel={`${formatTimeLeft(remainingMs)} in the seven-day claim window`}
        >
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.daySegment,
                index < remainingSegments ? styles.daySegmentActive : null,
                index < remainingSegments && urgent ? styles.daySegmentUrgent : null,
              ]}
            />
          ))}
        </View>
        <View style={styles.claimWindowCopy}>
          <Text style={[styles.timeLeft, urgent ? styles.timeLeftUrgent : null]}>
            {formatTimeLeft(remainingMs)}
          </Text>
          <Text style={styles.closingDate}>Closes {formatClosingTime(expiryMs)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ClaimOwnershipScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<ClaimReportItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<AnimalFilter>("All");
  const [sortMode, setSortMode] = useState<SortMode>("closing");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [usingPreview, setUsingPreview] = useState(false);
  const [now, setNow] = useState(INITIAL_NOW);
  const [selectedReport, setSelectedReport] = useState<ClaimReportItem | null>(null);
  const [petName, setPetName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [identifyingFeatures, setIdentifyingFeatures] = useState("");
  const [proofDetails, setProofDetails] = useState("");
  const [proofPhotos, setProofPhotos] = useState<Array<{ uri: string; dataUri?: string; fileName?: string; mimeType?: string }>>([]);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const liveReports = await getClaimableStrayReports();
      const validReports = liveReports
        .filter((report) => getExpiryMs(report) > Date.now())
        .map(toReportItem);

      if (__DEV__ && validReports.length === 0) {
        setReports(buildPreviewReports());
        setUsingPreview(true);
      } else {
        setReports(validReports);
        setUsingPreview(false);
      }
      setFeedError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load recent reports.";
      setFeedError(message);

      setReports((currentReports) => {
        if (currentReports.length > 0) {
          return currentReports;
        }

        if (__DEV__) {
          setUsingPreview(true);
          return buildPreviewReports();
        }

        return [];
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadReports(), 0);
    return () => clearTimeout(initialLoad);
  }, [loadReports]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const visibleReports = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reports
      .filter((report) => getExpiryMs(report) > now)
      .filter((report) => selectedFilter === "All" || report.animalType === selectedFilter)
      .filter((report) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          report.animalType,
          report.area,
          report.breed,
          report.color,
          report.age,
          report.gender,
          report.condition,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (sortMode === "newest") {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }

        return getExpiryMs(left) - getExpiryMs(right);
      });
  }, [now, reports, searchQuery, selectedFilter, sortMode]);

  const clearDiscovery = () => {
    setSearchQuery("");
    setSelectedFilter("All");
  };

  const openClaim = (report: ClaimReportItem) => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (getExpiryMs(report) <= Date.now()) {
      setNow(Date.now());
      return;
    }

    setSelectedReport(report);
    setPetName("");
    setContactPhone(user.phone ?? user.email ?? "");
    setIdentifyingFeatures("");
    setProofDetails("");
    setProofPhotos([]);
    setConsentConfirmed(false);
    setClaimError(null);
    setClaimSubmitted(false);
  };

  const closeClaim = () => {
    if (!submitting) {
      setSelectedReport(null);
      setClaimError(null);
      setClaimSubmitted(false);
    }
  };

  const pickProofPhotos = async () => {
    if (proofPhotos.length >= 3) {
      Alert.alert("Proof photo limit reached", "You can attach up to 3 photos to support your claim.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access so you can attach proof images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      mediaTypes: ["images"],
      quality: 0.7,
      selectionLimit: Math.max(1, 3 - proofPhotos.length),
    });

    if (!result.canceled) {
      setProofPhotos((currentPhotos) => [
        ...currentPhotos,
        ...result.assets.map((asset) => ({
          uri: asset.uri,
          dataUri: asset.base64 ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}` : undefined,
          fileName: asset.fileName ?? undefined,
          mimeType: asset.mimeType ?? undefined,
        })),
      ].slice(0, 3));
    }
  };

  const removeProofPhoto = (uri: string) => {
    setProofPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.uri !== uri));
  };

  const submitClaim = async () => {
    if (!selectedReport) {
      return;
    }

    const cleanPhone = contactPhone.trim();
    const cleanFeatures = identifyingFeatures.trim();
    const cleanProofDetails = proofDetails.trim();
      const proofSummary = cleanProofDetails;

    if (cleanPhone.length < 7) {
      setClaimError("Enter a phone number where the SPCA team can reach you.");
      return;
    }

    if (cleanFeatures.length < 12) {
      setClaimError("Add a few identifying details that are not obvious from the photo.");
      return;
    }

    if (!consentConfirmed) {
      setClaimError("Confirm that the information is accurate before submitting.");
      return;
    }

    if (getExpiryMs(selectedReport) <= Date.now()) {
      setClaimError("The seven-day claim window has just closed for this report.");
      setNow(Date.now());
      return;
    }

    setSubmitting(true);
    setClaimError(null);

    try {
      if (!selectedReport.preview) {
        await createStrayOwnershipClaim(selectedReport.id, {
          petName: petName.trim() || undefined,
          identifyingFeatures: cleanFeatures,
          proofDetails: proofSummary || undefined,
          proofPhotos: proofPhotos.flatMap((photo) => photo.dataUri ? [{
            dataUri: photo.dataUri,
            fileName: photo.fileName,
            mimeType: photo.mimeType,
          }] : []),
          contactPhone: cleanPhone,
          consentConfirmed: true,
        });
      }

      setReports((currentReports) =>
        currentReports.map((report) =>
          report.id === selectedReport.id ? { ...report, hasSubmittedClaim: true } : report
        )
      );
      setClaimSubmitted(true);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Could not submit your claim.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasDiscoveryFilters = Boolean(searchQuery.trim()) || selectedFilter !== "All";
  const listHeader = (
    <>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/home" as Parameters<typeof router.replace>[0]);
            }
          }}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={27} color={colors.primaryDark} />
        </Pressable>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarEyebrow}>LOST &amp; FOUND</Text>
          <Text style={styles.topBarTitle}>Find your pet</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {feedError ? (
        <Pressable
          onPress={() => void loadReports(false)}
          style={({ pressed }) => [styles.inlineError, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Live feed unavailable. Retry"
        >
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <Text style={styles.inlineErrorText}>Live updates paused. Tap to retry.</Text>
          <Ionicons name="refresh" size={17} color={colors.warning} />
        </Pressable>
      ) : null}

      <View style={styles.searchBox}>
        <Ionicons name="search" size={21} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search breed, colour or area"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search claimable stray reports"
        />
        {searchQuery ? (
          <Pressable
            onPress={() => setSearchQuery("")}
            style={styles.clearSearchButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={21} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filters}
        keyExtractor={(item) => item.value}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const selected = selectedFilter === item.value;

          return (
            <Pressable
              onPress={() => setSelectedFilter(item.value)}
              style={({ pressed }) => [
                styles.filterChip,
                selected ? styles.filterChipSelected : null,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.listHeading}>
        <View>
          <Text style={styles.listTitle}>Recently reported</Text>
          <Text style={styles.listCount}>
            {visibleReports.length} eligible {visibleReports.length === 1 ? "report" : "reports"}
          </Text>
        </View>
        <Pressable
          onPress={() => setSortMode((current) => (current === "closing" ? "newest" : "closing"))}
          style={({ pressed }) => [styles.sortButton, pressed ? styles.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${sortMode === "closing" ? "closing soon" : "newest"}. Change sort`}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.primaryDark} />
          <Text style={styles.sortButtonText}>{sortMode === "closing" ? "Closing soon" : "Newest"}</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {loading && reports.length === 0 ? (
        <View style={styles.loadingPage}>
          {listHeader}
          <SkeletonCards />
        </View>
      ) : feedError && reports.length === 0 ? (
        <View style={styles.loadingPage}>
          {listHeader}
          <View style={styles.fullState}>
            <View style={styles.fullStateIcon}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.warning} />
            </View>
            <Text style={styles.fullStateTitle}>Recent reports are unavailable</Text>
            <Text style={styles.fullStateBody}>{feedError}</Text>
            <Pressable
              onPress={() => void loadReports(false)}
              style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={visibleReports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReportCard report={item} now={now} onClaim={openClaim} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.fullState}>
              <View style={styles.fullStateIcon}>
                <Ionicons name="search-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.fullStateTitle}>
                {hasDiscoveryFilters ? "No matching reports" : "No claimable reports right now"}
              </Text>
              <Text style={styles.fullStateBody}>
                {hasDiscoveryFilters
                  ? "Try another breed, colour, area, or animal type."
                  : "Only reports from the last 7 days appear here. Pull down to check again."}
              </Text>
              {hasDiscoveryFilters ? (
                <Pressable
                  onPress={clearDiscovery}
                  style={({ pressed }) => [styles.clearFiltersButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Text style={styles.clearFiltersText}>Clear search and filters</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadReports(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <Modal
        visible={Boolean(selectedReport)}
        animationType="slide"
        transparent
        onRequestClose={closeClaim}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboardView}
        >
          <Pressable style={styles.modalScrim} onPress={closeClaim} />
          <View style={[styles.claimSheet, { paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetEyebrow}>OWNERSHIP CHECK</Text>
                <Text style={styles.sheetTitle}>{claimSubmitted ? "Claim received" : "Tell us how you know"}</Text>
              </View>
              <Pressable
                onPress={closeClaim}
                disabled={submitting}
                style={({ pressed }) => [styles.sheetClose, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel="Close ownership claim"
              >
                <Ionicons name="close" size={24} color={colors.charcoal} />
              </Pressable>
            </View>

            {claimSubmitted ? (
              <View style={styles.successState}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={36} color={colors.white} />
                </View>
                <Text style={styles.successTitle}>Your claim is in review</Text>
                <Text style={styles.successBody}>
                  The SPCA team will compare your details with the report and contact you. Submitting a claim does not transfer ownership automatically.
                </Text>
                <Pressable
                  onPress={closeClaim}
                  style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </View>
            ) : selectedReport ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formContent}
              >
                <View style={styles.claimAnimalSummary}>
                  <Photo report={selectedReport} style={styles.claimAnimalImage} />
                  <View style={styles.claimAnimalCopy}>
                    <Text style={styles.claimAnimalTitle} numberOfLines={2}>
                      {reportTitle(selectedReport)}
                    </Text>
                    <Text style={styles.claimAnimalArea} numberOfLines={2}>
                      {selectedReport.area}
                    </Text>
                  </View>
                  <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
                </View>

                <View style={styles.verificationNote}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.verificationNoteText}>
                    Details are reviewed privately. Include something only the pet’s owner would know.
                  </Text>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Pet’s name <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <TextInput
                    value={petName}
                    onChangeText={setPetName}
                    placeholder="What do you call them?"
                    placeholderTextColor={colors.muted}
                    style={styles.fieldInput}
                    maxLength={80}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Contact number</Text>
                  <TextInput
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder="e.g. 071 234 5678"
                    placeholderTextColor={colors.muted}
                    style={styles.fieldInput}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    maxLength={30}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Identifying features</Text>
                  <Text style={styles.fieldHelper}>Describe a hidden marking, scar, collar detail, or behaviour.</Text>
                  <TextInput
                    value={identifyingFeatures}
                    onChangeText={setIdentifyingFeatures}
                    placeholder="Share details not obvious from the listing…"
                    placeholderTextColor={colors.muted}
                    style={[styles.fieldInput, styles.fieldTextArea]}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Proof details <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <Text style={styles.fieldHelper}>Add a microchip number, vet name, or note about photos you can provide.</Text>
                  <TextInput
                    value={proofDetails}
                    onChangeText={setProofDetails}
                    placeholder="Microchip, vet record, photo history…"
                    placeholderTextColor={colors.muted}
                    style={[styles.fieldInput, styles.fieldTextAreaSmall]}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Proof photos <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <Pressable
                    onPress={() => void pickProofPhotos()}
                    style={({ pressed }) => [styles.uploadProofButton, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="images-outline" size={18} color={colors.primaryDark} />
                    <Text style={styles.uploadProofButtonText}>Add photos of you with the pet</Text>
                  </Pressable>

                  {proofPhotos.length > 0 ? (
                    <View style={styles.proofPhotoGrid}>
                      {proofPhotos.map((photo) => (
                        <View key={photo.uri} style={styles.proofPhotoItem}>
                          <Image source={{ uri: photo.uri }} style={styles.proofPhotoThumb} resizeMode="cover" />
                          <Pressable
                            onPress={() => removeProofPhoto(photo.uri)}
                            style={({ pressed }) => [styles.removeProofPhotoButton, pressed ? styles.pressed : null]}
                            accessibilityRole="button"
                            accessibilityLabel="Remove proof photo"
                          >
                            <Ionicons name="close" size={12} color={colors.white} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => setConsentConfirmed((current) => !current)}
                  style={({ pressed }) => [styles.consentRow, pressed ? styles.pressed : null]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentConfirmed }}
                >
                  <View style={[styles.checkbox, consentConfirmed ? styles.checkboxChecked : null]}>
                    {consentConfirmed ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                  </View>
                  <Text style={styles.consentText}>
                    I confirm these details are accurate and understand that the SPCA will verify ownership.
                  </Text>
                </Pressable>

                {claimError ? (
                  <View style={styles.claimErrorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.claimErrorText}>{claimError}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void submitClaim()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    submitting ? styles.submitButtonDisabled : null,
                    pressed && !submitting ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ busy: submitting, disabled: submitting }}
                >
                  {submitting ? <ActivityIndicator color={colors.white} /> : <Ionicons name="shield-checkmark" size={19} color={colors.white} />}
                  <Text style={styles.submitButtonText}>
                    {submitting ? "Submitting…" : "Submit claim for review"}
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  listContent: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(32),
    paddingHorizontal: PAGE_PADDING,
    width: "100%",
  },
  loadingPage: {
    alignSelf: "center",
    flex: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    paddingHorizontal: PAGE_PADDING,
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: vs(62),
    paddingVertical: vs(7),
  },
  backButton: {
    alignItems: "center",
    borderRadius: 16,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  topBarTitleWrap: {
    alignItems: "center",
    flex: 1,
  },
  topBarEyebrow: {
    color: colors.primary,
    fontSize: ms(10),
    fontWeight: "900",
    letterSpacing: 1.4,
    lineHeight: ms(14),
  },
  topBarTitle: {
    color: colors.charcoal,
    fontSize: ms(21),
    fontWeight: "900",
    lineHeight: ms(27),
  },

  previewBanner: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: BORDER_BLUE,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(9),
    marginBottom: vs(12),
    paddingHorizontal: rs(13),
    paddingVertical: vs(10),
  },
  previewBannerText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  inlineError: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: "#F2C2BE",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(12),
    paddingHorizontal: rs(13),
    paddingVertical: vs(10),
  },
  inlineErrorText: {
    color: colors.warning,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "800",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: vs(52),
    paddingLeft: rs(15),
    paddingRight: rs(8),
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: ms(14),
    fontWeight: "600",
    minHeight: vs(50),
    paddingHorizontal: rs(10),
    paddingVertical: 0,
  },
  clearSearchButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  filterRow: {
    gap: rs(8),
    paddingBottom: vs(5),
    paddingTop: vs(12),
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    borderRadius: 0,
    justifyContent: "center",
    minHeight: TOUCH_TARGET,
    minWidth: rs(72),
    paddingHorizontal: rs(16),
  },
  filterChipSelected: {
    backgroundColor: "transparent",
    borderBottomColor: colors.primary,
    borderBottomWidth: 3,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "800",
  },
  filterChipTextSelected: {
    color: colors.primaryDark,
  },
  listHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: vs(12),
    paddingTop: vs(17),
  },
  listTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  listCount: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(2),
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: rs(5),
    minHeight: vs(38),
    paddingHorizontal: rs(11),
  },
  sortButtonText: {
    color: colors.primaryDark,
    fontSize: ms(11),
    fontWeight: "900",
  },
  reportCard: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    padding: rs(12),
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  reportTopRow: {
    flexDirection: "row",
    gap: rs(12),
  },
  reportImage: {
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: rs(128),
    width: rs(112),
  },
  photoFallback: {
    alignItems: "center",
    borderColor: BORDER_BLUE,
    borderWidth: 1,
    justifyContent: "center",
  },
  photoFallbackText: {
    color: colors.primaryDark,
    fontSize: ms(10),
    fontWeight: "800",
    marginTop: vs(4),
  },
  reportCopy: {
    flex: 1,
    minWidth: 0,
  },
  reportChipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(5),
  },
  animalChip: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 0,
    paddingHorizontal: rs(8),
    paddingVertical: vs(4),
  },
  animalChipText: {
    color: colors.primaryDark,
    fontSize: ms(10),
    fontWeight: "900",
  },

  reportTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(20),
    marginTop: vs(7),
    textTransform: "capitalize",
  },
  reportDetails: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(2),
  },
  metaRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: rs(5),
    marginTop: vs(6),
  },
  metaText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
  },
  claimWindow: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: rs(11),
    marginTop: vs(11),
    paddingHorizontal: rs(11),
    paddingVertical: vs(9),
  },
  claimWindowUrgent: {
    backgroundColor: colors.warningSoft,
  },
  dayMeter: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: rs(3),
  },
  daySegment: {
    backgroundColor: colors.border,
    borderRadius: 3,
    height: vs(18),
    width: rs(4),
  },
  daySegmentActive: {
    backgroundColor: colors.primary,
  },
  daySegmentUrgent: {
    backgroundColor: colors.danger,
  },
  claimWindowCopy: {
    flex: 1,
    minWidth: 0,
  },
  timeLeft: {
    color: colors.primaryDark,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
  },
  timeLeftUrgent: {
    color: colors.danger,
  },
  closingDate: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "700",
    lineHeight: ms(14),
    marginTop: vs(1),
  },

  cardSeparator: {
    height: vs(12),
  },
  fullState: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: vs(230),
    padding: rs(24),
  },
  fullStateIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(62),
    justifyContent: "center",
    width: rs(62),
  },
  fullStateTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
    marginTop: vs(12),
    textAlign: "center",
  },
  fullStateBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    marginTop: vs(6),
    maxWidth: 320,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: vs(14),
    minHeight: TOUCH_TARGET,
    paddingHorizontal: rs(20),
  },
  retryButtonText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  clearFiltersButton: {
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: vs(14),
    paddingHorizontal: rs(16),
    paddingVertical: vs(10),
  },
  clearFiltersText: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "900",
  },
  skeletonStack: {
    gap: vs(12),
  },
  skeletonCard: {
    backgroundColor: colors.white,
    borderColor: BORDER_BLUE,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    padding: rs(12),
  },
  skeletonImage: {
    backgroundColor: colors.lightgray,
    borderRadius: 18,
    height: rs(128),
    width: rs(112),
  },
  skeletonCopy: {
    flex: 1,
    gap: vs(10),
    paddingTop: vs(5),
  },
  skeletonLine: {
    backgroundColor: colors.lightgray,
    borderRadius: 999,
    height: vs(11),
    width: "100%",
  },
  skeletonLineShort: {
    width: "36%",
  },
  skeletonLineMedium: {
    width: "68%",
  },
  skeletonButton: {
    height: vs(37),
    marginTop: vs(5),
  },
  modalKeyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrim: {
    backgroundColor: "rgba(8, 24, 34, 0.52)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  claimSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "92%",
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(9),
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: vs(5),
    marginBottom: vs(8),
    width: rs(46),
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: vs(57),
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetEyebrow: {
    color: colors.primary,
    fontSize: ms(10),
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sheetTitle: {
    color: colors.charcoal,
    fontSize: ms(21),
    fontWeight: "900",
    lineHeight: ms(27),
    marginTop: vs(2),
  },
  sheetClose: {
    alignItems: "center",
    backgroundColor: colors.lightgray,
    borderRadius: 999,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  formContent: {
    paddingBottom: vs(12),
  },
  claimAnimalSummary: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: BORDER_BLUE,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(11),
    marginBottom: vs(11),
    padding: rs(9),
  },
  claimAnimalImage: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    height: rs(64),
    width: rs(64),
  },
  claimAnimalCopy: {
    flex: 1,
    minWidth: 0,
  },
  claimAnimalTitle: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "900",
    lineHeight: ms(18),
    textTransform: "capitalize",
  },
  claimAnimalArea: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(3),
  },
  verificationNote: {
    alignItems: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(14),
    padding: rs(11),
  },
  verificationNoteText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  fieldBlock: {
    marginBottom: vs(13),
  },
  fieldLabel: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(17),
    marginBottom: vs(6),
  },
  optionalLabel: {
    color: colors.muted,
    fontWeight: "700",
  },
  fieldHelper: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "600",
    lineHeight: ms(14),
    marginBottom: vs(6),
    marginTop: -vs(3),
  },
  fieldInput: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: ms(13),
    fontWeight: "600",
    minHeight: vs(48),
    paddingHorizontal: rs(13),
    paddingVertical: vs(10),
  },
  fieldTextArea: {
    minHeight: vs(92),
  },
  fieldTextAreaSmall: {
    minHeight: vs(72),
  },
  uploadProofButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: BORDER_BLUE,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(46),
    paddingHorizontal: rs(14),
  },
  uploadProofButtonText: {
    color: colors.primaryDark,
    fontSize: ms(12),
    fontWeight: "800",
  },
  proofPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
    marginTop: vs(10),
  },
  proofPhotoItem: {
    position: "relative",
  },
  proofPhotoThumb: {
    borderRadius: 12,
    height: rs(72),
    width: rs(72),
  },
  removeProofPhotoButton: {
    alignItems: "center",
    backgroundColor: "rgba(10, 16, 32, 0.7)",
    borderRadius: 999,
    height: rs(20),
    justifyContent: "center",
    position: "absolute",
    right: rs(4),
    top: rs(4),
    width: rs(20),
  },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(13),
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 2,
    height: rs(24),
    justifyContent: "center",
    width: rs(24),
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  claimErrorBox: {
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderColor: "#F2C2BE",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(12),
    padding: rs(10),
  },
  claimErrorText: {
    color: colors.danger,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "800",
    lineHeight: ms(16),
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(52),
  },
  submitButtonDisabled: {
    opacity: 0.66,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
  successState: {
    alignItems: "center",
    paddingBottom: vs(18),
    paddingHorizontal: rs(18),
    paddingTop: vs(24),
  },
  successIcon: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: rs(72),
    justifyContent: "center",
    width: rs(72),
  },
  successTitle: {
    color: colors.charcoal,
    fontSize: ms(22),
    fontWeight: "900",
    lineHeight: ms(28),
    marginTop: vs(16),
    textAlign: "center",
  },
  successBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(20),
    marginTop: vs(8),
    maxWidth: 360,
    textAlign: "center",
  },
  doneButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: vs(22),
    minHeight: vs(52),
  },
  doneButtonText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
