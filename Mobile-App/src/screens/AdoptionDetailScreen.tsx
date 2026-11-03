import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, type ComponentProps, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getAdoptionAnimalById,
  shelterAnimalToAdoptionAnimal,
  type AdoptionAnimal,
} from "../data/adoptionAnimals";
import { getShelterAnimalById } from "../services/api";
import { trackAdoptionPetViewed } from "../services/analytics";
import colors from "../theme/colors";
import { clamp, ms, PAGE_PADDING, rs, screen, TOUCH_TARGET, vs } from "../theme/responsive";

const PRIMARY = colors.primary;
const PRIMARY_DARK = colors.primaryDark;
const INK = colors.charcoal;
const HIGHLIGHT = "#F4C84B";
const SOFT_PANEL = "#F5FAFE";
const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = clamp(screen.height * 0.39, 306, 360);
const SHEET_OVERLAP = clamp(screen.height * 0.035, 26, 34);
const FOOTER_BUTTON_HEIGHT = clamp(screen.height * 0.056, 46, 52);

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function getPersonalityIcon(trait: string): IoniconName {
  const map: Record<string, IoniconName> = {
    Playful: "tennisball-outline",
    Friendly: "happy-outline",
    "Loves attention": "heart-outline",
    Loyal: "shield-checkmark-outline",
    Curious: "search-outline",
    Calm: "leaf-outline",
    Gentle: "rose-outline",
    Quiet: "volume-mute-outline",
    Affectionate: "heart-circle-outline",
    Energetic: "flash-outline",
    Smart: "bulb-outline",
    Social: "people-outline",
    Happy: "happy-outline",
    Brave: "shield-outline",
    "People-loving": "people-outline",
    Cuddly: "heart-outline",
    Patient: "time-outline",
    Indoor: "home-outline",
    Confident: "medal-outline",
  };

  return map[trait] ?? "paw-outline";
}

function getGenderIcon(sex: string): IoniconName {
  const normalizedSex = sex.toLowerCase();

  if (normalizedSex.includes("female")) {
    return "female-outline";
  }

  if (normalizedSex.includes("male")) {
    return "male-outline";
  }

  return "male-female-outline";
}

function getSterilizedStatus(age: string) {
  const normalizedAge = age.toLowerCase();

  if (normalizedAge.includes("week") || normalizedAge.includes("month")) {
    return "No";
  }

  return "Yes";
}

function FactItem({
  icon,
  label,
  subValue,
  value,
  wide,
}: {
  icon: IoniconName;
  label: string;
  subValue?: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.factItem, wide && styles.factItemWide]}>
      <Ionicons name={icon} size={rs(22)} color={PRIMARY} />
      <View style={styles.factCopy}>
        <Text style={styles.factValue} numberOfLines={2}>
          {value}
        </Text>
        <Text style={styles.factLabel} numberOfLines={1}>
          {label}
        </Text>
        {subValue ? (
          <Text style={styles.factSubValue} numberOfLines={1}>
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  const positive = value === "Yes";

  return (
    <View style={styles.healthRow}>
      <Ionicons
        name={positive ? "checkmark-circle-outline" : "ellipse-outline"}
        size={rs(18)}
        color={positive ? PRIMARY : colors.textSecondary}
      />
      <Text style={styles.healthLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.healthValue, !positive && styles.healthValueNo]}>{value}</Text>
    </View>
  );
}

