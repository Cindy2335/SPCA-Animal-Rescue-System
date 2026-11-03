import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentProps, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  shelterAnimalToAdoptionAnimal,
  type AdoptionAnimal,
} from "../data/adoptionAnimals";
import {
  createAdoptionApplication,
  getShelterAnimalById,
  searchAddresses,
  type AddressSuggestion,
  type AdoptionDocumentInput,
  type AuthUser,
} from "../services/api";
import { trackAdoptionApplicationSubmitted } from "../services/analytics";
import colors from "../theme/colors";
import { CONTENT_MAX_WIDTH, ms, PAGE_PADDING, rs, TOUCH_TARGET, vs } from "../theme/responsive";

type TextFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  onChangeText: (value: string) => void;
};

const housingTypes = ["Apartment", "House", "Townhouse", "Farm/Smallholding", "Other"];
const PRIMARY = colors.primary;
const PRIMARY_DARK = colors.primaryDark;
const SOFT_BLUE = colors.primarySoft;
const FIELD_BORDER = "#D6EAF6";
const DRAFT_KEY_PREFIX = "adoption-application-draft:";
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

type AdoptionUploadDocument = AdoptionDocumentInput & {
  ownerId: string;
  size: number;
};

type DocumentField = "identity" | "residence";

type AdoptionApplicationDraft = {
  housingType: string;
  hasYard: boolean;
  hasOtherPets: boolean;
  otherPetsDetails: string;
  experience: string;
  reason: string;
  schedule: string;
  householdAgreement: boolean;
};

function inferDocumentMimeType(asset: DocumentPicker.DocumentPickerAsset) {
  const reportedMimeType = asset.mimeType?.toLowerCase().trim();

  if (reportedMimeType === "image/jpg") return "image/jpeg";
  if (reportedMimeType && reportedMimeType !== "application/octet-stream") {
    return reportedMimeType;
  }

  const extension = asset.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  return reportedMimeType ?? "";
}

function getBase64ByteSize(dataUri: string) {
  const base64 = dataUri.split(",").pop() ?? "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function documentAssetToUpload(
  asset: DocumentPicker.DocumentPickerAsset,
  ownerId: string
): Promise<AdoptionUploadDocument> {
  try {
    const mimeType = inferDocumentMimeType(asset);

    if (!ALLOWED_DOCUMENT_MIME_TYPES.some((allowedType) => allowedType === mimeType)) {
      throw new Error("Choose a PDF, JPEG, or PNG file.");
    }

    if (asset.size && asset.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error("Choose a file no larger than 5 MB.");
    }

    const encodedFile =
      asset.base64 ??
      (await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    const dataUriSeparator = encodedFile.indexOf(",");
    const base64 = encodedFile.startsWith("data:")
      ? encodedFile.slice(dataUriSeparator + 1)
      : encodedFile;
    const dataUri = `data:${mimeType};base64,${base64}`;
    const size = asset.size ?? getBase64ByteSize(dataUri);

    if (size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error("Choose a file no larger than 5 MB.");
    }

    return {
      dataUri,
      fileName: asset.name || `adoption-document-${Date.now()}`,
      mimeType,
      ownerId,
      size,
    };
  } finally {
    if (Platform.OS === "web") {
      if (typeof URL !== "undefined" && asset.uri.startsWith("blob:")) {
        URL.revokeObjectURL(asset.uri);
      }
    } else {
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined);
    }
  }
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={rs(18)} color={PRIMARY} />
      </View>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
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

function TextField({
  label,
  value,
  placeholder,
  required,
  multiline,
  keyboardType = "default",
  onChangeText,
}: TextFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.fieldControl, multiline ? styles.multilineInput : null]}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.toggleRow, pressed ? styles.pressed : null]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value ? styles.toggleTrackOn : null]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : null]} />
      </View>
    </Pressable>
  );
}

