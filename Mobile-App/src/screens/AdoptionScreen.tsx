import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  adoptionAnimals,
  shelterAnimalToAdoptionAnimal,
  type AdoptionAnimal,
  type AnimalType,
} from "../data/adoptionAnimals";
import { getShelterAnimals } from "../services/api";
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

type AdoptionCategory = "All" | "Dogs" | "Cats" | "Others";
type AgeFilter =
  | "Any age"
  | "Under 1 year"
  | "1–2 years"
  | "3–7 years"
  | "8+ years";
type BreedListingFilter = "any" | "single" | "mixed" | "unspecified";
type SortOption =
  | "Recommended"
  | "Name: A–Z"
  | "Species: A–Z"
  | "Gender: A–Z"
  | "Size: small to large"
  | "Age: youngest first"
  | "Age: oldest first"
  | "Breed: A–Z";

type DiscoveryFilters = {
  category: AdoptionCategory;
  sex: string;
  size: string;
  age: AgeFilter;
  breed: string;
  breedListing: BreedListingFilter;
  familyFitOnly: boolean;
  sort: SortOption;
};

type CategoryOption = {
  label: AdoptionCategory;
  image?: ImageSourcePropType;
};

const categories: CategoryOption[] = [
  { label: "All" },
  {
    label: "Dogs",
    image: require("../../assets/adoption_filter_icons/dogs_filter_icon.png"),
  },
  {
    label: "Cats",
    image: require("../../assets/adoption_filter_icons/cats_filter_icon.png"),
  },
  {
    label: "Others",
    image: require("../../assets/adoption_filter_icons/others_filter_icon.png"),
  },
];

const ALL_VALUE = "Any";
const EXCLUDED_BREED_FILTERS = new Set(["sjbsi", "gjcbcm", "sjbsj"]);
const DEFAULT_FILTERS: DiscoveryFilters = {
  category: "All",
  sex: ALL_VALUE,
  size: ALL_VALUE,
  age: "Any age",
  breed: ALL_VALUE,
  breedListing: "any",
  familyFitOnly: false,
  sort: "Recommended",
};
const ageOptions: AgeFilter[] = [
  "Any age",
  "Under 1 year",
  "1–2 years",
  "3–7 years",
  "8+ years",
];
const breedListingOptions: { label: string; value: BreedListingFilter }[] = [
  { label: "All breed listings", value: "any" },
  { label: "Pure / single breed listed", value: "single" },
  { label: "Mixed breed", value: "mixed" },
  { label: "Unspecified", value: "unspecified" },
];
const sortOptions: SortOption[] = [
  "Recommended",
  "Name: A–Z",
  "Species: A–Z",
  "Gender: A–Z",
  "Size: small to large",
  "Age: youngest first",
  "Age: oldest first",
  "Breed: A–Z",
];
const EXTRA_BREED_OPTIONS = [
  "French Bulldog",
  "Golden Retriever",
  "Labrador Retriever",
  "German Shepherd",
  "Poodle",
  "Dachshund",
  "Beagle",
  "Rottweiler",
  "Bulldog",
  "Ragdoll",
  "Maine Coon",
  "Devon Rex",
  "Exotic Shorthair",
  "Persian",
  "Abyssinian",
  "Scottish Fold",
  "Sphynx",
  "Siberian",
];
const BREED_MATCH_ALIASES: Record<string, string[]> = {
  "french bulldog": ["french bulldog", "french bulldogs", "frenchie bulldog"],
  "golden retriever": [
    "golden retriever",
    "golden retrievers",
    "golden retriever dog",
  ],
  "labrador retriever": [
    "labrador retriever",
    "labrador retrievers",
    "labrador",
  ],
  "german shepherd": [
    "german shepherd",
    "german shepherds",
    "german shepherd dog",
    "shepherd",
  ],
  poodle: [
    "poodle",
    "poodles",
    "toy poodle",
    "miniature poodle",
    "standard poodle",
  ],
  dachshund: ["dachshund", "dachshunds", "sausage dog"],
  beagle: ["beagle", "beagles"],
  rottweiler: ["rottweiler", "rottweilers"],
  bulldog: ["bulldog", "bulldogs", "english bulldog", "american bulldog"],
  ragdoll: ["ragdoll", "ragdolls"],
  "maine coon": ["maine coon", "maine coons"],
  "devon rex": ["devon rex", "devon rexes"],
  "exotic shorthair": ["exotic shorthair", "exotic shorthairs", "exotic"],
  persian: ["persian", "persians"],
  abyssinian: ["abyssinian", "abyssinians"],
  "scottish fold": ["scottish fold", "scottish folds"],
  sphynx: ["sphynx", "sphynxes"],
  siberian: ["siberian", "siberians"],
};
const BREED_SPECIES_MAP: Record<string, "Dog" | "Cat"> = {
  "french bulldog": "Dog",
  "golden retriever": "Dog",
  "labrador retriever": "Dog",
  "german shepherd": "Dog",
  poodle: "Dog",
  dachshund: "Dog",
  beagle: "Dog",
  rottweiler: "Dog",
  bulldog: "Dog",
  ragdoll: "Cat",
  "maine coon": "Cat",
  "devon rex": "Cat",
  "exotic shorthair": "Cat",
  persian: "Cat",
  abyssinian: "Cat",
  "scottish fold": "Cat",
  sphynx: "Cat",
  siberian: "Cat",
};