function HomeFitRow({
  icon,
  label,
  value,
}: {
  icon: IoniconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.homeFitRow}>
      <View style={styles.homeFitIcon}>
        <Ionicons name={icon} size={rs(15)} color={PRIMARY} />
      </View>
      <View style={styles.homeFitCopy}>
        <Text style={styles.homeFitLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.homeFitValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SparkLines() {
  return (
    <View style={styles.sparkLines} pointerEvents="none">
      <View style={[styles.sparkLine, styles.sparkLineTop]} />
      <View style={[styles.sparkLine, styles.sparkLineMiddle]} />
      <View style={[styles.sparkLine, styles.sparkLineBottom]} />
    </View>
  );
}

function DogHouseIllustration() {
  return (
    <View style={styles.houseScene} pointerEvents="none">
      <View style={styles.tinyHeart} />
      <View style={styles.houseRoofBack} />
      <View style={styles.houseBody}>
        <View style={styles.houseDoor} />
      </View>
      <View style={styles.houseRoofFront} />
      <View style={styles.houseChimney} />
      <View style={styles.foodBowl}>
        <Ionicons name="paw" size={rs(12)} color={colors.white} />
      </View>
      <View style={styles.ball}>
        <View style={styles.ballStripe} />
      </View>
      <View style={styles.grassLeft} />
      <View style={styles.grassRight} />
    </View>
  );
}

export default function AdoptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const animalIdParam = Array.isArray(id) ? id[0] : id;
  const animalIdFromRoute = animalIdParam ? decodeURIComponent(animalIdParam).trim() : undefined;
  const [remoteAnimal, setRemoteAnimal] = useState<AdoptionAnimal | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const bundledAnimal = getAdoptionAnimalById(animalIdFromRoute);
  const animal = remoteAnimal ?? bundledAnimal;
  const viewedAnimalId = animal?.id;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;

    if (animalIdFromRoute) {
      getShelterAnimalById(animalIdFromRoute)
        .then((shelterAnimal) => {
          if (mounted) {
            setRemoteAnimal(shelterAnimalToAdoptionAnimal(shelterAnimal));
          }
        })
        .catch(() => {
          if (mounted) {
            setRemoteAnimal(null);
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [animalIdFromRoute]);

  useEffect(() => {
    setPhotoIndex(0);
  }, [animalIdFromRoute]);

  useEffect(() => {
    if (viewedAnimalId) {
      void trackAdoptionPetViewed();
    }
  }, [viewedAnimalId]);

  if (!animal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.missingState}>
          <Ionicons name="heart-outline" size={34} color={PRIMARY} />
          <Text style={styles.missingTitle}>Pet profile not found</Text>
          <Pressable
            onPress={() => router.replace("/adoption")}
            style={({ pressed }) => [styles.fallbackButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.fallbackButtonText}>Back to adoption</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const photos = animal.images.length > 0 ? animal.images : [animal.image];
  const displayTraits = animal.personality.slice(0, 3);
  const footerBottomPadding = insets.bottom || vs(14);
  const footerHeight = FOOTER_BUTTON_HEIGHT + vs(24) + footerBottomPadding;
  const animalId = animal.id;

  function handlePhotoScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPhotoIndex(idx);
  }

  function openApplication() {
    router.push({ pathname: "/adoption-application", params: { animalId } });
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: vs(18) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePhotoScroll}
            scrollEventThrottle={16}
            style={styles.heroScroll}
          >
            {photos.map((photo, i) => (
              <Image key={i} source={photo} style={styles.heroImage} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={[styles.imageOverlay, { paddingTop: insets.top + vs(10) }]}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.circularButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons
                name="chevron-back"
                size={rs(25)}
                color={colors.white}
                style={styles.heroIcon}
              />
            </Pressable>

            <View style={styles.rightButtons}>
              <Pressable
                onPress={() => setSaved((current) => !current)}
                style={({ pressed }) => [styles.circularButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={saved ? "Remove saved pet" : "Save pet"}
              >
                <Ionicons
                  name={saved ? "heart" : "heart-outline"}
                  size={rs(24)}
                  color={saved ? colors.warning : colors.white}
                  style={styles.heroIcon}
                />
              </Pressable>
              <Pressable
                onPress={() => Alert.alert("Share", `Share ${animal.name}'s adoption profile.`)}
                style={({ pressed }) => [styles.circularButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Share pet"
              >
                <Ionicons
                  name="share-social-outline"
                  size={rs(23)}
                  color={colors.white}
                  style={styles.heroIcon}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.photoDots} pointerEvents="none">
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.photoDot, i === photoIndex ? styles.photoDotActive : null]}
              />
            ))}
          </View>

          <View style={styles.photoBadge}>
            <Ionicons name="camera-outline" size={rs(15)} color={colors.white} />
            <Text style={styles.photoBadgeText}>
              {photoIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>

        <View style={[styles.contentCard, { marginTop: -SHEET_OVERLAP }]}>
          <View style={styles.nameSection}>
            <View style={styles.nameStatusBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                  {animal.name}
                </Text>
                <SparkLines />
              </View>
              <View style={styles.statusBadge}>
                <Ionicons name="paw-outline" size={rs(14)} color={PRIMARY} />
                <Text style={styles.statusText}>Available for Adoption</Text>
              </View>
            </View>
            <Ionicons name="paw" size={rs(68)} color={colors.primarySoft} style={styles.pawWatermark} />
          </View>

          <View style={styles.quickFacts}>
            <FactItem icon="paw-outline" value={animal.type} label="Type" />
            <View style={styles.factDivider} />
            <FactItem icon="calendar-outline" value={animal.age} label="Age" />
            <View style={styles.factDivider} />
            <FactItem icon={getGenderIcon(animal.sex)} value={animal.sex} label="Gender" />
            <View style={styles.factDivider} />
            <FactItem
              icon="location-outline"
              value={animal.location}
              label="Location"
              subValue="2.3 km away"
              wide
            />
          </View>

          <View style={styles.aboutCard}>
            <View style={styles.aboutIcon}>
              <Ionicons name="heart-outline" size={rs(22)} color={PRIMARY_DARK} />
            </View>
            <View style={styles.aboutBody}>
              <Text style={styles.aboutTitle}>About {animal.name}</Text>
              <Text style={styles.aboutText}>{animal.story}</Text>
            </View>
            <DogHouseIllustration />
          </View>

          <View style={styles.personalityRow}>
            {displayTraits.map((trait, i) => (
              <Fragment key={trait}>
                {i > 0 ? <View style={styles.traitDivider} /> : null}
                <View style={styles.traitItem}>
                  <View style={styles.traitIconWrap}>
                    <Ionicons name={getPersonalityIcon(trait)} size={rs(24)} color={PRIMARY} />
                  </View>
                  <Text style={styles.traitText} numberOfLines={2}>
                    {trait}
                  </Text>
                </View>
              </Fragment>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <View style={[styles.infoCard, styles.healthCard]}>
              <View style={styles.infoCardTitleRow}>
                <Text style={styles.infoCardTitle}>Health</Text>
                <Ionicons name="pulse-outline" size={rs(19)} color={PRIMARY} />
              </View>
              <HealthRow label="Vaccinated" value={animal.vaccinated ? "Yes" : "No"} />
              <HealthRow label="Dewormed" value={animal.vaccinated ? "Yes" : "No"} />
              <HealthRow label="Sterilized" value={getSterilizedStatus(animal.age)} />
              <Pressable
                onPress={() => Alert.alert("Health Details", "Full health records coming soon.")}
                style={({ pressed }) => [styles.viewLink, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.viewLinkText}>View health details</Text>
                <Ionicons name="chevron-forward" size={rs(15)} color={PRIMARY} />
              </Pressable>
            </View>

            <View style={[styles.infoCard, styles.homeCard]}>
              <View style={styles.infoCardTitleRow}>
                <View style={styles.homeMiniIcon}>
                  <Ionicons name="home-outline" size={rs(18)} color={PRIMARY} />
                </View>
                <Text style={styles.infoCardTitle}>Ideal home</Text>
              </View>

              <View style={styles.homeFitList}>
                <HomeFitRow icon="ribbon-outline" label="Breed" value={animal.breed} />
                <HomeFitRow icon="color-palette-outline" label="Colour" value={animal.color} />
                <HomeFitRow icon="flash-outline" label="Energy" value={animal.energy} />
                <HomeFitRow icon="resize-outline" label="Size" value={animal.size} />
                <HomeFitRow icon="people-outline" label="Best for" value={animal.bestFor} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { minHeight: footerHeight, paddingBottom: footerBottomPadding }]}>
        <Pressable
          onPress={() => Alert.alert("Ask a Question", "Chat feature coming soon.")}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={rs(20)} color={PRIMARY} />
          <Text style={styles.outlineButtonText} numberOfLines={1} adjustsFontSizeToFit>
            Ask a Question
          </Text>
        </Pressable>
        <Pressable
          onPress={openApplication}
          style={({ pressed }) => [styles.filledButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Apply to adopt ${animal.name}`}
        >
          <Ionicons name="paw-outline" size={rs(20)} color={colors.white} />
          <Text style={styles.filledButtonText} numberOfLines={1} adjustsFontSizeToFit>
            Apply for Adoption
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.white,
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.white,
    flex: 1,
  },
  scroll: {
    backgroundColor: colors.white,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.72,
  },
  missingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: PAGE_PADDING,
  },
  missingTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    marginTop: vs(10),
  },
  fallbackButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    marginTop: vs(22),
    minHeight: TOUCH_TARGET + vs(6),
    paddingHorizontal: rs(24),
  },
  fallbackButtonText: {
    color: colors.white,
    fontSize: ms(15),
    fontWeight: "900",
  },
  heroSection: {
    backgroundColor: colors.primarySoft,
    height: HERO_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  heroScroll: {
    height: HERO_HEIGHT,
  },
  heroImage: {
    height: HERO_HEIGHT,
    width: SCREEN_WIDTH,
  },
  imageOverlay: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: rs(22),
    position: "absolute",
    right: 0,
    top: 0,
  },
  circularButton: {
    alignItems: "center",
    borderRadius: 999,
    elevation: 0,
    height: rs(46),
    justifyContent: "center",
    width: rs(46),
  },
  heroIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  rightButtons: {
    flexDirection: "row",
    gap: rs(8),
  },
  photoDots: {
    alignItems: "center",
    bottom: SHEET_OVERLAP + vs(8),
    flexDirection: "row",
    gap: rs(6),
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  photoDot: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    height: rs(6),
    width: rs(6),
  },
  photoDotActive: {
    backgroundColor: colors.white,
    width: rs(34),
  },
  photoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
    borderRadius: 999,
    bottom: SHEET_OVERLAP + vs(12),
    flexDirection: "row",
    gap: rs(6),
    paddingHorizontal: rs(10),
    paddingVertical: vs(5),
    position: "absolute",
    right: rs(34),
  },
  photoBadgeText: {
    color: colors.white,
    fontSize: ms(12),
    fontWeight: "800",
    letterSpacing: 0,
  },
  contentCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: rs(18),
    paddingTop: vs(22),
    position: "relative",
  },
  nameSection: {
    alignItems: "flex-start",
    flexDirection: "row",
    marginBottom: vs(17),
  },
  nameStatusBlock: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: rs(8),
  },
  name: {
    color: INK,
    flexShrink: 1,
    fontSize: ms(39, 0.35),
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: ms(46, 0.35),
  },
  sparkLines: {
    height: rs(30),
    marginTop: vs(2),
    position: "relative",
    width: rs(28),
  },
  sparkLine: {
    backgroundColor: HIGHLIGHT,
    borderRadius: 999,
    height: rs(4),
    position: "absolute",
    width: rs(18),
  },
  sparkLineTop: {
    left: rs(2),
    top: rs(3),
    transform: [{ rotate: "-48deg" }],
  },
  sparkLineMiddle: {
    left: rs(12),
    top: rs(16),
  },
  sparkLineBottom: {
    left: rs(5),
    top: rs(27),
    transform: [{ rotate: "36deg" }],
  },
  statusBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: rs(7),
    marginTop: vs(7),
    paddingHorizontal: rs(11),
    paddingVertical: vs(5),
  },
  statusText: {
    color: PRIMARY_DARK,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(18),
  },
  pawWatermark: {
    marginRight: rs(3),
    marginTop: vs(6),
    opacity: 0.8,
  },
  quickFacts: {
    alignItems: "stretch",
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: vs(20),
    minHeight: vs(92),
    overflow: "hidden",
  },
  factItem: {
    alignItems: "center",
    flex: 1,
    gap: vs(5),
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: rs(6),
    paddingVertical: vs(11),
  },
  factItemWide: {
    flex: 1.4,
    paddingHorizontal: rs(9),
  },
  factCopy: {
    alignItems: "center",
    minWidth: 0,
  },
  factValue: {
    color: INK,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
    textAlign: "center",
  },
  factLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(2),
    textAlign: "center",
  },
  factSubValue: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "600",
    lineHeight: ms(14),
    marginTop: vs(2),
    textAlign: "center",
  },
  factDivider: {
    backgroundColor: colors.border,
    marginVertical: vs(16),
    width: 1,
  },
  aboutCard: {
    alignItems: "flex-start",
    backgroundColor: SOFT_PANEL,
    borderRadius: 24,
    flexDirection: "row",
    gap: rs(12),
    marginBottom: vs(22),
    minHeight: vs(132),
    overflow: "hidden",
    paddingHorizontal: rs(13),
    paddingVertical: vs(15),
  },
  aboutIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.primarySoft,
    borderWidth: 1,
    borderRadius: 999,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  aboutBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: rs(2),
  },
  aboutTitle: {
    color: INK,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(21),
    marginBottom: vs(6),
  },
  aboutText: {
    color: INK,
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(20),
  },
  houseScene: {
    alignSelf: "stretch",
    minHeight: vs(104),
    position: "relative",
    width: rs(98),
  },
  tinyHeart: {
    backgroundColor: colors.primarySoft,
    borderRadius: 4,
    height: rs(8),
    left: rs(5),
    opacity: 0.9,
    position: "absolute",
    top: vs(30),
    transform: [{ rotate: "45deg" }],
    width: rs(8),
  },
  houseRoofBack: {
    backgroundColor: PRIMARY_DARK,
    borderRadius: 6,
    height: vs(35),
    position: "absolute",
    right: rs(3),
    top: vs(27),
    transform: [{ rotate: "34deg" }],
    width: rs(82),
  },
  houseBody: {
    backgroundColor: colors.primarySoft,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    bottom: vs(16),
    height: vs(60),
    position: "absolute",
    right: rs(11),
    width: rs(70),
  },
  houseDoor: {
    alignSelf: "center",
    backgroundColor: PRIMARY_DARK,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    bottom: 0,
    height: vs(40),
    position: "absolute",
    width: rs(31),
  },
  houseRoofFront: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    height: vs(31),
    position: "absolute",
    right: rs(0),
    top: vs(35),
    transform: [{ rotate: "0deg" }],
    width: rs(89),
  },
  houseChimney: {
    backgroundColor: HIGHLIGHT,
    borderRadius: 2,
    height: vs(6),
    position: "absolute",
    right: rs(56),
    top: vs(50),
    width: rs(10),
  },
  foodBowl: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    bottom: vs(15),
    height: vs(25),
    justifyContent: "center",
    left: rs(8),
    position: "absolute",
    width: rs(45),
  },
  ball: {
    alignItems: "center",
    backgroundColor: HIGHLIGHT,
    borderRadius: 999,
    bottom: vs(7),
    height: rs(34),
    justifyContent: "center",
    position: "absolute",
    right: rs(3),
    width: rs(34),
  },
  ballStripe: {
    borderColor: colors.white,
    borderRadius: 999,
    borderRightWidth: 2,
    height: rs(28),
    transform: [{ rotate: "28deg" }],
    width: rs(20),
  },
  grassLeft: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    bottom: vs(11),
    height: vs(13),
    left: rs(2),
    position: "absolute",
    transform: [{ rotate: "-18deg" }],
    width: rs(4),
  },
  grassRight: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    bottom: vs(8),
    height: vs(14),
    position: "absolute",
    right: rs(39),
    transform: [{ rotate: "20deg" }],
    width: rs(4),
  },
  personalityRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: vs(22),
  },
  traitItem: {
    alignItems: "center",
    flex: 1,
    gap: vs(7),
    justifyContent: "center",
    minHeight: vs(72),
    minWidth: 0,
    paddingHorizontal: rs(5),
  },
  traitIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(44),
    justifyContent: "center",
    width: rs(44),
  },
  traitText: {
    color: INK,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(16),
    minHeight: ms(32),
    textAlign: "center",
  },
  traitDivider: {
    backgroundColor: colors.border,
    height: vs(58),
    width: 1,
  },
  infoGrid: {
    flexDirection: "row",
    gap: rs(12),
  },
  infoCard: {
    borderRadius: 22,
    flex: 1,
    minHeight: vs(158),
    paddingHorizontal: rs(12),
    paddingTop: vs(14),
    paddingBottom: vs(13),
  },
  healthCard: {
    backgroundColor: SOFT_PANEL,
  },
  homeCard: {
    backgroundColor: colors.background,
  },
  infoCardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(7),
    marginBottom: vs(13),
  },
  infoCardTitle: {
    color: INK,
    flexShrink: 1,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  healthRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(7),
    marginBottom: vs(8),
  },
  healthLabel: {
    color: INK,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
  },
  healthValue: {
    color: PRIMARY,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(17),
  },
  healthValueNo: {
    color: INK,
  },
  viewLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(4),
    marginTop: "auto",
    minHeight: vs(24),
  },
  viewLinkText: {
    color: PRIMARY,
    flexShrink: 1,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  homeMiniIcon: {
    alignItems: "center",
    height: rs(24),
    justifyContent: "center",
    width: rs(24),
  },
  homeFitList: {
    gap: vs(8),
  },
  homeFitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
  },
  homeFitIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(28),
    justifyContent: "center",
    width: rs(28),
  },
  homeFitCopy: {
    flex: 1,
    minWidth: 0,
  },
  homeFitLabel: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "600",
    lineHeight: ms(13),
  },
  homeFitValue: {
    color: INK,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(16),
  },
  footer: {
    backgroundColor: colors.white,
    flexDirection: "row",
    gap: rs(10),
    paddingHorizontal: rs(18),
    paddingTop: vs(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  outlineButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: PRIMARY,
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    minHeight: FOOTER_BUTTON_HEIGHT,
    minWidth: 0,
    paddingHorizontal: rs(9),
  },
  outlineButtonText: {
    color: PRIMARY,
    flexShrink: 1,
    fontSize: ms(14),
    fontWeight: "900",
    lineHeight: ms(20),
    textAlign: "center",
  },
  filledButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 16,
    flex: 1,
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    minHeight: FOOTER_BUTTON_HEIGHT,
    minWidth: 0,
    paddingHorizontal: rs(9),
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  filledButtonText: {
    color: colors.white,
    flexShrink: 1,
    fontSize: ms(14),
    fontWeight: "900",
    lineHeight: ms(20),
    textAlign: "center",
  },
});
