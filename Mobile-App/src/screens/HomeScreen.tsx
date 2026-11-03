import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "../theme/colors";
import {
  clamp,
  CONTENT_MAX_WIDTH,
  ms,
  PAGE_PADDING,
  rs,
  screen,
  vs,
} from "../theme/responsive";
import { useAuth } from "@/src/context/AuthContext";
import { adoptionAnimals } from "../data/adoptionAnimals";

type AdoptableAnimal = {
  id: string;
  name: string;
  details: string;
  source: ImageSourcePropType;
};

type AdoptionAnimalNode = {
  animal: AdoptableAnimal;
  next?: AdoptionAnimalNode;
};

type AdoptionCarouselItem = {
  animal: AdoptableAnimal;
  carouselKey: string;
};

type MotionPressableProps = Omit<PressableProps, "style"> & {
  children: React.ReactNode;
  haptic?: boolean;
  pressOpacity?: number;
  pressScale?: number;
  pressTranslateY?: number;
  style?: StyleProp<ViewStyle>;
};

const adoptableAnimals: AdoptableAnimal[] = adoptionAnimals.map((animal) => ({
  id: animal.id,
  name: animal.name,
  details: `${animal.personality[0]} ${animal.type.toLowerCase()}`,
  source: animal.image,
}));

const buildAdoptionCircle = (animals: AdoptableAnimal[]) => {
  const nodes: AdoptionAnimalNode[] = animals.map((animal) => ({ animal }));

  nodes.forEach((node, index) => {
    node.next = nodes[(index + 1) % nodes.length];
  });

  return nodes[0];
};

const takeAdoptionBatch = (
  startNode: AdoptionAnimalNode,
  count: number,
  startIndex: number
) => {
  const items: AdoptionCarouselItem[] = [];
  let currentNode = startNode;

  for (let index = 0; index < count; index += 1) {
    items.push({
      animal: currentNode.animal,
      carouselKey: `${currentNode.animal.name}-${startIndex + index}`,
    });

    currentNode = currentNode.next ?? startNode;
  }

  return {
    items,
    nextNode: currentNode,
  };
};

const ADOPTION_BATCH_SIZE = 8;
const ANIMAL_CARD_HEIGHT = clamp(screen.height * 0.2, 148, 190);
const ANIMAL_CARD_WIDTH = clamp(screen.width * 0.4, 142, 178);
const ANIMAL_CARD_GAP = rs(12);
const HERO_HEIGHT = clamp(screen.height * 0.32, 254, 330);
const USE_NATIVE_DRIVER = Platform.OS !== "web";

const adoptionCircleHead = buildAdoptionCircle(adoptableAnimals);

const initialAdoptionBatch = takeAdoptionBatch(
  adoptionCircleHead,
  ADOPTION_BATCH_SIZE * 2,
  0
);

const welfarePriorities: {
  title: string;
  icon: ImageSourcePropType;
  action: "report-stray" | "report-cruelty";
}[] = [
  {
    title: "Report stray animals",
    icon: require("../../assets/UI/icons/report stray icon.png"),
    action: "report-stray",
  },
  {
    title: "Report animal cruelty",
    icon: require("../../assets/UI/icons/cruelty report icon.png"),
    action: "report-cruelty",
  },
];

const triggerPressHaptic = () => {
  void Haptics.selectionAsync().catch(() => undefined);
};

const MotionPressable = ({
  children,
  haptic = false,
  onPressIn,
  onPressOut,
  pressOpacity = 0.92,
  pressScale = 0.965,
  pressTranslateY = 2,
  style,
  ...pressableProps
}: MotionPressableProps) => {
  const pressProgress = useRef(new Animated.Value(0)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressProgress, {
      toValue,
      damping: 11,
      stiffness: 260,
      mass: 0.55,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: pressProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, pressOpacity],
          }),
          transform: [
            {
              translateY: pressProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, pressTranslateY],
              }),
            },
            {
              scale: pressProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, pressScale],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        {...pressableProps}
        onPressIn={(event) => {
          if (haptic) {
            triggerPressHaptic();
          }

          animatePress(1);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animatePress(0);
          onPressOut?.(event);
        }}
        style={styles.pressableFill}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

const HomeScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const isLoggedIn = Boolean(user);
  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const greetingScale = useRef(new Animated.Value(0.96)).current;
  const greetingTranslateY = useRef(new Animated.Value(28)).current;
  const accentFloat = useRef(new Animated.Value(0)).current;
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const heroImageMotion = useRef(new Animated.Value(0)).current;
  const heroShine = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(0)).current;
  const priorityEntrances = useRef(
    welfarePriorities.map(() => new Animated.Value(0))
  ).current;
  const sectionEntrance = useRef(new Animated.Value(0)).current;
  const carouselEntrance = useRef(new Animated.Value(0)).current;
  const nextAdoptionNode = useRef(initialAdoptionBatch.nextNode);
  const adoptionItemIndex = useRef(initialAdoptionBatch.items.length);
  const [adoptionItems, setAdoptionItems] = useState(initialAdoptionBatch.items);

  const handlePriorityPress = (action: (typeof welfarePriorities)[number]["action"]) => {
    if (action === "report-stray") {
      router.push("/report-stray");
      return;
    }

    if (action === "report-cruelty") {
      Alert.alert(
        "Coming soon",
        "Cruelty reporting can be added once the SPCA workflow is ready."
      );
      return;
    }

  };

  const handleHeroPress = () => {
    router.push("/claim-ownership" as Parameters<typeof router.push>[0]);
  };

  const openAdoptionList = () => {
    router.push("/adoption");
  };

  const openAnimalProfile = (animalId: string) => {
    router.push(`/adoption/${animalId}`);
  };

  const extendAdoptionCarousel = () => {
    const nextBatch = takeAdoptionBatch(
      nextAdoptionNode.current,
      ADOPTION_BATCH_SIZE,
      adoptionItemIndex.current
    );

    nextAdoptionNode.current = nextBatch.nextNode;
    adoptionItemIndex.current += nextBatch.items.length;
    setAdoptionItems((currentItems) => [...currentItems, ...nextBatch.items]);
  };

  useFocusEffect(
    useCallback(() => {
      greetingOpacity.setValue(0);
      greetingScale.setValue(0.9);
      greetingTranslateY.setValue(36);
      accentFloat.setValue(0);
      heroEntrance.setValue(0);
      heroImageMotion.setValue(0);
      heroShine.setValue(0);
      ctaPulse.setValue(0);
      sectionEntrance.setValue(0);
      carouselEntrance.setValue(0);
      priorityEntrances.forEach((progress) => progress.setValue(0));

      const entranceAnimation = Animated.sequence([
        Animated.delay(70),
        Animated.parallel([
          Animated.timing(greetingOpacity, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(greetingTranslateY, {
            toValue: 0,
            damping: 13,
            stiffness: 138,
            mass: 0.72,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(greetingScale, {
            toValue: 1,
            damping: 12,
            stiffness: 150,
            mass: 0.7,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.sequence([
            Animated.delay(70),
            Animated.spring(heroEntrance, {
              toValue: 1,
              damping: 12,
              stiffness: 122,
              mass: 0.78,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.sequence([
            Animated.delay(190),
            Animated.stagger(
              78,
              priorityEntrances.map((progress) =>
                Animated.spring(progress, {
                  toValue: 1,
                  damping: 10,
                  stiffness: 152,
                  mass: 0.62,
                  useNativeDriver: USE_NATIVE_DRIVER,
                })
              )
            ),
          ]),
          Animated.sequence([
            Animated.delay(360),
            Animated.timing(sectionEntrance, {
              toValue: 1,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.sequence([
            Animated.delay(470),
            Animated.spring(carouselEntrance, {
              toValue: 1,
              damping: 13,
              stiffness: 124,
              mass: 0.7,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]),
      ]);

      const ambientAnimation = Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(accentFloat, {
              toValue: 1,
              duration: 4200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(accentFloat, {
              toValue: 0,
              duration: 4200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(heroImageMotion, {
              toValue: 1,
              duration: 7200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(heroImageMotion, {
              toValue: 0,
              duration: 7200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.delay(1200),
            Animated.timing(heroShine, {
              toValue: 1,
              duration: 1180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(2100),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(ctaPulse, {
              toValue: 1,
              duration: 780,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(ctaPulse, {
              toValue: 0,
              duration: 780,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(760),
          ])
        ),
      ]);

      entranceAnimation.start();
      ambientAnimation.start();

      return () => {
        entranceAnimation.stop();
        ambientAnimation.stop();
      };
    }, [
      accentFloat,
      carouselEntrance,
      ctaPulse,
      greetingOpacity,
      greetingScale,
      greetingTranslateY,
      heroEntrance,
      heroImageMotion,
      heroShine,
      priorityEntrances,
      sectionEntrance,
    ])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <Animated.Image
        source={require("../../assets/top-left.png")}
        style={[
          styles.topLeftAccent,
          {
            opacity: accentFloat.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.12, 0.2, 0.12],
            }),
            transform: [
              {
                translateY: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, vs(10)],
                }),
              },
              {
                rotate: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-8deg", "3deg"],
                }),
              },
              {
                scale: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.06],
                }),
              },
            ],
          },
        ]}
        resizeMode="contain"
      />
      <Animated.Image
        source={require("../../assets/top-right.png")}
        style={[
          styles.topRightAccent,
          {
            opacity: accentFloat.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.12, 0.19, 0.12],
            }),
            transform: [
              {
                translateY: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [vs(4), -vs(8)],
                }),
              },
              {
                rotate: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["7deg", "-4deg"],
                }),
              },
              {
                scale: accentFloat.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.04, 0.98],
                }),
              },
            ],
          },
        ]}
        resizeMode="contain"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Animated.View
          style={[
            styles.greetingBlock,
            {
              opacity: greetingOpacity,
              transform: [{ translateY: greetingTranslateY }, { scale: greetingScale }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.brandTextWrap}>
              <Text style={styles.eyebrow}>{isLoggedIn ? `Hello ${firstName}` : "Welcome"}</Text>
              <Text style={styles.title}>Animal Welfare Hub</Text>

            </View>
          </View>
        </Animated.View>

      </View>

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: heroEntrance,
            transform: [
              {
                translateY: heroEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [vs(42), 0],
                }),
              },
              {
                scale: heroEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.91, 1],
                }),
              },
            ],
          }}
        >
          <MotionPressable
            onPress={handleHeroPress}
            haptic
            pressOpacity={0.96}
            pressScale={0.975}
            pressTranslateY={3}
            style={styles.heroPanel}
            accessibilityRole="button"
            accessibilityLabel="Find your lost pet"
          >
            <View style={styles.heroBackground}>
              <Animated.Image
                source={require("../../assets/animals/cats/107.jpeg")}
                style={[
                  styles.heroImage,
                  {
                    transform: [
                      {
                        translateX: heroImageMotion.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-rs(16), rs(6)],
                        }),
                      },
                      {
                        translateY: heroImageMotion.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-vs(22), -vs(7)],
                        }),
                      },
                      {
                        scale: heroImageMotion.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.11, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
                resizeMode="cover"
              />
              <View style={styles.heroShade} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.heroLightBand,
                  {
                    opacity: heroShine.interpolate({
                      inputRange: [0, 0.2, 0.56, 1],
                      outputRange: [0, 0.24, 0.08, 0],
                    }),
                    transform: [
                      {
                        translateX: heroShine.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-screen.width * 0.75, screen.width * 0.85],
                        }),
                      },
                      { rotate: "18deg" },
                    ],
                  },
                ]}
              />
              <View style={styles.heroContent}>
                <Animated.View
                  style={[
                    styles.heroTopRow,
                    {
                      opacity: heroEntrance.interpolate({
                        inputRange: [0, 0.45, 1],
                        outputRange: [0, 0, 1],
                      }),
                      transform: [
                        {
                          translateY: heroEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-vs(10), 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.heroPill}>
                    <Ionicons name="heart-outline" size={16} color={colors.warning} />
                    <Text style={styles.heroPillText}>Animal Care</Text>
                  </View>
                  <View style={styles.heroTrustBadge}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.white} />
                    <Text style={styles.heroTrustText}>SPCA</Text>
                  </View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.heroCopy,
                    {
                      opacity: heroEntrance.interpolate({
                        inputRange: [0, 0.34, 1],
                        outputRange: [0, 0, 1],
                      }),
                      transform: [
                        {
                          translateY: heroEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [vs(24), 0],
                          }),
                        },
                        {
                          scale: heroEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.heroTitle}>Not Just Humans Need A Home.</Text>
                  <Text style={styles.heroSubtitle}>
                    Willing to adopt a puppy? Or reporting a Stray Animal? You are in the right place.
                  </Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.heroFooter,
                    {
                      opacity: heroEntrance.interpolate({
                        inputRange: [0, 0.54, 1],
                        outputRange: [0, 0, 1],
                      }),
                      transform: [
                        {
                          translateY: heroEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [vs(22), 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.heroFooterCopy}>
                    <Text style={styles.heroFooterLabel}>Find your lost pet</Text>
                  </View>
                  <Animated.View
                    style={[
                      styles.heroArrow,
                      {
                        transform: [
                          {
                            translateX: ctaPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, rs(4)],
                            }),
                          },
                          {
                            scale: ctaPulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.08],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={20} color={colors.primaryDark} />
                  </Animated.View>
                </Animated.View>
              </View>
            </View>
          </MotionPressable>
        </Animated.View>

        
        <View style={styles.prioritySection}>
          <View style={styles.priorityGrid}>
            {welfarePriorities.map((priority, index) => (
              <Animated.View
                key={priority.title}
                style={[
                  styles.priorityMotionItem,
                  {
                    opacity: priorityEntrances[index],
                    transform: [
                      {
                        translateY: priorityEntrances[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [vs(30), 0],
                        }),
                      },
                      {
                        scale: priorityEntrances[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.86, 1],
                        }),
                      },
                      {
                        rotate: priorityEntrances[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: ["-5deg", "0deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MotionPressable
                  onPress={() => handlePriorityPress(priority.action)}
                  haptic
                  pressOpacity={0.95}
                  pressScale={0.94}
                  pressTranslateY={3}
                  style={styles.priorityItem}
                  accessibilityRole="button"
                  accessibilityLabel={priority.title}
                >
                  <View style={styles.priorityIconWrap}>
                    <Image source={priority.icon} style={styles.priorityIconImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.priorityTitle}>{priority.title}</Text>
                </MotionPressable>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: sectionEntrance,
              transform: [
                {
                  translateY: sectionEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [vs(18), 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sectionHeaderCopy}>
            <View style={styles.sectionTitleRow}>
              <Image
                source={require("../../assets/UI/icons/adoption icon.png")}
                style={styles.sectionTitleIcon}
                resizeMode="contain"
              />
              <Text style={styles.sectionTitle}>Available for Adoption</Text>
            </View>
            <Text style={styles.sectionCaption}>Meet a few animals waiting for homes.</Text>
          </View>
          <Pressable
            onPress={openAdoptionList}
            style={({ pressed }) => [styles.sectionLink, pressed ? styles.sectionHeaderPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="View all animals available for adoption"
          >
            <Text style={styles.sectionLinkText}>View all</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={{
            opacity: carouselEntrance,
            transform: [
              {
                translateY: carouselEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [vs(22), 0],
                }),
              },
            ],
          }}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.adoptionList}
            data={adoptionItems}
            keyExtractor={(item) => item.carouselKey}
            onEndReached={extendAdoptionCarousel}
            onEndReachedThreshold={0.8}
            renderItem={({ item }) => {
              const animal = item.animal;

              return (
                <Pressable
                  onPress={() => openAnimalProfile(animal.id)}
                  style={styles.animalCard}
                  accessibilityRole="button"
                  accessibilityLabel={`${animal.name}, ${animal.details}`}
                >
                  <Image source={animal.source} style={styles.animalImage} resizeMode="cover" />
                  <View style={styles.animalCopy}>
                    <Text style={styles.animalName}>{animal.name}</Text>
                    <Text style={styles.animalDetails}>{animal.details}</Text>
                  </View>
                </Pressable>
              );
            }}
            style={styles.adoptionScroller}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  pressableFill: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topLeftAccent: {
    height: vs(120),
    left: -rs(64),
    opacity: 0.18,
    position: "absolute",
    top: -vs(36),
    width: rs(170),
  },
  topRightAccent: {
    height: vs(128),
    opacity: 0.16,
    position: "absolute",
    right: -rs(42),
    top: -vs(54),
    width: rs(160),
  },
  topBar: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: CONTENT_MAX_WIDTH + PAGE_PADDING * 2,
    paddingBottom: vs(12),
    paddingHorizontal: PAGE_PADDING,
    width: "100%",
  },
  greetingBlock: {
    flex: 1,
    paddingRight: rs(12),
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(12),
  },
  logo: {
    height: rs(48),
    width: rs(48),
  },
  brandTextWrap: {
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
    fontSize: ms(22),
    fontWeight: "800",
    lineHeight: ms(27),
    textAlign: "left",
  },
  content: {
    alignSelf: "center",
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(6),
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  heroPanel: {
    backgroundColor: colors.charcoal,
    borderRadius: 0,
    marginHorizontal: -PAGE_PADDING,
    marginBottom: vs(10),
    marginTop: vs(8),
    minHeight: HERO_HEIGHT,
    overflow: "hidden",
  },
  heroBackground: {
    minHeight: HERO_HEIGHT,
    width: "100%",
  },
  heroImage: {
    height: "116%",
    left: "-8%",
    position: "absolute",
    top: "-8%",
    width: "118%",
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6, 47, 75, 0.38)",
  },
  heroLightBand: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    bottom: -vs(60),
    left: 0,
    position: "absolute",
    top: -vs(60),
    width: rs(58),
  },
  heroContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
    minHeight: HERO_HEIGHT,
    padding: rs(13),
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "space-between",
    width: "100%",
  },
  heroPill: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(6),
    paddingHorizontal: rs(9),
    paddingVertical: vs(5),
  },
  heroPillText: {
    color: colors.warning,
    fontSize: ms(12),
    fontWeight: "800",
  },
  heroTrustBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(5),
    paddingHorizontal: rs(8),
    paddingVertical: vs(5),
  },
  heroTrustText: {
    color: colors.white,
    fontSize: ms(11),
    fontWeight: "800",
  },
  heroCopy: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: rs(8),
    width: "100%",
  },
  heroTitle: {
    color: colors.white,
    fontSize: ms(24),
    fontWeight: "800",
    lineHeight: ms(30),
    maxWidth: 340,
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#DDECF5",
    fontSize: ms(13),
    fontWeight: "600",
    lineHeight: ms(19),
    marginTop: vs(8),
    maxWidth: 340,
    textAlign: "center",
  },
  heroFooter: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: vs(12),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
    width: "100%",
  },
  heroFooterCopy: {
    flex: 1,
    paddingRight: rs(10),
  },
  heroFooterLabel: {
    color: colors.primaryDark,
    fontSize: ms(19),
    fontWeight: "900",
    lineHeight: ms(24),
  },
  heroArrow: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: rs(36),
    justifyContent: "center",
    width: rs(36),
  },
  prioritySection: {
    marginBottom: vs(10),
    justifyContent: "center",
  },
  priorityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
    justifyContent: "center",
  },
  priorityMotionItem: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: rs(100),
    maxWidth: "50%",
  },
  priorityItem: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: vs(104),
    padding: rs(10),
    width: "100%",
  },
  priorityIconWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  priorityIconImage: {
    height: rs(48),
    width: rs(48),
  },
  priorityTitle: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(16),
    marginTop: vs(7),
    textAlign: "center",
  },
  priorityBody: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(3),
    textAlign: "center",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(8),
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: rs(10),
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(7),
  },
  sectionTitleIcon: {
    height: rs(25),
    width: rs(25),
  },
  sectionHeaderPressed: {
    opacity: 0.78,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: ms(18),
    fontWeight: "800",
  },
  sectionCaption: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    marginTop: vs(2),
  },
  sectionLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  sectionLinkText: {
    color: colors.primaryDark,
    fontSize: ms(12),
    fontWeight: "800",
  },
  adoptionList: {
    gap: ANIMAL_CARD_GAP,
    paddingRight: PAGE_PADDING,
  },
  adoptionScroller: {
    height: ANIMAL_CARD_HEIGHT,
  },
  animalCard: {
    alignItems: "center",
    backgroundColor: colors.charcoal,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: ANIMAL_CARD_HEIGHT,
    overflow: "hidden",
    width: ANIMAL_CARD_WIDTH,
  },
  animalImage: {
    height: "100%",
    width: "100%",
  },
  animalCopy: {
    backgroundColor: "rgba(16, 24, 32, 0.68)",
    bottom: 0,
    left: 0,
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
    position: "absolute",
    right: 0,
  },
  animalName: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(16),
  },
  animalDetails: {
    color: "#DDECF5",
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(14),
    marginTop: vs(1),
  },
});