const HERO_HEIGHT = clamp(screen.height * 0.18, 150, 190);
const PET_GRID_GAP = rs(9);
const PETS_PER_PAGE = 12;
const HERO_TINT = "#D3EAF7";

function matchesCategory(animal: AdoptionAnimal, category: AdoptionCategory) {
  if (category === "Dogs") {
    return animal.type === "Dog";
  }

  if (category === "Cats") {
    return animal.type === "Cat";
  }

  if (category === "Others") {
    return animal.type !== "Dog" && animal.type !== "Cat";
  }

  return true;
}

function normalizeBreedValue(breed: string) {
  return breed.trim().replace(/\s+/g, " ").toLowerCase();
}

function isExcludedBreedValue(breed: string) {
  return EXCLUDED_BREED_FILTERS.has(normalizeBreedValue(breed));
}

function uniqueAnimalValues(
  animals: AdoptionAnimal[],
  field: "sex" | "size" | "breed",
) {
  return Array.from(
    new Set(
      animals
        .map((animal) => animal[field].trim())
        .filter(
          (value) =>
            Boolean(value) &&
            !(field === "breed" && isExcludedBreedValue(value)),
        ),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getAgeInMonths(age: string) {
  const match = age
    .toLowerCase()
    .match(/(\d+(?:\.\d+)?)\s*-?\s*(week|wk|month|mo|year|yr)s?/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "week" || unit === "wk") {
    return value / 4.345;
  }

  return unit === "year" || unit === "yr" ? value * 12 : value;
}

function matchesAge(age: string, ageFilter: AgeFilter) {
  if (ageFilter === "Any age") {
    return true;
  }

  const months = getAgeInMonths(age);
  if (months === null) {
    return false;
  }

  if (ageFilter === "Under 1 year") {
    return months < 12;
  }

  if (ageFilter === "1–2 years") {
    return months >= 12 && months < 36;
  }

  if (ageFilter === "3–7 years") {
    return months >= 36 && months < 96;
  }

  return months >= 96;
}

function getBreedListing(breed: string): Exclude<BreedListingFilter, "any"> {
  const normalizedBreed = breed.trim().toLowerCase();

  if (
    !normalizedBreed ||
    /\b(unknown|unspecified|not sure)\b/.test(normalizedBreed)
  ) {
    return "unspecified";
  }

  if (/\b(mix|mixed|cross|cross[ -]?breed|hybrid|x)\b/.test(normalizedBreed)) {
    return "mixed";
  }

  if (
    /\b(long[- ]?hair|long[- ]?haired|short[- ]?hair|short[- ]?haired|medium[- ]?hair|shorthair|mediumhair|longhair)\b/.test(
      normalizedBreed,
    )
  ) {
    return "single";
  }

  return "single";
}

function normalizeBreedKey(breed: string) {
  return normalizeBreedValue(breed)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getBreedMatchTerms(breed: string) {
  const normalizedBreed = normalizeBreedValue(breed);

  if (!normalizedBreed) {
    return [];
  }

  const aliases = BREED_MATCH_ALIASES[normalizedBreed] ?? [normalizedBreed];
  const terms = new Set<string>();

  for (const alias of aliases) {
    const key = normalizeBreedKey(alias);
    if (!key) {
      continue;
    }

    terms.add(key);
    terms.add(key.replace(/\s+/g, ""));

    for (const token of key.split(/\s+/).filter(Boolean)) {
      if (token.length > 2) {
        terms.add(token);
      }
    }
  }

  return Array.from(terms);
}

function getBreedSpecies(breed: string): "Dog" | "Cat" | null {
  const normalizedBreed = normalizeBreedValue(breed);

  if (!normalizedBreed) {
    return null;
  }

  if (BREED_SPECIES_MAP[normalizedBreed]) {
    return BREED_SPECIES_MAP[normalizedBreed];
  }

  const breedTerms = getBreedMatchTerms(normalizedBreed);

  for (const [knownBreed, species] of Object.entries(BREED_SPECIES_MAP)) {
    const knownTerms = getBreedMatchTerms(knownBreed);
    if (knownTerms.some((term) => breedTerms.includes(term))) {
      return species as "Dog" | "Cat";
    }
  }

  return null;
}

function getBreedDisplayLabel(breed: string) {
  const species = getBreedSpecies(breed);
  if (!species) {
    return breed;
  }

  return `${breed} ${species === "Dog" ? "dogs" : "cats"}`;
}

function matchesBreedSelection(
  animalBreed: string,
  selectedBreed: string,
  animalType?: AnimalType,
) {
  if (selectedBreed === ALL_VALUE) {
    return true;
  }

  const normalizedFilter = normalizeBreedValue(selectedBreed);
  const normalizedBreed = normalizeBreedValue(animalBreed);
  const selectedSpecies = getBreedSpecies(selectedBreed);

  if (
    !normalizedFilter ||
    !normalizedBreed ||
    isExcludedBreedValue(selectedBreed) ||
    isExcludedBreedValue(animalBreed)
  ) {
    return false;
  }

  if (selectedSpecies && animalType && animalType !== selectedSpecies) {
    return false;
  }

  const filterTerms = getBreedMatchTerms(selectedBreed);
  const animalTerms = getBreedMatchTerms(animalBreed);

  if (!filterTerms.length || !animalTerms.length) {
    return (
      normalizedBreed === normalizedFilter ||
      normalizedBreed.includes(normalizedFilter) ||
      normalizedFilter.includes(normalizedBreed)
    );
  }

  return filterTerms.some((term) => {
    if (
      term === normalizedBreed ||
      normalizedBreed.includes(term) ||
      term.includes(normalizedBreed)
    ) {
      return true;
    }

    if (animalTerms.includes(term)) {
      return true;
    }

    return animalTerms.some((animalTerm) => {
      if (
        animalTerm === term ||
        animalTerm.includes(term) ||
        term.includes(animalTerm)
      ) {
        return true;
      }

      const filterTokens = term.split(/\s+/).filter(Boolean);
      const animalTokens = animalTerm.split(/\s+/).filter(Boolean);

      return filterTokens.some(
        (token) => token.length > 2 && animalTokens.includes(token),
      );
    });
  });
}

function isFamilyFitDog(animal: AdoptionAnimal) {
  if (animal.type !== "Dog") {
    return false;
  }

  const shelterDescription = [
    animal.bestFor,
    animal.story,
    ...animal.personality,
  ]
    .join(" ")
    .toLowerCase();

  return /\b(family|families|children|kids)\b/.test(shelterDescription);
}

function sizeRank(size: string) {
  const normalizedSize = size.toLowerCase();

  if (normalizedSize.includes("small")) {
    return 1;
  }

  if (normalizedSize.includes("medium")) {
    return 2;
  }

  if (normalizedSize.includes("large")) {
    return 3;
  }

  return 4;
}

function filterAndSortAnimals(
  animals: AdoptionAnimal[],
  searchQuery: string,
  filters: DiscoveryFilters,
) {
  const searchText = searchQuery.trim().toLowerCase();
  const filtered = animals.filter((animal) => {
    const speciesSearchTerms =
      animal.type === "Dog"
        ? "dog dogs canine"
        : animal.type === "Cat"
          ? "cat cats feline"
          : "other others";
    const animalText = [
      animal.name,
      speciesSearchTerms,
      animal.age,
      animal.sex,
      animal.breed,
      animal.color,
      animal.location,
      animal.size,
      animal.energy,
      animal.bestFor,
      animal.story,
      ...animal.personality,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchText
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => animalText.includes(term));

    return (
      matchesCategory(animal, filters.category) &&
      matchesSearch &&
      (filters.sex === ALL_VALUE || animal.sex === filters.sex) &&
      (filters.size === ALL_VALUE || animal.size === filters.size) &&
      matchesAge(animal.age, filters.age) &&
      matchesBreedSelection(animal.breed, filters.breed, animal.type) &&
      (filters.breedListing === "any" ||
        getBreedListing(animal.breed) === filters.breedListing) &&
      (!filters.familyFitOnly || isFamilyFitDog(animal))
    );
  });

  return filtered
    .map((animal, index) => ({ animal, index }))
    .sort((left, right) => {
      const byName = left.animal.name.localeCompare(right.animal.name);

      if (filters.sort === "Name: A–Z") {
        return byName;
      }

      if (filters.sort === "Species: A–Z") {
        return left.animal.type.localeCompare(right.animal.type) || byName;
      }

      if (filters.sort === "Gender: A–Z") {
        return left.animal.sex.localeCompare(right.animal.sex) || byName;
      }

      if (filters.sort === "Size: small to large") {
        return (
          sizeRank(left.animal.size) - sizeRank(right.animal.size) || byName
        );
      }

      if (filters.sort === "Breed: A–Z") {
        return left.animal.breed.localeCompare(right.animal.breed) || byName;
      }

      if (
        filters.sort === "Age: youngest first" ||
        filters.sort === "Age: oldest first"
      ) {
        const leftAge = getAgeInMonths(left.animal.age);
        const rightAge = getAgeInMonths(right.animal.age);

        if (leftAge === null && rightAge === null) {
          return byName;
        }

        if (leftAge === null) {
          return 1;
        }

        if (rightAge === null) {
          return -1;
        }

        return filters.sort === "Age: youngest first"
          ? leftAge - rightAge || byName
          : rightAge - leftAge || byName;
      }

      return left.index - right.index;
    })
    .map(({ animal }) => animal);
}

function ChoiceChips<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.choiceList}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.choiceChip,
              selected ? styles.choiceChipSelected : null,
              pressed ? styles.pressed : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            {selected ? (
              <Ionicons name="checkmark" size={15} color={colors.white} />
            ) : null}
            <Text
              style={[
                styles.choiceText,
                selected ? styles.choiceTextSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterSection({
  children,
  helper,
  title,
}: {
  children: ReactNode;
  helper?: string;
  title: string;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {helper ? <Text style={styles.filterSectionHelper}>{helper}</Text> : null}
      {children}
    </View>
  );
}

export default function AdoptionScreen() {
  const { width: viewportWidth } = useWindowDimensions();
  const [animals, setAnimals] = useState<AdoptionAnimal[]>(adoptionAnimals);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const petGridWidth =
    Math.min(viewportWidth, CONTENT_MAX_WIDTH) - PAGE_PADDING * 2;
  const petTileWidth = Math.floor((petGridWidth - PET_GRID_GAP * 2) / 3);
  const petTileHeight = clamp(petTileWidth * 1.18, 118, 158);

  useEffect(() => {
    let mounted = true;

    getShelterAnimals()
      .then((shelterAnimals) => {
        const availableAnimals = shelterAnimals.filter(
          (animal) => animal.status === "AVAILABLE",
        );

        if (mounted) {
          setAnimals(availableAnimals.map(shelterAnimalToAdoptionAnimal));
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const sexOptions = useMemo(
    () => uniqueAnimalValues(animals, "sex"),
    [animals],
  );
  const sizeOptions = useMemo(
    () => uniqueAnimalValues(animals, "size"),
    [animals],
  );
  const breedOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...uniqueAnimalValues(animals, "breed"),
          ...EXTRA_BREED_OPTIONS,
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [animals],
  );
  const filteredAnimals = useMemo(
    () => filterAndSortAnimals(animals, searchQuery, filters),
    [animals, filters, searchQuery],
  );
  const draftResultCount = useMemo(
    () => filterAndSortAnimals(animals, searchQuery, draftFilters).length,
    [animals, draftFilters, searchQuery],
  );
  const activeFilterCount = [
    filters.category !== "All",
    filters.sex !== ALL_VALUE,
    filters.size !== ALL_VALUE,
    filters.age !== "Any age",
    filters.breed !== ALL_VALUE,
    filters.breedListing !== "any",
    filters.familyFitOnly,
  ].filter(Boolean).length;
  const hasDiscoveryChanges =
    activeFilterCount > 0 ||
    filters.sort !== "Recommended" ||
    Boolean(searchQuery.trim());

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setSearchQuery("");
    setCurrentPage(1);
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setFiltersVisible(true);
  };

  const closeFilters = () => {
    setFiltersVisible(false);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFiltersVisible(false);
    setCurrentPage(1);
  };

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAnimals.length / PETS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * PETS_PER_PAGE;
  const pagedAnimals = filteredAnimals.slice(
    pageStart,
    pageStart + PETS_PER_PAGE,
  );
  const canGoBack = safeCurrentPage > 1;
  const canGoForward = safeCurrentPage < pageCount;

  const goToPreviousPage = () => {
    if (canGoBack) {
      setCurrentPage(Math.max(1, safeCurrentPage - 1));
    }
  };

  const goToNextPage = () => {
    if (canGoForward) {
      setCurrentPage(Math.min(pageCount, safeCurrentPage + 1));
    }
  };

  const openAnimalProfile = (animalId: string) => {
    router.push(`/adoption/${animalId}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topSurface}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.topIconButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
            </Pressable>

            <Text style={styles.screenTitle}>Adopt a Pet</Text>

            <Pressable
              onPress={openFilters}
              style={({ pressed }) => [
                styles.topIconButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
            >
              <Ionicons
                name="options-outline"
                size={26}
                color={colors.charcoal}
              />
              {activeFilterCount > 0 ? (
                <View style={styles.topFilterDot} />
              ) : null}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Image
              source={require("../../assets/animals/dogs/adoptionbannerimagedog.blue-bg.jpg")}
              style={styles.heroImage}
              resizeMode="stretch"
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                Give them a home, get endless{" "}
                <Text style={styles.heroLove}>love.</Text>
              </Text>
              <View style={styles.heroSubtitleBlock}>
                <Text style={styles.heroSubtitle}>
                  Adopt a pet and change two
                </Text>
                <View style={styles.heroForeverRow}>
                  <Text style={styles.heroSubtitle}>lives forever.</Text>
                  <View style={styles.heroHeartTilt}>
                    <FontAwesome
                      name="heart-o"
                      size={21}
                      color={colors.primary}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.finderRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={22} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
              placeholder="Search name, breed or species"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={openFilters}
            style={({ pressed }) => [
              styles.filterButton,
              activeFilterCount > 0 ? styles.filterButtonActive : null,
              pressed ? styles.pressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
          >
            <Ionicons
              name="filter"
              size={22}
              color={activeFilterCount > 0 ? colors.white : colors.charcoal}
            />
            <Text
              style={[
                styles.filterButtonText,
                activeFilterCount > 0 ? styles.filterButtonTextActive : null,
              ]}
            >
              Filter
            </Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => {
            const selected = filters.category === category.label;
            return (
              <Pressable
                key={category.label}
                onPress={() => {
                  setFilters((current) => ({
                    ...current,
                    category: category.label,
                  }));
                  setCurrentPage(1);
                }}
                style={({ pressed }) => [
                  styles.categoryItem,
                  pressed ? styles.pressed : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {category.image ? (
                  <Image
                    source={category.image}
                    style={styles.categoryImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.categoryIcon,
                      selected ? styles.categoryIconSelected : null,
                    ]}
                  >
                    <View style={styles.allCategoryGrid}>
                      <View style={styles.allCategoryDot} />
                      <View style={styles.allCategoryDot} />
                      <View style={styles.allCategoryDot} />
                      <View style={styles.allCategoryDot} />
                    </View>
                  </View>
                )}
                <Text
                  style={[
                    styles.categoryText,
                    selected ? styles.categoryTextSelected : null,
                  ]}
                >
                  {category.label}
                </Text>
                <View
                  style={[
                    styles.categoryLine,
                    selected ? styles.categoryLineActive : null,
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>Pets Available for Adoption</Text>
            <Text style={styles.resultSummary}>
              {filteredAnimals.length}{" "}
              {filteredAnimals.length === 1 ? "match" : "matches"}
              {filters.sort !== "Recommended" ? ` · ${filters.sort}` : ""}
            </Text>
          </View>
          {hasDiscoveryChanges ? (
            <Pressable
              onPress={resetFilters}
              style={({ pressed }) => [
                styles.seeAllButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear search, filters and sorting"
            >
              <Text style={styles.seeAllText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {filteredAnimals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={30} color={colors.primary} />
            <Text style={styles.emptyTitle}>No pets found</Text>
            <Text style={styles.emptyText}>
              Try clearing a filter or using another search term.
            </Text>
            <Pressable
              onPress={resetFilters}
              style={({ pressed }) => [
                styles.emptyResetButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.emptyResetText}>Show all pets</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.petList}>
              {pagedAnimals.map((animal) => {
                return (
                  <Pressable
                    key={animal.id}
                    onPress={() => openAnimalProfile(animal.id)}
                    style={({ pressed }) => [
                      styles.petCard,
                      { height: petTileHeight, width: petTileWidth },
                      pressed ? styles.cardPressed : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${animal.name} profile`}
                  >
                    <Image
                      source={animal.image}
                      style={styles.petImage}
                      resizeMode="cover"
                    />
                    <View style={styles.petNameOverlay}>
                      <Text style={styles.petName} numberOfLines={1}>
                        {animal.name}
                      </Text>
                      <Text style={styles.petMeta} numberOfLines={1}>
                        {animal.breed} · {animal.age}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {pageCount > 1 ? (
              <View style={styles.paginationRow}>
                <Pressable
                  onPress={goToPreviousPage}
                  disabled={!canGoBack}
                  style={({ pressed }) => [
                    styles.pageButton,
                    !canGoBack ? styles.pageButtonDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={canGoBack ? colors.charcoal : colors.muted}
                  />
                </Pressable>

                <Text
                  style={styles.pageCountText}
                >{`<${safeCurrentPage}/${pageCount}>`}</Text>

                <Pressable
                  onPress={goToNextPage}
                  disabled={!canGoForward}
                  style={({ pressed }) => [
                    styles.pageButton,
                    !canGoForward ? styles.pageButtonDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={canGoForward ? colors.charcoal : colors.muted}
                  />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={closeFilters}
        presentationStyle="pageSheet"
        visible={filtersVisible}
      >
        <SafeAreaView
          style={styles.modalSafeArea}
          edges={["top", "bottom", "left", "right"]}
        >
          <View style={styles.modalHeader}>
            <Pressable
              onPress={closeFilters}
              style={({ pressed }) => [
                styles.modalHeaderButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close filters without applying"
            >
              <Ionicons name="close" size={25} color={colors.charcoal} />
            </Pressable>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalTitle}>Find your ideal pet</Text>
              <Text style={styles.modalSubtitle}>
                Choose what matters for your home
              </Text>
            </View>
            <Pressable
              onPress={() => setDraftFilters(DEFAULT_FILTERS)}
              style={({ pressed }) => [
                styles.modalResetButton,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reset filter choices"
            >
              <Text style={styles.modalResetText}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <FilterSection title="Species">
              <ChoiceChips
                onChange={(category) =>
                  setDraftFilters((current) => ({ ...current, category }))
                }
                options={categories.map(({ label }) => ({
                  label,
                  value: label,
                }))}
                value={draftFilters.category}
              />
            </FilterSection>

            <FilterSection title="Gender">
              <ChoiceChips
                onChange={(sex) =>
                  setDraftFilters((current) => ({ ...current, sex }))
                }
                options={[ALL_VALUE, ...sexOptions].map((sex) => ({
                  label: sex === ALL_VALUE ? "Any gender" : sex,
                  value: sex,
                }))}
                value={draftFilters.sex}
              />
            </FilterSection>

            <FilterSection title="Size">
              <ChoiceChips
                onChange={(size) =>
                  setDraftFilters((current) => ({ ...current, size }))
                }
                options={[ALL_VALUE, ...sizeOptions].map((size) => ({
                  label: size === ALL_VALUE ? "Any size" : size,
                  value: size,
                }))}
                value={draftFilters.size}
              />
            </FilterSection>

            <FilterSection title="Age">
              <ChoiceChips
                onChange={(age) =>
                  setDraftFilters((current) => ({ ...current, age }))
                }
                options={ageOptions.map((age) => ({ label: age, value: age }))}
                value={draftFilters.age}
              />
            </FilterSection>

            <FilterSection title="Breed">
              <ChoiceChips
                onChange={(breed) =>
                  setDraftFilters((current) => ({ ...current, breed }))
                }
                options={[ALL_VALUE, ...breedOptions].map((breed) => ({
                  label:
                    breed === ALL_VALUE
                      ? "Any breed"
                      : getBreedDisplayLabel(breed),
                  value: breed,
                }))}
                value={draftFilters.breed}
              />
            </FilterSection>

            <FilterSection
              title="Breed listing"
              helper="Based on the shelter's breed wording; this is not pedigree verification."
            >
              <ChoiceChips
                onChange={(breedListing) =>
                  setDraftFilters((current) => ({ ...current, breedListing }))
                }
                options={breedListingOptions}
                value={draftFilters.breedListing}
              />
            </FilterSection>

            <FilterSection
              title="Home fit"
              helper="Family fit matches dogs whose shelter description mentions a family or children."
            >
              <ChoiceChips
                onChange={(familyFit) =>
                  setDraftFilters((current) => ({
                    ...current,
                    familyFitOnly: familyFit === "family",
                  }))
                }
                options={[
                  { label: "Any home fit", value: "any" },
                  { label: "Family-fit dogs", value: "family" },
                ]}
                value={draftFilters.familyFitOnly ? "family" : "any"}
              />
            </FilterSection>

            <FilterSection title="Sort results">
              <ChoiceChips
                onChange={(sort) =>
                  setDraftFilters((current) => ({ ...current, sort }))
                }
                options={sortOptions.map((sort) => ({
                  label: sort,
                  value: sort,
                }))}
                value={draftFilters.sort}
              />
            </FilterSection>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              onPress={applyFilters}
              style={({ pressed }) => [
                styles.applyButton,
                pressed ? styles.applyButtonPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Show ${draftResultCount} matching pets`}
            >
              <Text style={styles.applyButtonText}>
                Show {draftResultCount}{" "}
                {draftResultCount === 1 ? "pet" : "pets"}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: HERO_TINT,
    flex: 1,
  },
  scroll: {
    backgroundColor: colors.white,
  },
  topSurface: {
    backgroundColor: HERO_TINT,
    marginBottom: vs(16),
    marginHorizontal: -PAGE_PADDING,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(8),
  },
  content: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(26),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 0,
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: TOUCH_TARGET,
    marginBottom: vs(16),
  },
  topIconButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    position: "relative",
    width: TOUCH_TARGET,
  },
  topFilterDot: {
    backgroundColor: colors.primary,
    borderColor: HERO_TINT,
    borderRadius: 999,
    borderWidth: 2,
    height: rs(10),
    position: "absolute",
    right: rs(6),
    top: vs(6),
    width: rs(10),
  },
  pressed: {
    opacity: 0.7,
  },
  screenTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  hero: {
    backgroundColor: HERO_TINT,
    borderRadius: 0,
    justifyContent: "center",
    marginHorizontal: -PAGE_PADDING,
    marginBottom: 0,
    minHeight: HERO_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    backgroundColor: HERO_TINT,
    borderRadius: 0,
    height: "100%",
    width: "100%",
  },
  heroCopy: {
    maxWidth: "52%",
    paddingHorizontal: rs(18),
    paddingVertical: vs(14),
  },
  heroTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(26),
  },
  heroLove: {
    color: colors.primary,
    fontFamily: Platform.select({
      android: "cursive",
      ios: "Snell Roundhand",
    }),
    fontSize: ms(29),
    fontStyle: "italic",
    fontWeight: "900",
    lineHeight: ms(31),
    textShadowColor: "rgba(15, 110, 168, 0.28)",
    textShadowOffset: { width: 0.65, height: 0 },
    textShadowRadius: 0.35,
  },
  heroSubtitleBlock: {
    marginTop: vs(8),
  },
  heroSubtitle: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
  },
  heroForeverRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(5),
  },
  heroHeartTilt: {
    transform: [{ rotate: "18deg" }],
  },
  finderRow: {
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(14),
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.primarySoft,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: rs(10),
    minHeight: TOUCH_TARGET + vs(4),
    minWidth: 0,
    paddingHorizontal: rs(14),
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "600",
    minHeight: TOUCH_TARGET,
    minWidth: 0,
  },
  clearButton: {
    alignItems: "center",
    height: rs(30),
    justifyContent: "center",
    width: rs(30),
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.primarySoft,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: TOUCH_TARGET + vs(4),
    paddingHorizontal: rs(12),
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  filterCountBadge: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(20),
    justifyContent: "center",
    minWidth: rs(20),
    paddingHorizontal: rs(5),
  },
  filterCountText: {
    color: colors.primaryDark,
    fontSize: ms(10),
    fontWeight: "900",
  },
  categoryList: {
    gap: rs(18),
    paddingBottom: vs(4),
    paddingHorizontal: rs(2),
  },
  categoryItem: {
    alignItems: "center",
    minWidth: rs(70),
    paddingBottom: vs(6),
  },
  categoryImage: {
    height: rs(54),
    width: rs(54),
  },
  categoryIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(48),
    justifyContent: "center",
    width: rs(48),
  },
  categoryIconSelected: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  allCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(4),
    height: rs(24),
    width: rs(24),
  },
  allCategoryDot: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    height: rs(10),
    width: rs(10),
  },
  categoryText: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "800",
    marginTop: vs(7),
  },
  categoryTextSelected: {
    color: colors.primary,
  },
  categoryLine: {
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 3,
    marginTop: vs(7),
    width: rs(38),
  },
  categoryLineActive: {
    backgroundColor: colors.primary,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(10),
    marginTop: vs(10),
  },
  sectionHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(21),
    paddingRight: rs(10),
  },
  resultSummary: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(2),
    paddingRight: rs(10),
  },
  seeAllButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(2),
    minHeight: rs(34),
  },
  seeAllText: {
    color: colors.primary,
    fontSize: ms(13),
    fontWeight: "900",
  },
  petList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PET_GRID_GAP,
  },
  paginationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(14),
    justifyContent: "center",
    marginTop: vs(16),
  },
  pageButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  pageButtonDisabled: {
    backgroundColor: colors.background,
    opacity: 0.58,
  },
  pageCountText: {
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: ms(19),
    minWidth: rs(78),
    textAlign: "center",
  },
  petCard: {
    backgroundColor: colors.charcoal,
    borderColor: "#D6EAF6",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  petImage: {
    height: "100%",
    width: "100%",
  },
  petNameOverlay: {
    backgroundColor: "rgba(16, 24, 32, 0.62)",
    bottom: 0,
    left: 0,
    minHeight: vs(49),
    paddingHorizontal: rs(8),
    paddingVertical: vs(8),
    position: "absolute",
    right: 0,
  },
  petName: {
    color: colors.white,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
    textAlign: "center",
  },
  petMeta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: ms(9),
    fontWeight: "700",
    lineHeight: ms(12),
    marginTop: vs(1),
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.primarySoft,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: vs(160),
    justifyContent: "center",
    padding: rs(18),
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: ms(17),
    fontWeight: "900",
    marginTop: vs(8),
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "700",
    marginTop: vs(3),
    textAlign: "center",
  },
  emptyResetButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: vs(12),
    minHeight: TOUCH_TARGET,
    paddingHorizontal: rs(16),
  },
  emptyResetText: {
    color: colors.white,
    fontSize: ms(12),
    fontWeight: "900",
  },
  modalSafeArea: {
    backgroundColor: colors.white,
    flex: 1,
  },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: vs(68),
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: vs(8),
  },
  modalHeaderButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  modalTitleBlock: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    paddingHorizontal: rs(6),
  },
  modalTitle: {
    color: colors.charcoal,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
    textAlign: "center",
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(15),
    marginTop: vs(1),
    textAlign: "center",
  },
  modalResetButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    minWidth: TOUCH_TARGET,
  },
  modalResetText: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "900",
  },
  modalContent: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(20),
    paddingHorizontal: PAGE_PADDING,
    width: "100%",
  },
  filterSection: {
    borderBottomColor: colors.lightgray,
    borderBottomWidth: 1,
    paddingVertical: vs(15),
  },
  filterSectionTitle: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  filterSectionHelper: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(16),
    marginTop: vs(3),
  },
  choiceList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
    marginTop: vs(10),
  },
  choiceChip: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(5),
    justifyContent: "center",
    minHeight: vs(40),
    paddingHorizontal: rs(13),
    paddingVertical: vs(8),
  },
  choiceChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceText: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(16),
  },
  choiceTextSelected: {
    color: colors.white,
    fontWeight: "900",
  },
  modalFooter: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: vs(12),
  },
  applyButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 17,
    justifyContent: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    minHeight: TOUCH_TARGET + vs(4),
    width: "100%",
  },
  applyButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  applyButtonText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
  safetyCard: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "#D6EAF6",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    marginTop: vs(20),
    padding: rs(16),
  },
  safetyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(54),
    justifyContent: "center",
    width: rs(54),
  },
  safetyCopy: {
    flex: 1,
    minWidth: 0,
  },
  safetyTitle: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  safetyText: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginTop: vs(2),
  },
  safetyAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(2),
  },
  learnMoreText: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "900",
  },
});
