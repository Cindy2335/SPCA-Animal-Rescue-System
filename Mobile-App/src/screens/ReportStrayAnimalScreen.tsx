import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReportLocationMap from "../components/ReportLocationMap";
import type {
  CoordinateEvent,
  LatLng,
  Region,
  ReportLocationMapHandle,
} from "../components/ReportLocationMap.types";
import { ROODEPOORT_REPORT_REGION } from "../components/ReportLocationMap.types";
import { useAuth } from "../context/AuthContext";
import {
  createStrayAnimalReport,
  reverseGeocodeAddress,
  type CreateStrayAnimalReportInput,
  type ReportImageInput,
} from "../services/api";
import { trackStrayReportSubmitted } from "../services/analytics";
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

type AnimalType = CreateStrayAnimalReportInput["animalType"];

type StepHeaderProps = {
  number: number;
  title: string;
};

type SelectFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  required?: boolean;
  onPress: () => void;
};

type TextFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  required?: boolean;
  multiline?: boolean;
  onChangeText: (value: string) => void;
};

type SelectKey = "animalType" | "color" | "age" | "gender" | "condition";

type SelectConfig = {
  title: string;
  options: string[];
  selectedValue: string;
};

type ReportPhoto = ReportImageInput & {
  uri: string;
};

const animalTypeOptions: AnimalType[] = ["Dog", "Cat", "Other"];
const colorOptions = ["Black", "White", "Brown", "Grey", "Ginger", "Mixed", "Other"];
const ageOptions = ["Puppy/kitten", "Young", "Adult", "Senior", "Not Sure"];
const genderOptions = ["Male", "Female", "Not Sure"];
const conditionOptions = ["Healthy", "Injured", "Scared", "Aggressive", "Weak", "Unknown"];
const PHOTO_LIMIT = 6;
const DEFAULT_MAP_REGION: Region = ROODEPOORT_REPORT_REGION;
const SELECTED_LOCATION_DELTA = 0.012;

function getRegionForCoordinate(coordinate: LatLng): Region {
  return {
    latitude: coordinate.latitude,
    latitudeDelta: SELECTED_LOCATION_DELTA,
    longitude: coordinate.longitude,
    longitudeDelta: SELECTED_LOCATION_DELTA,
  };
}

