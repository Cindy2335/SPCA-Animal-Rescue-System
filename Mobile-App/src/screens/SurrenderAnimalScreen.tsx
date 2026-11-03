import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  getAnimalSurrenderRequests,
  createAnimalSurrenderRequest,
  scheduleAnimalSurrenderIntake,
  type AnimalSurrenderRequest,
  type AnimalSurrenderStatus,
  type CreateAnimalSurrenderInput,
  type ReportImageInput,
} from "../services/api";
import { trackSurrenderRequestSubmitted } from "../services/analytics";
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

type AnimalType = CreateAnimalSurrenderInput["animalType"];
type ContactMethod = CreateAnimalSurrenderInput["preferredContactMethod"];
type Urgency = CreateAnimalSurrenderInput["urgency"];
type SurrenderMode = "hub" | "history" | "form";
type FormStep = 0 | 1 | 2;

type SurrenderPhoto = ReportImageInput & {
  uri: string;
};

const PHOTO_LIMIT = 6;
const HERO_HEIGHT = clamp(screen.height * 0.27, 218, 286);
const animalTypeOptions: AnimalType[] = ["Dog", "Cat", "Other"];
const sexOptions = ["Male", "Female", "Unknown"];
const contactMethodOptions: ContactMethod[] = ["Phone", "Email", "WhatsApp"];
const urgencyOptions: Urgency[] = ["This week", "Within two weeks", "This month", "Flexible"];
const formSteps = ["Pet", "Reason", "Contact"] as const;

function createNeutralPhotoFileName() {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `surrender-photo-${Date.now()}-${randomSuffix}.jpg`;
}

async function removeGeneratedPhotoFile(uri: string) {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:") && typeof URL !== "undefined") {
      URL.revokeObjectURL(uri);
    }
    return;
  }

  if (!uri.startsWith("file://")) {
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // The sanitized bytes are already held in memory; cache cleanup is best effort.
  }
}