function DocumentUploadField({
  label,
  description,
  document,
  picking,
  onPick,
  onRemove,
}: {
  label: string;
  description: string;
  document: AdoptionUploadDocument | null;
  picking: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.documentField}>
      <FieldLabel label={label} required />
      <Text style={styles.documentDescription}>{description}</Text>

      {document ? (
        <View style={styles.selectedDocument}>
          <View style={styles.documentIconWrap}>
            <Ionicons
              name={document.mimeType === "application/pdf" ? "document-text" : "image"}
              size={rs(21)}
              color={PRIMARY}
            />
          </View>
          <View style={styles.selectedDocumentCopy}>
            <Text style={styles.selectedDocumentName} numberOfLines={2}>
              {document.fileName}
            </Text>
            <Text style={styles.selectedDocumentMeta}>
              {document.mimeType === "application/pdf" ? "PDF" : document.mimeType === "image/png" ? "PNG" : "JPEG"}
              {"  ·  "}
              {formatFileSize(document.size)}
            </Text>
          </View>
          <View style={styles.documentActions}>
            <Pressable
              onPress={onPick}
              disabled={picking}
              hitSlop={8}
              style={({ pressed }) => [styles.documentAction, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={`Replace ${label.toLowerCase()}`}
            >
              <Text style={styles.documentActionText}>{picking ? "Opening..." : "Replace"}</Text>
            </Pressable>
            <Pressable
              onPress={onRemove}
              disabled={picking}
              hitSlop={8}
              style={({ pressed }) => [styles.removeDocumentButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label.toLowerCase()}`}
            >
              <Ionicons name="trash-outline" size={rs(18)} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onPick}
          disabled={picking}
          style={({ pressed }) => [
            styles.documentPicker,
            picking ? styles.disabledButton : null,
            pressed ? styles.pressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Upload ${label.toLowerCase()}`}
        >
          <View style={styles.documentIconWrap}>
            <Ionicons name="cloud-upload-outline" size={rs(22)} color={PRIMARY} />
          </View>
          <View style={styles.documentPickerCopy}>
            <Text style={styles.documentPickerTitle}>{picking ? "Opening files..." : "Choose file"}</Text>
            <Text style={styles.documentPickerHint}>PDF, JPEG or PNG · Maximum 5 MB</Text>
          </View>
          <Ionicons name="chevron-forward" size={rs(18)} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function validateEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export default function AdoptionApplicationScreen() {
  const { user } = useAuth();
  const { animalId } = useLocalSearchParams<{ animalId?: string }>();

  return (
    <AdoptionApplicationForm
      key={`${user?.id ?? "guest"}:${animalId ?? "unknown"}`}
      animalId={animalId}
      user={user}
    />
  );
}

function AdoptionApplicationForm({
  user,
  animalId,
}: {
  user: AuthUser | null;
  animalId?: string;
}) {
  const [remoteAnimal, setRemoteAnimal] = useState<AdoptionAnimal | null>(null);
  const animal = remoteAnimal;

  const [applicantName, setApplicantName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [housingType, setHousingType] = useState("House");
  const [hasYard, setHasYard] = useState(false);
  const [hasOtherPets, setHasOtherPets] = useState(false);
  const [otherPetsDetails, setOtherPetsDetails] = useState("");
  const [experience, setExperience] = useState("");
  const [reason, setReason] = useState("");
  const [schedule, setSchedule] = useState("");
  const [householdAgreement, setHouseholdAgreement] = useState(false);
  const [identityDocument, setIdentityDocument] = useState<AdoptionUploadDocument | null>(null);
  const [proofOfResidenceDocument, setProofOfResidenceDocument] =
    useState<AdoptionUploadDocument | null>(null);
  const [pickingDocument, setPickingDocument] = useState<DocumentField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);

  const draftKey = user?.id && animalId ? `${DRAFT_KEY_PREFIX}${user.id}:${animalId}` : null;
  const legacyDraftKey = animalId ? `${DRAFT_KEY_PREFIX}${animalId}` : null;
  const currentIdentityDocument =
    identityDocument?.ownerId === user?.id ? identityDocument : null;
  const currentProofOfResidenceDocument =
    proofOfResidenceDocument?.ownerId === user?.id ? proofOfResidenceDocument : null;

  const continueToSignIn = () => {
    if (!animalId) {
      router.push("/login");
      return;
    }

    router.push({
      pathname: "/login",
      params: { redirect: "/adoption-application", animalId },
    });
  };

  useEffect(() => {
    let mounted = true;

    if (animalId) {
      getShelterAnimalById(animalId)
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
  }, [animalId]);

  useEffect(() => {
    const query = address.trim();

    if (selectedAddress?.label === query || query.length < 3) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setAddressSearchLoading(true);
      setAddressSearchError(null);
      void searchAddresses(query)
        .then((suggestions) => {
          if (active) setAddressSuggestions(suggestions);
        })
        .catch(() => {
          if (active) {
            setAddressSuggestions([]);
            setAddressSearchError(
              "Address suggestions are unavailable. You can continue with the address you entered."
            );
          }
        })
        .finally(() => {
          if (active) setAddressSearchLoading(false);
        });
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, selectedAddress]);

  useEffect(() => {
    if (legacyDraftKey) {
      void AsyncStorage.removeItem(legacyDraftKey);
    }
  }, [legacyDraftKey]);

  useEffect(() => {
    let mounted = true;

    if (!draftKey) {
      return () => {
        mounted = false;
      };
    }

    AsyncStorage.getItem(draftKey)
      .then((storedDraft) => {
        if (!mounted || !storedDraft) return;
        const draft = JSON.parse(storedDraft) as Partial<AdoptionApplicationDraft>;
        if (typeof draft.housingType === "string") setHousingType(draft.housingType);
        if (typeof draft.hasYard === "boolean") setHasYard(draft.hasYard);
        if (typeof draft.hasOtherPets === "boolean") setHasOtherPets(draft.hasOtherPets);
        if (typeof draft.otherPetsDetails === "string") setOtherPetsDetails(draft.otherPetsDetails);
        if (typeof draft.experience === "string") setExperience(draft.experience);
        if (typeof draft.reason === "string") setReason(draft.reason);
        if (typeof draft.schedule === "string") setSchedule(draft.schedule);
        if (typeof draft.householdAgreement === "boolean") setHouseholdAgreement(draft.householdAgreement);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoadedDraftKey(draftKey);
      });

    return () => {
      mounted = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || loadedDraftKey !== draftKey) return;

    const draft: AdoptionApplicationDraft = {
      housingType,
      hasYard,
      hasOtherPets,
      otherPetsDetails,
      experience,
      reason,
      schedule,
      householdAgreement,
    };

    void AsyncStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    draftKey, experience, hasOtherPets, hasYard, householdAgreement, housingType, loadedDraftKey,
    otherPetsDetails, reason, schedule,
  ]);

  const pickSupportingDocument = async (field: DocumentField) => {
    const ownerId = user?.id;

    if (!ownerId) {
      Alert.alert(
        "Sign in before uploading",
        "For your privacy, identity documents are kept only in the current signed-in application session.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: continueToSignIn },
        ]
      );
      return;
    }

    setPickingDocument(field);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ALLOWED_DOCUMENT_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
        base64: Platform.OS === "web",
      });

      if (result.canceled) return;

      const document = await documentAssetToUpload(result.assets[0], ownerId);
      if (field === "identity") {
        setIdentityDocument(document);
      } else {
        setProofOfResidenceDocument(document);
      }
      setError(null);
    } catch (e) {
      Alert.alert(
        "File not accepted",
        e instanceof Error ? e.message : "Choose a PDF, JPEG, or PNG file no larger than 5 MB."
      );
    } finally {
      setPickingDocument(null);
    }
  };

  const removeSupportingDocument = (field: DocumentField) => {
    if (field === "identity") {
      setIdentityDocument(null);
    } else {
      setProofOfResidenceDocument(null);
    }
    setError(null);
  };

  if (!animal) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.missingState}>
          <Ionicons name="heart-outline" size={34} color={PRIMARY} />
          <Text style={styles.missingTitle}>Pet profile not found</Text>
          <Pressable
            onPress={() => router.replace("/adoption")}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Back to adoption</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const submitApplication = async () => {
    setError(null);

    if (!user?.id) {
      Alert.alert(
        "Sign in required",
        "Please sign in before applying so the shelter can link this adoption application to your account and send you updates.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: continueToSignIn },
        ]
      );
      return;
    }

    const trimmedName = applicantName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    const trimmedReason = reason.trim();

    if (trimmedName.length < 2) {
      setError("Add your full name.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Add a valid email address.");
      return;
    }

    if (trimmedPhone.length < 6) {
      setError("Add a phone number the shelter can reach you on.");
      return;
    }

    if (trimmedAddress.length < 5) {
      setError("Add your home address or suburb.");
      return;
    }

    if (hasOtherPets && otherPetsDetails.trim().length < 2) {
      setError("Tell us a little about your current pets.");
      return;
    }

    if (trimmedReason.length < 20) {
      setError(`Tell us why ${animal.name} is a good fit for your home.`);
      return;
    }

    if (!currentIdentityDocument) {
      setError("Upload a government-issued ID or passport.");
      return;
    }

    if (!currentProofOfResidenceDocument) {
      setError("Upload proof of your residential address.");
      return;
    }

    if (!householdAgreement) {
      setError("Confirm that everyone at home agrees to the adoption.");
      return;
    }

    setLoading(true);

    try {
      await createAdoptionApplication({
        animalId: animal.id,
        applicantName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        address: trimmedAddress,
        housingType,
        hasYard,
        hasOtherPets,
        otherPetsDetails: otherPetsDetails.trim() || undefined,
        experience: experience.trim() || undefined,
        reason: trimmedReason,
        schedule: schedule.trim() || undefined,
        householdAgreement: true,
        identityDocument: {
          dataUri: currentIdentityDocument.dataUri,
          fileName: currentIdentityDocument.fileName,
          mimeType: currentIdentityDocument.mimeType,
        },
        proofOfResidenceDocument: {
          dataUri: currentProofOfResidenceDocument.dataUri,
          fileName: currentProofOfResidenceDocument.fileName,
          mimeType: currentProofOfResidenceDocument.mimeType,
        },
      });

      void trackAdoptionApplicationSubmitted();

      if (draftKey) {
        try {
          await AsyncStorage.removeItem(draftKey);
        } catch (cleanupError) {
          if (__DEV__) {
            console.warn("The submitted adoption draft could not be removed.", cleanupError);
          }
        }
      }

      Alert.alert(
        "Application submitted",
        `Your adoption application for ${animal.name} has been sent to the shelter team.`,
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={28} color={colors.charcoal} />
            </Pressable>
            <Text style={styles.screenTitle}>Adoption Application</Text>
            <View style={styles.iconButton} />
          </View>

          <View style={styles.animalCard}>
            <Image source={animal.image} style={styles.animalImage} resizeMode="cover" />
            <View style={styles.animalCopy}>
              <View style={styles.applicationBadge}>
                <Ionicons name="paw-outline" size={rs(13)} color={PRIMARY} />
                <Text style={styles.applicationBadgeText}>Adoption application</Text>
              </View>
              <Text style={styles.animalName}>{animal.name}</Text>
              <Text style={styles.animalMeta}>
                {animal.age} / {animal.sex} / {animal.breed}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.locationText}>{animal.location}</Text>
              </View>
            </View>
          </View>

          {!user ? (
            <View style={styles.signInPanel}>
              <Ionicons name="lock-closed-outline" size={rs(20)} color={PRIMARY} />
              <Text style={styles.signInPanelText}>
                Sign in before applying so this request is linked to your account.
              </Text>
              <Pressable
                onPress={continueToSignIn}
                style={({ pressed }) => [styles.signInButton, pressed ? styles.pressed : null]}
                accessibilityRole="button"
              >
                <Text style={styles.signInButtonText}>Sign in</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeading
              icon="person-outline"
              title="Contact details"
              subtitle="How the shelter team can reach you."
            />
            <TextField
              label="Full name"
              value={applicantName}
              placeholder="Your full name"
              required
              onChangeText={setApplicantName}
            />
            <TextField
              label="Email"
              value={email}
              placeholder="you@example.com"
              required
              keyboardType="email-address"
              onChangeText={setEmail}
            />
            <TextField
              label="Phone"
              value={phone}
              placeholder="Phone number"
              required
              keyboardType="phone-pad"
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon="home-outline"
              title="Home environment"
              subtitle={`Help us understand where ${animal.name} would live.`}
            />
            <TextField
              label="Address or suburb"
              value={address}
              placeholder="Where will the pet live?"
              required
              onChangeText={(value) => {
                setAddress(value);
                setSelectedAddress(null);
                setAddressSuggestions([]);
                setAddressSearchLoading(false);
                setAddressSearchError(null);
                setError(null);
              }}
            />
            {addressSearchLoading ? (
              <View style={styles.addressSearchState}>
                <Text style={styles.addressSearchStateText}>Finding addresses...</Text>
              </View>
            ) : addressSuggestions.length ? (
              <View style={styles.addressSuggestions}>
                {addressSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => {
                      setAddress(suggestion.label);
                      setSelectedAddress(suggestion);
                      setAddressSuggestions([]);
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.addressSuggestion, pressed ? styles.pressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use address ${suggestion.label}`}
                  >
                    <Ionicons name="location-outline" size={rs(18)} color={PRIMARY} />
                    <Text style={styles.addressSuggestionText}>{suggestion.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : addressSearchError ? (
              <View style={styles.addressSearchState}>
                <Text style={styles.addressSearchStateText}>{addressSearchError}</Text>
              </View>
            ) : address.trim().length >= 3 && !selectedAddress ? (
              <View style={styles.addressSearchState}>
                <Text style={styles.addressSearchStateText}>
                  No exact match found. You can continue with the address you entered.
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <FieldLabel label="Housing type" required />
              <View style={styles.chipGrid}>
                {housingTypes.map((type) => {
                  const selected = housingType === type;

                  return (
                    <Pressable
                      key={type}
                      onPress={() => setHousingType(type)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected ? styles.chipSelected : null,
                        pressed ? styles.pressed : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ToggleRow
              label="I have a secure yard or outdoor area"
              value={hasYard}
              onPress={() => setHasYard((value) => !value)}
            />
            <ToggleRow
              label="There are other pets at home"
              value={hasOtherPets}
              onPress={() => setHasOtherPets((value) => !value)}
            />

            {hasOtherPets ? (
              <TextField
                label="Current pets"
                value={otherPetsDetails}
                placeholder="Tell us their type, age, and temperament"
                multiline
                onChangeText={setOtherPetsDetails}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon="clipboard-outline"
              title="Care plan"
              subtitle="Share the routine and support you can offer."
            />
            <TextField
              label="Pet experience"
              value={experience}
              placeholder="Previous pets, training, rescue experience..."
              multiline
              onChangeText={setExperience}
            />
            <TextField
              label={`Why ${animal.name}?`}
              value={reason}
              placeholder="Tell us why this pet fits your home and lifestyle"
              required
              multiline
              onChangeText={setReason}
            />
            <TextField
              label="Daily routine"
              value={schedule}
              placeholder="Walks, feeding, work hours, care arrangements..."
              multiline
              onChangeText={setSchedule}
            />
          </View>

          <View style={styles.section}>
            <SectionHeading
              icon="documents-outline"
              title="Supporting documents"
              subtitle="Required to verify your identity and residential address."
            />
            {user?.id ? (
              <>
                <View style={styles.documentPrivacyNote}>
                  <Ionicons name="lock-closed-outline" size={rs(17)} color={PRIMARY_DARK} />
                  <Text style={styles.documentPrivacyText}>
                    Only you and authorised shelter administrators can access submitted files.
                    Before submission, files stay only in this session and are not saved in your
                    draft.
                  </Text>
                </View>
                <DocumentUploadField
                  label="Government-issued ID or passport"
                  description="Upload a clear copy of a valid photo identity document."
                  document={currentIdentityDocument}
                  picking={pickingDocument === "identity"}
                  onPick={() => void pickSupportingDocument("identity")}
                  onRemove={() => removeSupportingDocument("identity")}
                />
                <DocumentUploadField
                  label="Proof of residence"
                  description="Upload a recent document showing your residential address."
                  document={currentProofOfResidenceDocument}
                  picking={pickingDocument === "residence"}
                  onPick={() => void pickSupportingDocument("residence")}
                  onRemove={() => removeSupportingDocument("residence")}
                />
              </>
            ) : (
              <View style={styles.documentSignInGate}>
                <View style={styles.documentIconWrap}>
                  <Ionicons name="lock-closed-outline" size={rs(21)} color={PRIMARY} />
                </View>
                <View style={styles.documentPickerCopy}>
                  <Text style={styles.documentPickerTitle}>Sign in before choosing files</Text>
                  <Text style={styles.documentPickerHint}>
                    For your privacy, identity documents are not stored in your application draft.
                  </Text>
                </View>
                <Pressable
                  onPress={continueToSignIn}
                  style={({ pressed }) => [styles.documentGateButton, pressed ? styles.pressed : null]}
                  accessibilityRole="button"
                >
                  <Text style={styles.documentGateButtonText}>Sign in</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => setHouseholdAgreement((value) => !value)}
            style={({ pressed }) => [styles.agreementRow, pressed ? styles.pressed : null]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: householdAgreement }}
          >
            <Ionicons
              name={householdAgreement ? "checkbox" : "square-outline"}
              size={23}
              color={householdAgreement ? PRIMARY : colors.textSecondary}
            />
            <Text style={styles.agreementText}>
              Everyone in my household agrees to this adoption, and I understand the shelter may
              contact me for a home check or interview.
            </Text>
          </Pressable>

          {error ? (
            <View style={styles.feedbackPanel}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submitApplication}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              loading ? styles.disabledButton : null,
              pressed ? styles.pressed : null,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Submitting..." : user ? "Submit Application" : "Sign in to Apply"}
            </Text>
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    alignSelf: "center",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingBottom: vs(34),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(8),
    width: "100%",
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(14),
    minHeight: TOUCH_TARGET,
  },
  iconButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  screenTitle: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(19),
    fontWeight: "900",
    textAlign: "center",
  },
  animalCard: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: FIELD_BORDER,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(12),
    padding: rs(13),
  },
  animalImage: {
    borderRadius: 18,
    height: rs(82),
    width: rs(92),
  },
  animalCopy: {
    flex: 1,
    minWidth: 0,
  },
  applicationBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 999,
    flexDirection: "row",
    gap: rs(5),
    marginBottom: vs(5),
    paddingHorizontal: rs(9),
    paddingVertical: vs(4),
  },
  applicationBadgeText: {
    color: PRIMARY_DARK,
    fontSize: ms(10),
    fontWeight: "900",
    lineHeight: ms(13),
  },
  animalName: {
    color: colors.charcoal,
    fontSize: ms(20),
    fontWeight: "900",
    lineHeight: ms(25),
  },
  animalMeta: {
    color: colors.text,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
    marginTop: vs(3),
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(4),
    marginTop: vs(5),
  },
  locationText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
  },
  signInPanel: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: FIELD_BORDER,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(9),
    marginTop: vs(12),
    paddingHorizontal: rs(13),
    paddingVertical: vs(11),
  },
  signInPanelText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
  },
  signInButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: vs(34),
    paddingHorizontal: rs(14),
  },
  signInButtonText: {
    color: colors.white,
    fontSize: ms(12),
    fontWeight: "900",
  },
  section: {
    marginTop: vs(22),
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(10),
    marginBottom: vs(12),
  },
  sectionIconWrap: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderRadius: 999,
    height: rs(38),
    justifyContent: "center",
    width: rs(38),
  },
  sectionHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.charcoal,
    fontSize: ms(17),
    fontWeight: "900",
    lineHeight: ms(22),
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginTop: vs(1),
  },
  fieldGroup: {
    marginBottom: vs(12),
  },
  addressSearchState: {
    marginTop: vs(-6),
    marginBottom: vs(12),
    paddingHorizontal: rs(4),
  },
  addressSearchStateText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
  },
  addressSuggestions: {
    backgroundColor: colors.white,
    borderColor: FIELD_BORDER,
    borderRadius: rs(10),
    borderWidth: 1,
    marginTop: vs(-6),
    marginBottom: vs(12),
    overflow: "hidden",
  },
  addressSuggestion: {
    alignItems: "center",
    borderBottomColor: FIELD_BORDER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(48),
    paddingHorizontal: rs(10),
    paddingVertical: vs(7),
  },
  addressSuggestionText: {
    color: colors.charcoal,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
  },
  documentPrivacyNote: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderColor: FIELD_BORDER,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(14),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
  },
  documentPrivacyText: {
    color: PRIMARY_DARK,
    flex: 1,
    fontSize: ms(11),
    fontWeight: "700",
    lineHeight: ms(16),
  },
  documentSignInGate: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: FIELD_BORDER,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    padding: rs(12),
  },
  documentGateButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: vs(38),
    paddingHorizontal: rs(13),
  },
  documentGateButtonText: {
    color: colors.white,
    fontSize: ms(11),
    fontWeight: "900",
  },
  documentField: {
    marginBottom: vs(16),
  },
  documentDescription: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginBottom: vs(8),
    marginTop: vs(-3),
  },
  documentPicker: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: PRIMARY,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    minHeight: vs(68),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
  },
  documentIconWrap: {
    alignItems: "center",
    backgroundColor: SOFT_BLUE,
    borderRadius: 13,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  documentPickerCopy: {
    flex: 1,
    minWidth: 0,
  },
  documentPickerTitle: {
    color: PRIMARY_DARK,
    fontSize: ms(13),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  documentPickerHint: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(16),
    marginTop: vs(2),
  },
  selectedDocument: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: FIELD_BORDER,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    minHeight: vs(72),
    padding: rs(11),
  },
  selectedDocumentCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedDocumentName: {
    color: colors.charcoal,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(17),
  },
  selectedDocumentMeta: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontWeight: "700",
    lineHeight: ms(15),
    marginTop: vs(2),
  },
  documentActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(5),
  },
  documentAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: TOUCH_TARGET,
    paddingHorizontal: rs(5),
  },
  documentActionText: {
    color: PRIMARY,
    fontSize: ms(11),
    fontWeight: "900",
  },
  removeDocumentButton: {
    alignItems: "center",
    height: TOUCH_TARGET,
    justifyContent: "center",
    width: TOUCH_TARGET,
  },
  fieldLabel: {
    color: colors.charcoal,
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(18),
    marginBottom: vs(7),
  },
  required: {
    color: colors.danger,
  },
  fieldControl: {
    backgroundColor: colors.white,
    borderColor: FIELD_BORDER,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.charcoal,
    fontSize: ms(14),
    fontWeight: "600",
    minHeight: vs(48),
    paddingHorizontal: rs(13),
    paddingVertical: 0,
  },
  multilineInput: {
    minHeight: vs(92),
    paddingTop: vs(11),
    textAlignVertical: "top",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(8),
  },
  chip: {
    backgroundColor: colors.background,
    borderColor: FIELD_BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: rs(12),
    paddingVertical: vs(8),
  },
  chipSelected: {
    backgroundColor: SOFT_BLUE,
    borderColor: PRIMARY,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "800",
  },
  chipTextSelected: {
    color: PRIMARY_DARK,
    fontWeight: "900",
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: FIELD_BORDER,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(10),
    minHeight: vs(50),
    paddingHorizontal: rs(13),
  },
  toggleLabel: {
    color: colors.text,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "800",
    lineHeight: ms(18),
    paddingRight: rs(10),
  },
  toggleTrack: {
    backgroundColor: "#D4DCE7",
    borderRadius: 999,
    height: rs(26),
    justifyContent: "center",
    paddingHorizontal: rs(3),
    width: rs(48),
  },
  toggleTrackOn: {
    backgroundColor: PRIMARY,
  },
  toggleThumb: {
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(20),
    width: rs(20),
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },
  agreementRow: {
    alignItems: "flex-start",
    backgroundColor: SOFT_BLUE,
    borderColor: FIELD_BORDER,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(9),
    marginTop: vs(18),
    padding: rs(13),
  },
  agreementText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(18),
  },
  feedbackPanel: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: "#F5C2BD",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(8),
    marginTop: vs(14),
    paddingHorizontal: rs(12),
    paddingVertical: vs(10),
  },
  errorText: {
    color: colors.danger,
    flex: 1,
    fontSize: ms(13),
    fontWeight: "700",
    lineHeight: ms(18),
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: PRIMARY,
    borderRadius: 18,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    marginTop: vs(18),
    minHeight: TOUCH_TARGET + vs(8),
    paddingHorizontal: rs(18),
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: ms(15),
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.62,
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
  pressed: {
    opacity: 0.72,
  },
});