function formatCoordinate(coordinate: LatLng) {
  return `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
}

function formatAddress(
  address: Location.LocationGeocodedAddress | undefined,
  coordinate: LatLng
) {
  if (!address) {
    return formatCoordinate(coordinate);
  }

  const parts = [
    address.name,
    address.street,
    address.district,
    address.city,
    address.region,
  ].filter((part, index, allParts): part is string => {
    return Boolean(part) && allParts.indexOf(part) === index;
  });

  return parts.length > 0 ? parts.join(", ") : formatCoordinate(coordinate);
}

async function photoAssetToReportPhoto(
  asset: ImagePicker.ImagePickerAsset
): Promise<ReportPhoto> {
  const mimeType = asset.mimeType ?? "image/jpeg";
  const fileName =
    asset.fileName ??
    `report-photo-${Date.now()}.${mimeType.includes("png") ? "png" : "jpg"}`;
  const base64 =
    asset.base64 ??
    (await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  return {
    dataUri: `data:${mimeType};base64,${base64}`,
    fileName,
    mimeType,
    uri: asset.uri,
  };
}

function StepHeader({ number, title }: StepHeaderProps) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

function SelectField({ label, placeholder, value, required, onPress }: SelectFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.fieldControl, pressed ? styles.pressed : null]}
        accessibilityRole="button"
      >
        <Text
          style={[styles.fieldValue, value ? styles.fieldValueActive : null]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.charcoal} />
      </Pressable>
    </View>
  );
}

function TextField({
  label,
  placeholder,
  value,
  required,
  multiline,
  onChangeText,
}: TextFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7A8797"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.fieldControl, styles.textInput, multiline ? styles.multilineInput : null]}
      />
    </View>
  );
}

export default function ReportStrayAnimalScreen() {
  const { user } = useAuth();
  const mapRef = useRef<ReportLocationMapHandle | null>(null);
  const [animalType, setAnimalType] = useState<AnimalType | "">("");
  const [location, setLocation] = useState("");
  const [selectedCoordinate, setSelectedCoordinate] = useState<LatLng | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [condition, setCondition] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [activeSelect, setActiveSelect] = useState<SelectKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const detailsLength = additionalDetails.length;

  const description = useMemo(() => {
    return [
      `Breed: ${breed.trim() || "Unknown"}`,
      `Color: ${color || "Not selected"}`,
      `Age: ${age || "Not selected"}`,
      `Gender: ${gender || "Not selected"}`,
      selectedCoordinate
        ? `Coordinates: ${selectedCoordinate.latitude.toFixed(6)}, ${selectedCoordinate.longitude.toFixed(6)}`
        : "Coordinates: Not selected",
      `Additional details: ${additionalDetails.trim() || "No additional details provided."}`,
    ].join("\n");
  }, [additionalDetails, age, breed, color, gender, selectedCoordinate]);

  const selectReportCoordinate = useCallback(async (coordinate: LatLng, moveMap = true) => {
    const nextRegion = getRegionForCoordinate(coordinate);

    setSelectedCoordinate(coordinate);

    if (moveMap) {
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 350);
    }

    setResolvingAddress(true);

    try {
      const addresses = await Location.reverseGeocodeAsync(coordinate);
      const nativeAddress = formatAddress(addresses[0], coordinate);
      if (nativeAddress !== formatCoordinate(coordinate)) {
        setLocation(nativeAddress);
      } else {
        setLocation(await reverseGeocodeAddress(coordinate.latitude, coordinate.longitude));
      }
    } catch {
      try {
        setLocation(await reverseGeocodeAddress(coordinate.latitude, coordinate.longitude));
      } catch {
        setLocation(formatCoordinate(coordinate));
      }
    } finally {
      setResolvingAddress(false);
    }
  }, []);

  const requestCurrentLocation = useCallback(
    async (showPermissionAlert = true) => {
      setLocationLoading(true);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          setHasLocationPermission(false);

          if (showPermissionAlert) {
            Alert.alert(
              "Location permission needed",
              "Allow location access so the rescue team can find the animal faster."
            );
          }

          return;
        }

        setHasLocationPermission(true);

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await selectReportCoordinate({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch {
        if (showPermissionAlert) {
          Alert.alert(
            "Location unavailable",
            "We could not get your current location. You can still tap the map or type the address."
          );
        }
      } finally {
        setLocationLoading(false);
      }
    },
    [selectReportCoordinate]
  );

  useEffect(() => {
    const loadExistingLocationPermission = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      setHasLocationPermission(permission.granted);
    };

    void loadExistingLocationPermission();
  }, []);

  const handleLocationTextChange = (value: string) => {
    setLocation(value);
    setSelectedCoordinate(null);
  };

  const geocodeTypedLocation = useCallback(async () => {
    const trimmedLocation = location.trim();

    if (trimmedLocation.length < 2) {
      return;
    }

    setLocationLoading(true);

    try {
      const matches = await Location.geocodeAsync(trimmedLocation);
      const firstMatch = matches[0];

      if (!firstMatch) {
        Alert.alert("Location not found", "Try a more specific street, suburb, or landmark.");
        return;
      }

      await selectReportCoordinate({
        latitude: firstMatch.latitude,
        longitude: firstMatch.longitude,
      });
    } catch {
      Alert.alert("Location search failed", "Could not find that location right now.");
    } finally {
      setLocationLoading(false);
    }
  }, [location, selectReportCoordinate]);

  const handleMapPress = useCallback(
    (event: CoordinateEvent) => {
      void selectReportCoordinate(event.nativeEvent.coordinate);
    },
    [selectReportCoordinate]
  );

  const handleMarkerDragEnd = useCallback(
    (event: CoordinateEvent) => {
      void selectReportCoordinate(event.nativeEvent.coordinate, false);
    },
    [selectReportCoordinate]
  );

  const getSelectConfig = (): SelectConfig | null => {
    switch (activeSelect) {
      case "animalType":
        return {
          title: "Animal Type",
          options: animalTypeOptions,
          selectedValue: animalType,
        };
      case "color":
        return {
          title: "Color",
          options: colorOptions,
          selectedValue: color,
        };
      case "age":
        return {
          title: "Age",
          options: ageOptions,
          selectedValue: age,
        };
      case "gender":
        return {
          title: "Gender",
          options: genderOptions,
          selectedValue: gender,
        };
      case "condition":
        return {
          title: "Physical Condition",
          options: conditionOptions,
          selectedValue: condition,
        };
      default:
        return null;
    }
  };

  const selectConfig = getSelectConfig();

  const selectOption = (value: string) => {
    switch (activeSelect) {
      case "animalType":
        setAnimalType(value as AnimalType);
        break;
      case "color":
        setColor(value);
        break;
      case "age":
        setAge(value);
        break;
      case "gender":
        setGender(value);
        break;
      case "condition":
        setCondition(value);
        break;
      default:
        break;
    }

    setActiveSelect(null);
  };

  const addPhotoAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    try {
      const reportPhotos = await Promise.all(assets.map(photoAssetToReportPhoto));

      setPhotos((currentPhotos) =>
        [...currentPhotos, ...reportPhotos].slice(0, PHOTO_LIMIT)
      );
    } catch {
      Alert.alert("Photo upload issue", "Could not prepare one of those photos for upload.");
    }
  };

  const pickPhotos = async () => {
    if (photos.length >= PHOTO_LIMIT) {
      Alert.alert("Photo limit reached", `You can attach up to ${PHOTO_LIMIT} photos.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow photo access to choose animal photos.");
      return;
    }

    const remainingSlots = Math.max(1, PHOTO_LIMIT - photos.length);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      mediaTypes: ["images"],
      quality: 0.48,
      selectionLimit: remainingSlots,
    });

    if (!result.canceled) {
      await addPhotoAssets(result.assets);
    }
  };

  const takePhoto = async () => {
    if (photos.length >= PHOTO_LIMIT) {
      Alert.alert("Photo limit reached", `You can attach up to ${PHOTO_LIMIT} photos.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Camera permission needed", "Allow camera access to take an animal photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        base64: true,
        cameraType: ImagePicker.CameraType.back,
        mediaTypes: ["images"],
        quality: 0.48,
      });

      if (!result.canceled) {
        await addPhotoAssets(result.assets);
      }
    } catch (cameraError) {
      console.error("Could not open the camera for a stray animal report", cameraError);
      Alert.alert(
        "Camera unavailable",
        "The camera could not be opened on this device. You can still choose a photo from your gallery."
      );
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.uri !== uri));
  };

  const submitReport = async (
    trimmedLocation: string,
    selectedAnimalType: Exclude<AnimalType, "">
  ) => {
    setLoading(true);

    try {
      await createStrayAnimalReport({
        animalType: selectedAnimalType,
        location: trimmedLocation,
        latitude: selectedCoordinate?.latitude,
        longitude: selectedCoordinate?.longitude,
        condition: condition || undefined,
        description,
        images: photos.map(({ dataUri, fileName, mimeType }) => ({
          dataUri,
          fileName,
          mimeType,
        })),
      });

      void trackStrayReportSubmitted();

      setSuccessMessage(
        user?.id
          ? "Stray animal report submitted. You can track updates from My Reports."
          : "Anonymous report submitted. Local helpers can review it, but updates will not be linked to your account."
      );
      setAnimalType("");
      setLocation("");
      setSelectedCoordinate(null);
      setMapRegion(DEFAULT_MAP_REGION);
      setBreed("");
      setColor("");
      setAge("");
      setGender("");
      setCondition("");
      setAdditionalDetails("");
      setPhotos([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);

    const trimmedLocation = location.trim();

    if (!animalType) {
      setError("Select the animal type.");
      return;
    }

    if (trimmedLocation.length < 2) {
      setError("Add where you last saw the animal.");
      return;
    }

    const selectedAnimalType = animalType;

    if (!user?.id) {
      Alert.alert(
        "Submit anonymously?",
        "You can submit this report without signing in and it will still be handled. To receive updates and track it later, please sign in first.",
        [
          { text: "Sign in", onPress: () => router.push("/login") },
          {
            text: "Submit anonymously",
            style: "destructive",
            onPress: () => void submitReport(trimmedLocation, selectedAnimalType),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    await submitReport(trimmedLocation, selectedAnimalType);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.topBar}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={31} color="#0A1020" />
              </Pressable>

              <Text style={styles.screenTitle} numberOfLines={1}>
                Report Stray Animal
              </Text>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Report help",
                    "Add a clear photo, exact location, and visible animal details so helpers can respond faster."
                  )
                }
                style={({ pressed }) => [styles.helpButton, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel="Report help"
              >
                <Ionicons name="help" size={23} color="#0A1020" />
              </Pressable>
            </View>

            <View style={styles.formContent}>
             
              <StepHeader number={1} title="Animal Photo" />

              <View style={styles.uploadBox}>
                {photos.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.previewList}
                  >
                    {photos.map((photo, index) => (
                      <View key={`${photo.uri}-${index}`} style={styles.previewItem}>
                        <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
                        <Pressable
                          onPress={() => removePhoto(photo.uri)}
                          style={({ pressed }) => [
                            styles.removePhotoButton,
                            pressed ? styles.pressed : null,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Remove photo"
                        >
                          <Ionicons name="close" size={15} color={colors.white} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <>
                    <View style={styles.uploadIconCircle}>
                      <Ionicons name="camera-outline" size={28} color={colors.primary} />
                      <Ionicons
                        name="add"
                        size={15}
                        color={colors.primary}
                        style={styles.uploadIconPlus}
                      />
                    </View>
                    <Text style={styles.uploadTitle}>Take a photo or choose from gallery</Text>
                    <Text style={styles.uploadMeta}>JPG, PNG up to 10MB each</Text>
                  </>
                )}

                <View style={styles.photoActionRow}>
                  <Pressable
                    onPress={takePhoto}
                    style={({ pressed }) => [
                      styles.photoActionButton,
                      styles.primaryPhotoAction,
                      pressed ? styles.pressed : null,
                    ]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="camera-outline" size={20} color={colors.white} />
                    <Text style={styles.primaryPhotoActionText}>Take photo</Text>
                  </Pressable>

                  <Pressable
                    onPress={pickPhotos}
                    style={({ pressed }) => [styles.photoActionButton, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="images-outline" size={20} color={colors.primary} />
                    <Text style={styles.photoActionText}>Upload photo</Text>
                  </Pressable>
                </View>
              </View>

              <StepHeader number={2} title="Location" />

              <View style={styles.locationBlock}>
                <FieldLabel label="Find location" required />
                <View style={styles.locationInputWrap}>
                  <Ionicons name="location-outline" size={23} color="#18233A" />
                  <TextInput
                    value={location}
                    onChangeText={handleLocationTextChange}
                    onSubmitEditing={() => void geocodeTypedLocation()}
                    placeholder="Search or tap on map to tag location"
                    placeholderTextColor="#7A8797"
                    returnKeyType="search"
                    style={styles.locationInput}
                  />
                  <Pressable
                    onPress={() => void requestCurrentLocation(true)}
                    style={({ pressed }) => [styles.locationIconButton, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel="Use current location"
                  >
                    <Ionicons
                      name={locationLoading ? "sync-outline" : "locate-outline"}
                      size={22}
                      color="#18233A"
                    />
                  </Pressable>
                </View>

                <View style={styles.mapCard}>
                  <ReportLocationMap
                    ref={mapRef}
                    style={styles.map}
                    region={mapRegion}
                    onRegionChangeComplete={setMapRegion}
                    onPress={handleMapPress}
                    hasLocationPermission={hasLocationPermission}
                    selectedCoordinate={selectedCoordinate}
                    onMarkerDragEnd={handleMarkerDragEnd}
                    markerTitle="Report location"
                  />

                  <View style={styles.mapInstructionPill}>
                    <Ionicons name="pin-outline" size={15} color={colors.primary} />
                    <Text style={styles.mapInstructionText}>Tap map or drag pin</Text>
                  </View>

                  <Pressable
                    onPress={() => void requestCurrentLocation(true)}
                    style={({ pressed }) => [styles.mapLocateButton, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel="Use current location"
                  >
                    <Ionicons
                      name={locationLoading ? "sync-outline" : "locate"}
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>

                  {locationLoading || resolvingAddress ? (
                    <View style={styles.mapLoadingOverlay}>
                      <Ionicons name="sync-outline" size={18} color={colors.primary} />
                      <Text style={styles.mapLoadingText}>
                        {resolvingAddress ? "Finding address..." : "Finding you..."}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => void requestCurrentLocation(true)}
                  style={({ pressed }) => [styles.currentLocationRow, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Ionicons name="locate" size={22} color={colors.primary} />
                  <Text style={styles.currentLocationText}>
                    {selectedCoordinate
                      ? `Pinned at ${formatCoordinate(selectedCoordinate)}`
                      : "Use current location"}
                  </Text>
                </Pressable>
              </View>

              <StepHeader number={3} title="Animal Details" />

              <View style={styles.detailsGrid}>
                <SelectField
                  label="Animal Type"
                  placeholder="Select type"
                  value={animalType}
                  required
                  onPress={() => setActiveSelect("animalType")}
                />
                <TextField
                  label="Breed (if known)"
                  placeholder="Enter breed"
                  value={breed}
                  onChangeText={setBreed}
                />
                <SelectField
                  label="Color"
                  placeholder="Select color"
                  value={color}
                  onPress={() => setActiveSelect("color")}
                />
                <SelectField
                  label="Age (approx.)"
                  placeholder="Select age range"
                  value={age}
                  onPress={() => setActiveSelect("age")}
                />
                <SelectField
                  label="Gender (if known)"
                  placeholder="Select gender"
                  value={gender}
                  onPress={() => setActiveSelect("gender")}
                />
                <SelectField
                  label="Physical Condition"
                  placeholder="Select condition"
                  value={condition}
                  onPress={() => setActiveSelect("condition")}
                />
              </View>

              <View style={styles.fullWidthField}>
                <FieldLabel label="Additional Details" />
                <TextInput
                  value={additionalDetails}
                  onChangeText={setAdditionalDetails}
                  placeholder="Enter any other details about the animal..."
                  placeholderTextColor="#7A8797"
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  style={[styles.fieldControl, styles.textInput, styles.additionalInput]}
                />
                <Text style={styles.characterCount}>{detailsLength}/500</Text>
              </View>

              {error ? (
                <View style={styles.feedbackPanel}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {successMessage ? (
                <View style={[styles.feedbackPanel, styles.successPanel]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              <View style={styles.actionFooter}>
                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitButton,
                    loading ? styles.disabledButton : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? "Submitting..." : "Submit Report"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={selectConfig !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveSelect(null)}
      >
        <View style={styles.selectOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveSelect(null)}
            accessibilityRole="button"
            accessibilityLabel="Close options"
          />

          <View style={styles.selectSheet}>
            <View style={styles.selectHandle} />
            <View style={styles.selectHeader}>
              <Text style={styles.selectTitle}>{selectConfig?.title}</Text>
              <Pressable
                onPress={() => setActiveSelect(null)}
                style={({ pressed }) => [styles.selectCloseButton, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel="Close options"
              >
                <Ionicons name="close" size={22} color={colors.charcoal} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.selectOptions}
              showsVerticalScrollIndicator={false}
            >
              {selectConfig?.options.map((option, index) => {
                const selected = selectConfig.selectedValue === option;

                return (
                  <View key={option}>
                    <Pressable
                      onPress={() => selectOption(option)}
                      style={({ pressed }) => [
                        styles.selectOption,
                        selected ? styles.selectOptionSelected : null,
                        pressed ? styles.pressed : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          selected ? styles.selectOptionTextSelected : null,
                        ]}
                      >
                        {option}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                      ) : null}
                    </Pressable>
                    {index < selectConfig.options.length - 1 ? (
                      <View style={styles.selectDivider} />
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    backgroundColor: colors.white,
    flexGrow: 1,
  },
  shell: {
    backgroundColor: colors.white,
    maxWidth: CONTENT_MAX_WIDTH,
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: vs(76),
    paddingHorizontal: PAGE_PADDING,
  },
  iconButton: {
    alignItems: "center",
    height: rs(44),
    justifyContent: "center",
    width: rs(44),
  },
  helpButton: {
    alignItems: "center",
    borderColor: "#0A1020",
    borderRadius: 999,
    borderWidth: 2,
    height: rs(39),
    justifyContent: "center",
    width: rs(39),
  },
  screenTitle: {
    color: "#111827",
    flex: 1,
    fontSize: ms(24),
    fontWeight: "900",
    lineHeight: ms(29),
    textAlign: "center",
  },
  formContent: {
    paddingBottom: vs(24),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(24),
  },
  introPanel: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(16),
    minHeight: vs(78),
  },
  introImage: {
    height: rs(68),
    width: rs(68),
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
  },
  introTitle: {
    color: colors.text,
    fontSize: ms(17),
    fontWeight: "900",
    lineHeight: ms(21),
  },
  introBody: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(16),
    marginTop: vs(3),
  },
  stepHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(11),
    marginBottom: vs(18),
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: rs(30),
    justifyContent: "center",
    width: rs(30),
  },
  stepNumber: {
    color: colors.white,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  stepTitle: {
    color: "#111827",
    flex: 1,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
  },
  uploadBox: {
    alignItems: "center",
    borderColor: "#C3D0E0",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1.4,
    justifyContent: "center",
    marginBottom: vs(18),
    minHeight: vs(104),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
  },
  uploadIconCircle: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(54),
    justifyContent: "center",
    marginBottom: vs(9),
    width: rs(54),
  },
  uploadIconPlus: {
    bottom: rs(14),
    position: "absolute",
    right: rs(14),
  },
  uploadTitle: {
    color: "#111827",
    fontSize: ms(15),
    fontWeight: "700",
    lineHeight: ms(19),
    textAlign: "center",
  },
  uploadMeta: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(16),
    marginTop: vs(3),
    textAlign: "center",
  },
  previewList: {
    gap: rs(10),
    paddingBottom: vs(4),
  },
  previewItem: {
    borderRadius: 8,
    height: rs(74),
    overflow: "hidden",
    width: rs(74),
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  removePhotoButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 24, 32, 0.72)",
    borderRadius: 999,
    height: rs(24),
    justifyContent: "center",
    position: "absolute",
    right: rs(5),
    top: rs(5),
    width: rs(24),
  },
  photoActionRow: {
    flexDirection: "row",
    gap: rs(10),
    marginTop: vs(10),
    width: "100%",
  },
  photoActionButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(40),
    paddingHorizontal: rs(10),
  },
  primaryPhotoAction: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  primaryPhotoActionText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  photoActionText: {
    color: colors.primary,
    fontSize: ms(13),
    fontWeight: "900",
  },
  locationBlock: {
    marginBottom: vs(18),
  },
  fieldLabel: {
    color: "#111827",
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(18),
    marginBottom: vs(7),
  },
  required: {
    color: "#DF1B1B",
  },
  locationInputWrap: {
    alignItems: "center",
    borderColor: "#D4DCE7",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(44),
    paddingHorizontal: rs(12),
  },
  locationInput: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(14),
    fontWeight: "600",
    minHeight: vs(42),
    paddingVertical: 0,
  },
  locationIconButton: {
    alignItems: "center",
    height: rs(30),
    justifyContent: "center",
    width: rs(30),
  },
  mapCard: {
    borderRadius: 8,
    height: clamp(screen.height * 0.42, 320, 460),
    marginTop: vs(10),
    overflow: "hidden",
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  mapInstructionPill: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.22)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(5),
    left: rs(10),
    paddingHorizontal: rs(10),
    paddingVertical: vs(6),
    position: "absolute",
    top: vs(10),
  },
  mapInstructionText: {
    color: colors.primary,
    fontSize: ms(11),
    fontWeight: "900",
    lineHeight: ms(15),
  },
  mapLocateButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    height: rs(46),
    justifyContent: "center",
    position: "absolute",
    right: rs(12),
    shadowColor: "#0B3554",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    top: vs(10),
    width: rs(46),
  },
  mapLoadingOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    position: "absolute",
    bottom: vs(10),
    left: rs(10),
    paddingHorizontal: rs(11),
    paddingVertical: vs(8),
  },
  mapLoadingText: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(16),
  },
  currentLocationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(38),
    paddingHorizontal: rs(2),
  },
  currentLocationText: {
    color: colors.primary,
    fontSize: ms(14),
    fontWeight: "800",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(14),
  },
  fieldGroup: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: rs(150),
  },
  fullWidthField: {
    marginTop: vs(14),
  },
  fieldControl: {
    alignItems: "center",
    borderColor: "#D4DCE7",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: vs(50),
    paddingHorizontal: rs(14),
  },
  fieldValue: {
    color: "#7A8797",
    flex: 1,
    fontSize: ms(15),
    fontWeight: "600",
    lineHeight: ms(20),
  },
  fieldValueActive: {
    color: colors.charcoal,
  },
  textInput: {
    color: colors.charcoal,
    fontSize: ms(15),
    fontWeight: "600",
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: vs(104),
    paddingTop: vs(12),
  },
  additionalInput: {
    minHeight: vs(88),
    paddingBottom: vs(24),
    paddingTop: vs(12),
  },
  characterCount: {
    bottom: vs(11),
    color: "#6C7788",
    fontSize: ms(12),
    fontWeight: "700",
    position: "absolute",
    right: rs(14),
  },
  feedbackPanel: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: "#F5C2BD",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginTop: vs(14),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
  },
  successPanel: {
    backgroundColor: colors.accentSoft,
    borderColor: "#B8DCC7",
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "700",
    lineHeight: ms(18),
  },
  successText: {
    color: colors.accent,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "700",
    lineHeight: ms(18),
  },
  actionFooter: {
    flexDirection: "row",
    gap: rs(16),
    marginTop: vs(26),
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#D4DCE7",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: vs(54),
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: ms(17),
    fontWeight: "800",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: vs(54),
  },
  disabledButton: {
    opacity: 0.62,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: ms(17),
    fontWeight: "900",
  },
  selectOverlay: {
    backgroundColor: "rgba(10, 16, 32, 0.34)",
    flex: 1,
    justifyContent: "flex-end",
  },
  selectSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "58%",
    paddingBottom: vs(18),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(10),
  },
  selectHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(82, 96, 109, 0.26)",
    borderRadius: 999,
    height: 4,
    marginBottom: vs(14),
    width: rs(46),
  },
  selectHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(8),
  },
  selectTitle: {
    color: colors.charcoal,
    fontSize: ms(19),
    fontWeight: "900",
    lineHeight: ms(24),
  },
  selectCloseButton: {
    alignItems: "center",
    height: rs(38),
    justifyContent: "center",
    width: rs(38),
  },
  selectOptions: {
    paddingBottom: vs(4),
  },
  selectOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(12),
    justifyContent: "space-between",
    minHeight: vs(50),
    paddingHorizontal: rs(2),
  },
  selectOptionSelected: {
    backgroundColor: "transparent",
  },
  selectOptionText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(16),
    fontWeight: "700",
    lineHeight: ms(21),
  },
  selectOptionTextSelected: {
    color: colors.primary,
    fontWeight: "900",
  },
  selectDivider: {
    backgroundColor: "rgba(82, 96, 109, 0.16)",
    height: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