async function photoAssetToSurrenderPhoto(
  asset: ImagePicker.ImagePickerAsset
): Promise<SurrenderPhoto> {
  let generatedUri: string | null = null;

  try {
    // Decoding and saving creates fresh pixel-only bytes. The original filename and
    // EXIF/IPTC metadata (including camera and GPS fields) are never stored or sent.
    const sanitized = await manipulateAsync(asset.uri, [], {
      base64: true,
      compress: 0.82,
      format: SaveFormat.JPEG,
    });
    generatedUri = sanitized.uri;

    if (!sanitized.base64) {
      throw new Error("The sanitized photo did not include image data.");
    }

    const dataUri = `data:image/jpeg;base64,${sanitized.base64}`;

    return {
      dataUri,
      fileName: createNeutralPhotoFileName(),
      mimeType: "image/jpeg",
      uri: dataUri,
    };
  } finally {
    if (generatedUri) {
      await removeGeneratedPhotoFile(generatedUri);
    }
  }
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

function TextField({
  label,
  placeholder,
  required,
  value,
  multiline,
  fullWidth,
  keyboardType,
  onChangeText,
}: {
  label: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  multiline?: boolean;
  fullWidth?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={[styles.fieldGroup, fullWidth ? styles.fullWidthField : null]}>
      <FieldLabel label={label} required={required} />
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7A8797"
        style={[styles.fieldControl, styles.textInput, multiline ? styles.multilineInput : null]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

function ChoiceChips<T extends string>({
  label,
  options,
  required,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  required?: boolean;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <FieldLabel label={label} required={required} />
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = value === option;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(option);
              }}
              style={({ pressed }) => [
                styles.choiceChip,
                selected ? styles.choiceChipActive : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextActive : null]}>
                {option}
              </Text>
              {selected ? (
                <Ionicons color={colors.white} name="checkmark-circle" size={18} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TogglePill({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.togglePill,
        active ? styles.togglePillActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons color={active ? colors.white : colors.primary} name={icon} size={18} />
      <Text style={[styles.togglePillText, active ? styles.togglePillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatStatus(status: AnimalSurrenderStatus) {
  if (status === "CONTACTED") {
    return "Accepted";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatRequestDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function getDefaultScheduleDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function formatIntakeDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled yet";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatScheduleDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatScheduleTime(value: Date) {
  return value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function surrenderPromptForStatus(request: AnimalSurrenderRequest) {
  if (request.status === "CONTACTED") {
    return "Accepted. Choose when you can bring the animal in.";
  }

  if (request.status === "INTAKE_SCHEDULED") {
    return `Drop-off scheduled for ${formatIntakeDateTime(request.scheduledIntakeAt)}. Staff will complete intake when the animal arrives.`;
  }

  if (request.status === "COMPLETED") {
    return request.shelterAnimalId
      ? "Intake completed. The animal has been added to the shelter."
      : "Intake completed.";
  }

  return "Submitted. Shelter staff will review and contact you.";
}

function SurrenderRequestCard({
  busy,
  onSchedule,
  request,
}: {
  busy: boolean;
  onSchedule: (
    request: AnimalSurrenderRequest,
    scheduledIntakeAt: string,
    scheduledIntakeNote: string
  ) => Promise<void>;
  request: AnimalSurrenderRequest;
}) {
  const image = request.images[0]?.dataUri;
  const title = request.animalName || request.breed || request.animalType;
  const needsScheduling = request.status === "CONTACTED";
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleDateTime);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const submitSchedule = async () => {
    if (scheduledAt.getTime() <= Date.now()) {
      setScheduleError("Choose a drop-off date and time in the future.");
      return;
    }

    setScheduleError(null);
    await onSchedule(request, scheduledAt.toISOString(), scheduleNote);
  };

  const changeScheduleDate = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowDatePicker(false);
    if (!selected) return;
    setScheduledAt((current) => {
      const next = new Date(current);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      return next;
    });
    setScheduleError(null);
  };

  const changeScheduleTime = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowTimePicker(false);
    if (!selected) return;
    setScheduledAt((current) => {
      const next = new Date(current);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return next;
    });
    setScheduleError(null);
  };

  return (
    <View style={styles.requestCard}>
      {image ? (
        <Image resizeMode="cover" source={{ uri: image }} style={styles.requestImage} />
      ) : (
        <View style={styles.requestImageFallback}>
          <Ionicons color={colors.primary} name="paw-outline" size={22} />
        </View>
      )}
      <View style={styles.requestCopy}>
        <View style={styles.requestTopRow}>
          <Text style={styles.requestTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.requestDate}>{formatRequestDate(request.createdAt)}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{formatStatus(request.status)}</Text>
        </View>
        <Text style={styles.requestPrompt}>{surrenderPromptForStatus(request)}</Text>
        {needsScheduling ? (
          <View style={styles.schedulePanel}>
            <View style={styles.scheduleFields}>
              <View style={styles.scheduleField}>
                <Text style={styles.scheduleLabel}>Date</Text>
                <Pressable
                  accessibilityLabel="Choose drop-off date"
                  accessibilityRole="button"
                  onPress={() => setShowDatePicker(true)}
                  style={({ pressed }) => [styles.schedulePickerButton, pressed ? styles.pressed : null]}
                >
                  <Ionicons color={colors.primary} name="calendar-outline" size={17} />
                  <Text style={styles.schedulePickerText}>{formatScheduleDate(scheduledAt)}</Text>
                </Pressable>
              </View>
              <View style={styles.scheduleField}>
                <Text style={styles.scheduleLabel}>Time</Text>
                <Pressable
                  accessibilityLabel="Choose drop-off time"
                  accessibilityRole="button"
                  onPress={() => setShowTimePicker(true)}
                  style={({ pressed }) => [styles.schedulePickerButton, pressed ? styles.pressed : null]}
                >
                  <Ionicons color={colors.primary} name="time-outline" size={17} />
                  <Text style={styles.schedulePickerText}>{formatScheduleTime(scheduledAt)}</Text>
                </Pressable>
              </View>
            </View>
            {showDatePicker ? (
              <DateTimePicker
                minimumDate={new Date()}
                mode="date"
                onChange={changeScheduleDate}
                value={scheduledAt}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker mode="time" onChange={changeScheduleTime} value={scheduledAt} />
            ) : null}
            <Text style={styles.scheduleTimezone}>
              Times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </Text>
            <TextInput
              multiline
              onChangeText={setScheduleNote}
              placeholder="Optional note for intake staff"
              placeholderTextColor="#7A8797"
              style={[styles.scheduleInput, styles.scheduleNoteInput]}
              value={scheduleNote}
            />
            {scheduleError ? <Text style={styles.scheduleError}>{scheduleError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void submitSchedule()}
              style={({ pressed }) => [
                styles.scheduleButton,
                busy ? styles.disabledButton : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.white} name="calendar-outline" size={17} />
              <Text style={styles.scheduleButtonText}>
                {busy ? "Scheduling..." : "Confirm drop-off"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HubActionCard({
  icon,
  iconSource,
  title,
  subtitle,
  onPress,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  iconSource?: ImageSourcePropType;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      damping: 15,
      mass: 0.7,
      stiffness: 220,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => animatePress(0.975)}
        onPressOut={() => animatePress(1)}
        style={styles.hubActionCard}
      >
        <View style={styles.hubActionIcon}>
          {iconSource ? (
            <Image source={iconSource} style={styles.hubActionIconImage} resizeMode="contain" />
          ) : icon ? (
            <Ionicons color={colors.primary} name={icon} size={27} />
          ) : null}
        </View>
        <View style={styles.hubActionCopy}>
          <Text style={styles.hubActionTitle}>{title}</Text>
          <Text style={styles.hubActionSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons color={colors.textSecondary} name="chevron-forward" size={22} />
      </Pressable>
    </Animated.View>
  );
}

export default function SurrenderAnimalScreen() {
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const heroPulse = useRef(new Animated.Value(1)).current;
  const [mode, setMode] = useState<SurrenderMode>("hub");
  const [formStep, setFormStep] = useState<FormStep>(0);
  const [ownerName, setOwnerName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] =
    useState<ContactMethod>("Phone");
  const [animalName, setAnimalName] = useState("");
  const [animalType, setAnimalType] = useState<AnimalType>("Dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [color, setColor] = useState("");
  const [vaccinated, setVaccinated] = useState(false);
  const [sterilized, setSterilized] = useState(false);
  const [microchipped, setMicrochipped] = useState(false);
  const [healthNotes, setHealthNotes] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Within two weeks");
  const [submitAnonymously, setSubmitAnonymously] = useState(!user?.id);
  const [acceptedPermanentSurrender, setAcceptedPermanentSurrender] = useState(false);
  const [photos, setPhotos] = useState<SurrenderPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [surrenderRequests, setSurrenderRequests] = useState<AnimalSurrenderRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduleBusyId, setScheduleBusyId] = useState<string | null>(null);
  const isGuest = !user?.id;
  const isAnonymousSubmission = isGuest || submitAnonymously;

  useEffect(() => {
    if (user?.fullName && !ownerName) {
      setOwnerName(user.fullName);
    }

    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [email, ownerName, user?.email, user?.fullName]);

  const reasonLength = reason.trim().length;
  const photoSlotsRemaining = PHOTO_LIMIT - photos.length;

  useEffect(() => {
    contentOpacity.setValue(0);
    contentTranslateY.setValue(18);
    contentScale.setValue(0.985);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateY, {
        damping: 18,
        mass: 0.75,
        stiffness: 150,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        damping: 18,
        mass: 0.75,
        stiffness: 150,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentScale, contentTranslateY, formStep, mode]);

  useEffect(() => {
    if (mode !== "hub") {
      heroPulse.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 1.025,
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [heroPulse, mode]);

  const loadSurrenderRequests = useCallback(async () => {
    if (!user?.id) {
      setSurrenderRequests([]);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);

    try {
      const requests = await getAnimalSurrenderRequests({ ownerId: user.id });
      setSurrenderRequests(requests);
      setHistoryError(null);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Could not load requests");
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSurrenderRequests();
    }, [loadSurrenderRequests])
  );

  const openForm = () => {
    void Haptics.selectionAsync();
    setError(null);
    setSuccessMessage(null);
    setFormStep(0);
    setMode("form");
  };

  const openHistory = () => {
    void Haptics.selectionAsync();
    setError(null);
    setSuccessMessage(null);
    setMode("history");
    void loadSurrenderRequests();
  };

  const handleScheduleIntake = async (
    request: AnimalSurrenderRequest,
    scheduledIntakeAt: string,
    scheduledIntakeNote: string
  ) => {
    setScheduleBusyId(request.id);
    setHistoryError(null);
    setSuccessMessage(null);

    try {
      const updatedRequest = await scheduleAnimalSurrenderIntake(request.id, {
        scheduledIntakeAt,
        scheduledIntakeNote: scheduledIntakeNote.trim() || undefined,
      });
      setSurrenderRequests((currentRequests) =>
        currentRequests.map((currentRequest) =>
          currentRequest.id === updatedRequest.id ? updatedRequest : currentRequest
        )
      );
      setSuccessMessage("Drop-off scheduled. Shelter staff will confirm intake when you arrive.");
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Could not schedule intake");
    } finally {
      setScheduleBusyId(null);
    }
  };

  const goBackToHub = () => {
    void Haptics.selectionAsync();
    setMode("hub");
    setError(null);
    setSuccessMessage(null);
  };

  const goToNextStep = () => {
    void Haptics.selectionAsync();
    setFormStep((current) => Math.min(current + 1, 2) as FormStep);
  };

  const goToPreviousStep = () => {
    void Haptics.selectionAsync();
    setFormStep((current) => Math.max(current - 1, 0) as FormStep);
  };

  const addPhotoAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    try {
      const nextPhotos = await Promise.all(assets.map(photoAssetToSurrenderPhoto));
      setPhotos((currentPhotos) => [...currentPhotos, ...nextPhotos].slice(0, PHOTO_LIMIT));
    } catch {
      Alert.alert("Photo upload issue", "Could not prepare one of those photos.");
    }
  };

  const pickPhotos = async () => {
    if (photos.length >= PHOTO_LIMIT) {
      Alert.alert("Photo limit reached", `You can attach up to ${PHOTO_LIMIT} photos.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow photo access to choose pet photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.5,
      selectionLimit: Math.max(1, photoSlotsRemaining),
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

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to take pet photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.back,
      mediaTypes: ["images"],
      quality: 0.5,
    });

    if (!result.canceled) {
      await addPhotoAssets(result.assets);
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((currentPhotos) => currentPhotos.filter((photo) => photo.uri !== uri));
  };

  const validate = (anonymousSubmission: boolean) => {
    if (!anonymousSubmission) {
      if (ownerName.trim().length < 2) {
        return "Add your full name.";
      }

      if (!email.trim().includes("@")) {
        return "Add a valid email address.";
      }

      if (phone.trim().length < 6) {
        return "Add a reachable phone number.";
      }

      if (address.trim().length < 5) {
        return "Add your address or area.";
      }
    }

    if (reason.trim().length < 20) {
      return "Tell us a little more about why you need to surrender the animal.";
    }

    if (!acceptedPermanentSurrender) {
      return "Confirm that you understand the surrender is permanent.";
    }

    return null;
  };

  const resetPetFields = () => {
    setAnimalName("");
    setAnimalType("Dog");
    setBreed("");
    setAge("");
    setSex("Unknown");
    setColor("");
    setVaccinated(false);
    setSterilized(false);
    setMicrochipped(false);
    setHealthNotes("");
    setBehaviorNotes("");
    setReason("");
    setUrgency("Within two weeks");
    setAcceptedPermanentSurrender(false);
    setPhotos([]);
  };

  const submitSurrender = async (submitAnonymously: boolean) => {
    setError(null);
    setSuccessMessage(null);

    const validationError = validate(submitAnonymously);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const surrender = await createAnimalSurrenderRequest(
        {
          address: submitAnonymously ? "" : address.trim(),
          age: age.trim() || undefined,
          anonymous: submitAnonymously,
          animalName: animalName.trim() || undefined,
          animalType,
          behaviorNotes: behaviorNotes.trim() || undefined,
          breed: breed.trim() || undefined,
          color: color.trim() || undefined,
          email: submitAnonymously ? "" : email.trim(),
          healthNotes: healthNotes.trim() || undefined,
          images: photos.map(({ dataUri, fileName, mimeType }) => ({
            dataUri,
            fileName,
            mimeType,
          })),
          microchipped,
          ownerName: submitAnonymously ? "" : ownerName.trim(),
          phone: submitAnonymously ? "" : phone.trim(),
          preferredContactMethod,
          reason: reason.trim(),
          sex: sex === "Unknown" ? undefined : sex,
          sterilized,
          urgency,
          vaccinated,
        },
        { anonymous: submitAnonymously }
      );

      void trackSurrenderRequestSubmitted();

      setSuccessMessage(
        submitAnonymously
          ? "Anonymous surrender submitted. It is not linked to your account and no contact details were attached."
          : "Request submitted. The intake team will contact you."
      );
      if (!submitAnonymously) {
        setSurrenderRequests((currentRequests) => [surrender, ...currentRequests]);
      }
      resetPetFields();
      setFormStep(0);
      setMode("history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit surrender request");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSurrender = () => {
    if (loading) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    const validationError = validate(isAnonymousSubmission);

    if (validationError) {
      setError(validationError);
      return;
    }

    void submitSurrender(isAnonymousSubmission);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: tabBarHeight + vs(36) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screenBar}>
            {mode !== "hub" ? (
              <Pressable
                accessibilityLabel="Back to surrender options"
                accessibilityRole="button"
                onPress={goBackToHub}
                style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
              >
                <Ionicons color={colors.charcoal} name="chevron-back" size={22} />
              </Pressable>
            ) : null}
            <View style={styles.screenTitleBlock}>
              <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.screenTitle}>
                {mode === "form" ? "New surrender" : mode === "history" ? "My surrenders" : "Surrender"}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Surrender request help"
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  "Surrender help",
                  "Add the animal details and choose whether to link the request to your account. Anonymous submissions include no contact details and cannot be tracked. Once shelter intake is completed, the surrender is permanent."
                )
              }
              style={({ pressed }) => [styles.helpButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.charcoal} name="help" size={19} />
            </Pressable>
          </View>

          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }, { scale: contentScale }],
            }}
          >
          {mode === "hub" ? (
            <>
              <Animated.View style={[styles.heroPanel, { transform: [{ scale: heroPulse }] }]}>
                <ImageBackground
                  imageStyle={styles.heroPhoto}
                  resizeMode="cover"
                  source={require("../../assets/animals/dogs/spca-bad-weather-02-e1751537972969-696x579.jpg")}
                  style={styles.heroImageBackground}
                >
                  <View style={styles.heroShade} />
                  <View style={styles.heroContent}>
                    <View style={styles.heroBadgeCircle}>
                      <Ionicons color={colors.white} name="paw-outline" size={26} />
                    </View>
                    <View style={styles.heroCopy}>
                      <Text style={styles.heroTitle}>{"We're here to help."}</Text>
                      <Text style={styles.heroSubtitle}>Request safe surrender support for your pet.</Text>
                    </View>
                  </View>
                </ImageBackground>
              </Animated.View>

              <View style={styles.hubActions}>
                <HubActionCard
                  iconSource={require("../../assets/UI/icons/surrender icon.png")}
                  onPress={openForm}
                  subtitle="Start a new intake request"
                  title="New surrender"
                />
                <HubActionCard
                  icon="file-tray-full-outline"
                  onPress={openHistory}
                  subtitle={
                    user?.id
                      ? `${surrenderRequests.length} saved request${surrenderRequests.length === 1 ? "" : "s"}`
                      : "Sign in to view saved requests"
                  }
                  title="Track requests"
                />
              </View>

              <View style={styles.privacyNote}>
                <View style={styles.privacyIcon}>
                  <Ionicons color={colors.primary} name="shield-checkmark" size={22} />
                </View>
                <View style={styles.privacyCopy}>
                  <Text style={styles.privacyTitle}>Private options are available.</Text>
                  <Text style={styles.privacyText}>
                    Anonymous requests contain no account or contact details and cannot be tracked in the app.
                  </Text>
                </View>
              </View>

              {historyError ? (
                <View style={styles.feedbackPanel}>
                  <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
                  <Text style={styles.errorText}>{historyError}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {mode === "history" ? (
            <>
              {successMessage ? (
                <View style={[styles.feedbackPanel, styles.successPanel]}>
                  <Ionicons color={colors.accent} name="checkmark-circle-outline" size={18} />
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {historyError ? (
                <View style={styles.feedbackPanel}>
                  <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
                  <Text style={styles.errorText}>{historyError}</Text>
                </View>
              ) : null}

              {!user?.id ? (
                <View style={styles.emptyState}>
                  <Ionicons color={colors.primary} name="lock-closed-outline" size={30} />
                  <Text style={styles.emptyTitle}>
                    {successMessage ? "Anonymous requests cannot be tracked" : "Sign in to track requests"}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {successMessage
                      ? "This request was not linked to an account. Shelter staff can still review it."
                      : "Only requests linked to your account appear here."}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push("/login")}
                    style={({ pressed }) => [styles.emptyAction, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.emptyActionText}>Sign in</Text>
                  </Pressable>
                </View>
              ) : historyLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Loading...</Text>
                </View>
              ) : surrenderRequests.length ? (
                <View style={styles.requestList}>
                  {surrenderRequests.map((request) => (
                    <SurrenderRequestCard
                      busy={scheduleBusyId === request.id}
                      key={request.id}
                      onSchedule={handleScheduleIntake}
                      request={request}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons color={colors.primary} name="paw-outline" size={30} />
                  <Text style={styles.emptyTitle}>No requests yet</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openForm}
                    style={({ pressed }) => [styles.emptyAction, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.emptyActionText}>Create one</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : null}

          {mode === "form" ? (
            <>
              {isGuest ? (
                <View style={styles.guestPrivacyNotice}>
                  <View style={styles.guestPrivacyIcon}>
                    <Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} />
                  </View>
                  <Text style={styles.guestPrivacyText}>
                    You are not logged in, so this surrender will be anonymous. No account, name, contact details, or address will be attached, and you will not be able to track it in the app.
                  </Text>
                </View>
              ) : null}

              <View style={styles.stepHeader}>
                <View>
                  <Text style={styles.stepLabel}>Step {formStep + 1} of {formSteps.length}</Text>
                  <Text style={styles.stepTitle}>
                    {formStep === 2 && isAnonymousSubmission ? "Privacy" : formSteps[formStep]}
                  </Text>
                </View>
                <View style={styles.stepDots}>
                  {formSteps.map((step, index) => (
                    <View
                      key={step}
                      style={[
                        styles.stepDot,
                        index <= formStep ? styles.stepDotActive : null,
                      ]}
                    >
                      <Text style={[styles.stepDotText, index <= formStep ? styles.stepDotTextActive : null]}>
                        {index + 1}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {formStep === 0 ? (
                <View style={styles.section}>
                  <View style={styles.uploadBox}>
                    {photos.length ? (
                      <ScrollView
                        contentContainerStyle={styles.previewList}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        {photos.map((photo, index) => (
                          <View key={`${photo.uri}-${index}`} style={styles.previewItem}>
                            <Image resizeMode="cover" source={{ uri: photo.uri }} style={styles.previewImage} />
                            <Pressable
                              accessibilityLabel="Remove photo"
                              accessibilityRole="button"
                              onPress={() => removePhoto(photo.uri)}
                              style={({ pressed }) => [
                                styles.removePhotoButton,
                                pressed ? styles.pressed : null,
                              ]}
                            >
                              <Ionicons color={colors.white} name="close" size={15} />
                            </Pressable>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <View style={styles.emptyUpload}>
                        <View style={styles.uploadIconCircle}>
                          <Ionicons color={colors.primary} name="camera-outline" size={28} />
                        </View>
                        <Text style={styles.uploadTitle}>Add photos</Text>
                      </View>
                    )}
                    <View style={styles.photoActionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={takePhoto}
                        style={({ pressed }) => [
                          styles.photoActionButton,
                          styles.primaryPhotoAction,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Ionicons color={colors.white} name="camera" size={18} />
                        <Text style={styles.primaryPhotoActionText}>Camera</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={pickPhotos}
                        style={({ pressed }) => [styles.photoActionButton, pressed ? styles.pressed : null]}
                      >
                        <Ionicons color={colors.primary} name="image-outline" size={18} />
                        <Text style={styles.photoActionText}>Gallery</Text>
                      </Pressable>
                    </View>
                  </View>

                  <ChoiceChips
                    label="Type"
                    onChange={setAnimalType}
                    options={animalTypeOptions}
                    required
                    value={animalType}
                  />
                  <View style={styles.formGrid}>
                    <TextField label="Name" onChangeText={setAnimalName} placeholder="Max" value={animalName} />
                    <TextField label="Breed" onChangeText={setBreed} placeholder="Mixed" value={breed} />
                    <TextField label="Age" onChangeText={setAge} placeholder="3 years" value={age} />
                    <TextField label="Colour" onChangeText={setColor} placeholder="Brown" value={color} />
                  </View>
                  <ChoiceChips label="Sex" onChange={setSex} options={sexOptions} value={sex} />
                  <View style={styles.toggleRow}>
                    <TogglePill
                      active={vaccinated}
                      icon="shield-checkmark-outline"
                      label="Vaccinated"
                      onPress={() => setVaccinated((current) => !current)}
                    />
                    <TogglePill
                      active={sterilized}
                      icon="checkmark-circle-outline"
                      label="Sterilised"
                      onPress={() => setSterilized((current) => !current)}
                    />
                    <TogglePill
                      active={microchipped}
                      icon="radio-outline"
                      label="Microchipped"
                      onPress={() => setMicrochipped((current) => !current)}
                    />
                  </View>
                </View>
              ) : null}

              {formStep === 1 ? (
                <View style={styles.section}>
                  <ChoiceChips
                    label="Urgency"
                    onChange={setUrgency}
                    options={urgencyOptions}
                    required
                    value={urgency}
                  />
                  <View style={styles.permanentNotice}>
                    <View style={styles.permanentNoticeIcon}>
                      <Ionicons color={colors.danger} name="information-circle" size={21} />
                    </View>
                    <View style={styles.noticeCopy}>
                      <Text style={styles.permanentNoticeTitle}>Surrender is permanent</Text>
                      <Text style={styles.permanentNoticeText}>
                        Once the animal is handed over and shelter intake is completed, ownership transfers to the SPCA and the animal cannot be reclaimed.
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.fieldGroup, styles.fullWidthField]}>
                    <FieldLabel label="Details" required />
                    <TextInput
                      maxLength={1200}
                      multiline
                      onChangeText={setReason}
                      placeholder="Why are you surrendering?"
                      placeholderTextColor="#7A8797"
                      style={[styles.fieldControl, styles.textInput, styles.reasonInput]}
                      textAlignVertical="top"
                      value={reason}
                    />
                    <Text style={styles.characterCount}>{reasonLength}/1200</Text>
                  </View>
                  <TextField
                    fullWidth
                    label="Health"
                    multiline
                    onChangeText={setHealthNotes}
                    placeholder="Medication, injuries..."
                    value={healthNotes}
                  />
                  <TextField
                    fullWidth
                    label="Behaviour"
                    multiline
                    onChangeText={setBehaviorNotes}
                    placeholder="Temperament, triggers..."
                    value={behaviorNotes}
                  />
                </View>
              ) : null}

              {formStep === 2 ? (
                <View style={styles.section}>
                  {!isGuest ? (
                    <View style={styles.privacyChoiceGroup}>
                      <FieldLabel label="Submission privacy" />
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: submitAnonymously }}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setSubmitAnonymously((current) => !current);
                        }}
                        style={({ pressed }) => [
                          styles.selectionCard,
                          submitAnonymously ? styles.selectionCardActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.selectionCheckbox,
                            submitAnonymously ? styles.selectionCheckboxActive : null,
                          ]}
                        >
                          {submitAnonymously ? (
                            <Ionicons color={colors.white} name="checkmark" size={15} />
                          ) : null}
                        </View>
                        <View style={styles.noticeCopy}>
                          <Text style={styles.selectionCardTitle}>Submit anonymously</Text>
                          <Text style={styles.selectionCardText}>
                            Do not link this request to my account or attach my name, contact details, or address. Anonymous requests cannot be tracked.
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  ) : null}

                  {!isAnonymousSubmission ? (
                    <>
                      <View style={styles.formGrid}>
                        <TextField label="Name" onChangeText={setOwnerName} required value={ownerName} />
                        <TextField
                          keyboardType="email-address"
                          label="Email"
                          onChangeText={setEmail}
                          required
                          value={email}
                        />
                        <TextField
                          keyboardType="phone-pad"
                          label="Phone"
                          onChangeText={setPhone}
                          required
                          value={phone}
                        />
                      </View>
                      <ChoiceChips
                        label="Contact method"
                        onChange={setPreferredContactMethod}
                        options={contactMethodOptions}
                        value={preferredContactMethod}
                      />
                      <TextField
                        fullWidth
                        label="Address"
                        multiline
                        onChangeText={setAddress}
                        placeholder="Street, suburb, city"
                        required
                        value={address}
                      />
                    </>
                  ) : (
                    <View style={styles.anonymousSummary}>
                      <Ionicons color={colors.primary} name="eye-off-outline" size={21} />
                      <Text style={styles.anonymousSummaryText}>
                        Shelter staff will receive the animal, reason, urgency, and photo details only.
                      </Text>
                    </View>
                  )}

                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: acceptedPermanentSurrender }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setAcceptedPermanentSurrender((current) => !current);
                    }}
                    style={({ pressed }) => [
                      styles.permanentConfirmation,
                      acceptedPermanentSurrender ? styles.permanentConfirmationActive : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.selectionCheckbox,
                        acceptedPermanentSurrender ? styles.selectionCheckboxActive : null,
                      ]}
                    >
                      {acceptedPermanentSurrender ? (
                        <Ionicons color={colors.white} name="checkmark" size={15} />
                      ) : null}
                    </View>
                    <View style={styles.noticeCopy}>
                      <Text style={styles.selectionCardTitle}>
                        I understand that surrender is permanent
                      </Text>
                      <Text style={styles.selectionCardText}>
                        After handover and completed intake, I transfer ownership to the SPCA and cannot reclaim the animal.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}

              {error ? (
                <View style={styles.feedbackPanel}>
                  <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.formFooter}>
                <Pressable
                  accessibilityRole="button"
                  onPress={formStep === 0 ? goBackToHub : goToPreviousStep}
                  style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.secondaryButtonText}>{formStep === 0 ? "Cancel" : "Back"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={formStep === 2 ? handleSubmitSurrender : goToNextStep}
                  style={({ pressed }) => [
                    styles.submitButton,
                    loading ? styles.disabledButton : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.submitButtonText}>
                    {formStep === 2
                      ? loading
                        ? "Submitting..."
                        : isAnonymousSubmission
                          ? "Submit anonymously"
                          : "Submit"
                      : "Continue"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F6FBFF",
    flex: 1,
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(10),
    width: "100%",
  },
  screenBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "space-between",
    marginBottom: vs(12),
    minHeight: vs(48),
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    height: rs(42),
    justifyContent: "center",
    shadowColor: "#0B3554",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: rs(42),
  },
  screenTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: rs(12),
  },
  screenTitle: {
    color: colors.charcoal,
    fontSize: ms(30),
    fontWeight: "900",
    lineHeight: ms(36),
  },
  helpButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    height: rs(42),
    justifyContent: "center",
    shadowColor: "#0B3554",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: rs(42),
  },
  heroPanel: {
    backgroundColor: colors.charcoal,
    borderRadius: 0,
    elevation: 4,
    marginBottom: vs(16),
    marginHorizontal: -PAGE_PADDING,
    minHeight: HERO_HEIGHT,
    overflow: "hidden",
    shadowColor: "#0B3554",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  heroImageBackground: {
    minHeight: HERO_HEIGHT,
    width: "100%",
  },
  heroPhoto: {
    borderRadius: 0,
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(5, 77, 125, 0.48)",
  },
  heroContent: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: HERO_HEIGHT,
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: vs(16),
  },
  heroBadgeCircle: {
    alignItems: "center",
    backgroundColor: "rgba(5, 67, 106, 0.58)",
    borderRadius: 999,
    height: rs(58),
    justifyContent: "center",
    width: rs(58),
  },
  heroCopy: {
    maxWidth: rs(310),
  },
  heroTitle: {
    color: colors.white,
    fontSize: ms(32),
    fontWeight: "900",
    lineHeight: ms(38),
  },
  heroSubtitle: {
    color: "#F1F7FB",
    fontSize: ms(14),
    fontWeight: "800",
    lineHeight: ms(20),
    marginTop: vs(8),
  },
  hubActions: {
    gap: vs(12),
  },
  hubActionCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    elevation: 4,
    flexDirection: "row",
    gap: rs(12),
    minHeight: vs(92),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
    shadowColor: "#0B3554",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  hubActionIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: rs(54),
    justifyContent: "center",
    width: rs(54),
  },
  hubActionIconImage: {
    height: rs(49),
    width: rs(49),
  },
  hubActionCopy: {
    flex: 1,
    minWidth: 0,
  },
  hubActionTitle: {
    color: colors.charcoal,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
  },
  hubActionSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontWeight: "700",
    lineHeight: ms(18),
    marginTop: vs(2),
  },
  privacyNote: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(15, 110, 168, 0.13)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginTop: vs(14),
    paddingHorizontal: rs(12),
    paddingVertical: vs(11),
  },
  privacyIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  privacyCopy: {
    flex: 1,
    minWidth: 0,
  },
  privacyTitle: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(17),
  },
  privacyText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(2),
  },
  requestList: {
    gap: vs(10),
  },
  requestCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    elevation: 4,
    flexDirection: "row",
    gap: rs(12),
    minHeight: vs(92),
    padding: rs(13),
    shadowColor: "#0B3554",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
  },
  requestImage: {
    borderRadius: 8,
    height: rs(68),
    width: rs(68),
  },
  requestImageFallback: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: rs(68),
    justifyContent: "center",
    width: rs(68),
  },
  requestCopy: {
    flex: 1,
    gap: vs(7),
    minWidth: 0,
  },
  requestTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
  },
  requestTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  requestDate: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: rs(9),
    paddingVertical: vs(5),
  },
  statusPillText: {
    color: colors.primary,
    fontSize: ms(11),
    fontWeight: "900",
  },
  requestPrompt: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
  },
  schedulePanel: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(15, 110, 168, 0.13)",
    borderRadius: 8,
    borderWidth: 1,
    gap: vs(8),
    marginTop: vs(2),
    padding: rs(10),
  },
  scheduleFields: {
    flexDirection: "row",
    gap: rs(8),
  },
  scheduleField: {
    flex: 1,
    minWidth: 0,
  },
  scheduleLabel: {
    color: colors.charcoal,
    fontSize: ms(10),
    fontWeight: "900",
    lineHeight: ms(14),
    marginBottom: vs(4),
    textTransform: "uppercase",
  },
  scheduleInput: {
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "800",
    minHeight: vs(42),
    paddingHorizontal: rs(10),
  },
  schedulePickerButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "rgba(15, 110, 168, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(7),
    minHeight: vs(42),
    paddingHorizontal: rs(10),
  },
  schedulePickerText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "800",
  },
  scheduleTimezone: {
    color: colors.textSecondary,
    fontSize: ms(10),
    lineHeight: ms(14),
  },
  scheduleNoteInput: {
    minHeight: vs(64),
    paddingTop: vs(9),
    textAlignVertical: "top",
  },
  scheduleError: {
    color: colors.danger,
    fontSize: ms(11),
    fontWeight: "800",
    lineHeight: ms(15),
  },
  scheduleButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(7),
    justifyContent: "center",
    minHeight: vs(44),
  },
  scheduleButtonText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    elevation: 6,
    gap: vs(8),
    minHeight: vs(210),
    justifyContent: "center",
    padding: rs(18),
    shadowColor: "#0B3554",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  emptyTitle: {
    color: colors.charcoal,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(21),
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
    maxWidth: rs(290),
    textAlign: "center",
  },
  emptyAction: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: vs(46),
    minWidth: rs(170),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(18),
    paddingVertical: vs(9),
  },
  emptyActionText: {
    color: colors.white,
    fontSize: ms(13),
    fontWeight: "900",
  },
  guestPrivacyNotice: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(15, 110, 168, 0.14)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(10),
    paddingHorizontal: rs(12),
    paddingVertical: vs(11),
  },
  guestPrivacyIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: rs(38),
    justifyContent: "center",
    width: rs(38),
  },
  guestPrivacyText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(17),
  },
  stepHeader: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(10),
    minHeight: vs(74),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
    shadowColor: "#0B3554",
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  stepLabel: {
    color: colors.primary,
    fontSize: ms(9),
    fontWeight: "900",
    lineHeight: ms(13),
    textTransform: "uppercase",
  },
  stepTitle: {
    color: colors.charcoal,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
    marginTop: vs(1),
  },
  stepDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(6),
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#DDE7EF",
    borderRadius: 999,
    height: rs(30),
    justifyContent: "center",
    width: rs(30),
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "900",
  },
  stepDotTextActive: {
    color: colors.white,
  },
  section: {
    backgroundColor: colors.white,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 0,
    elevation: 3,
    marginBottom: vs(10),
    padding: rs(11),
    shadowColor: "#0B3554",
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(9),
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: rs(30),
    justifyContent: "center",
    width: rs(30),
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(19),
  },
  uploadBox: {
    backgroundColor: "#FAFCFE",
    borderColor: "rgba(15, 110, 168, 0.22)",
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1.2,
    marginBottom: vs(10),
    minHeight: vs(126),
    padding: rs(11),
  },
  emptyUpload: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
    justifyContent: "center",
    minHeight: vs(64),
  },
  uploadIconCircle: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: rs(46),
    justifyContent: "center",
    width: rs(46),
  },
  emptyUploadCopy: {
    flex: 1,
    minWidth: 0,
  },
  uploadTitle: {
    color: colors.text,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  previewList: {
    gap: rs(8),
    paddingBottom: vs(3),
  },
  previewItem: {
    borderRadius: 8,
    height: rs(78),
    overflow: "hidden",
    width: rs(78),
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
    gap: rs(8),
    marginTop: vs(10),
  },
  photoActionButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(42),
    paddingHorizontal: rs(8),
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
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
  },
  fieldGroup: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: rs(148),
    marginBottom: vs(9),
  },
  fullWidthField: {
    flexBasis: "100%",
    width: "100%",
  },
  choiceGroup: {
    marginBottom: vs(10),
    width: "100%",
  },
  permanentNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderColor: "#F5C2BD",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(9),
    marginBottom: vs(10),
    paddingHorizontal: rs(11),
    paddingVertical: vs(10),
  },
  permanentNoticeIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(34),
    justifyContent: "center",
    width: rs(34),
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  permanentNoticeTitle: {
    color: colors.danger,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  permanentNoticeText: {
    color: colors.charcoal,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
    marginTop: vs(2),
  },
  privacyChoiceGroup: {
    marginBottom: vs(10),
  },
  selectionCard: {
    alignItems: "flex-start",
    backgroundColor: colors.lightgray,
    borderColor: "rgba(72, 105, 133, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    paddingHorizontal: rs(11),
    paddingVertical: vs(11),
  },
  selectionCardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectionCheckbox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.textSecondary,
    borderRadius: 5,
    borderWidth: 1.5,
    height: rs(22),
    justifyContent: "center",
    marginTop: vs(1),
    width: rs(22),
  },
  selectionCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionCardTitle: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  selectionCardText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
    marginTop: vs(2),
  },
  anonymousSummary: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(15, 110, 168, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(9),
    marginBottom: vs(10),
    paddingHorizontal: rs(11),
    paddingVertical: vs(10),
  },
  anonymousSummaryText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "800",
    lineHeight: ms(17),
  },
  permanentConfirmation: {
    alignItems: "flex-start",
    backgroundColor: colors.white,
    borderColor: "#F5C2BD",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    marginTop: vs(2),
    paddingHorizontal: rs(11),
    paddingVertical: vs(11),
  },
  permanentConfirmationActive: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.danger,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
  },
  choiceChip: {
    alignItems: "center",
    flexBasis: rs(104),
    flexDirection: "row",
    flexGrow: 1,
    gap: rs(5),
    backgroundColor: colors.lightgray,
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: vs(40),
    paddingHorizontal: rs(10),
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "900",
  },
  choiceChipTextActive: {
    color: colors.white,
  },
  fieldLabel: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
    marginBottom: vs(5),
  },
  required: {
    color: colors.danger,
  },
  fieldControl: {
    alignItems: "center",
    backgroundColor: "#FBFCFE",
    borderColor: "rgba(72, 105, 133, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: vs(42),
    paddingHorizontal: rs(10),
  },
  textInput: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "600",
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: vs(76),
    paddingTop: vs(9),
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
    marginBottom: vs(6),
    marginTop: vs(2),
  },
  togglePill: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "#C7E2F2",
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    flexDirection: "row",
    gap: rs(6),
    justifyContent: "center",
    minHeight: vs(40),
    paddingHorizontal: rs(10),
  },
  togglePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  togglePillText: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "900",
  },
  togglePillTextActive: {
    color: colors.white,
  },
  reasonInput: {
    minHeight: vs(104),
    paddingBottom: vs(20),
    paddingTop: vs(9),
  },
  characterCount: {
    bottom: vs(10),
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "800",
    position: "absolute",
    right: rs(12),
  },
  feedbackPanel: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: "#F5C2BD",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(12),
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
    fontWeight: "800",
    lineHeight: ms(18),
  },
  successText: {
    color: colors.accent,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(18),
  },
  formFooter: {
    flexDirection: "row",
    gap: rs(10),
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: vs(48),
    paddingHorizontal: rs(12),
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    elevation: 4,
    flex: 1,
    flexDirection: "row",
    gap: rs(9),
    justifyContent: "center",
    minHeight: vs(48),
    paddingHorizontal: rs(12),
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  disabledButton: {
    opacity: 0.62,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: ms(15),
    fontWeight: "900",
    lineHeight: ms(20),
  },
  pressed: {
    opacity: 0.72,
  },
});
