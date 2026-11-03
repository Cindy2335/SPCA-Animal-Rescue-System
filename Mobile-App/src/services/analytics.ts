import Constants from "expo-constants";
import { Platform } from "react-native";

type AnalyticsModule = typeof import("@react-native-firebase/analytics");

export type AnalyticsScreenName =
  | "Landing"
  | "Login"
  | "Register"
  | "Home"
  | "AdoptionBrowse"
  | "AdoptionDetail"
  | "AdoptionApplication"
  | "MyAdoptions"
  | "ClaimOwnership"
  | "ReportStray"
  | "ReportCruelty"
  | "Surrender"
  | "Donations"
  | "Chat"
  | "Settings"
  | "Help";

let analyticsModulePromise: Promise<AnalyticsModule | null> | null = null;

function canUseFirebaseAnalytics() {
  // There is currently only an Android Firebase data stream. React Native
  // Firebase is not included in Expo Go, so importing it there would throw.
  return Platform.OS === "android" && Constants.appOwnership !== "expo";
}

async function loadAnalyticsModule(): Promise<AnalyticsModule | null> {
  try {
    // Metro can evaluate a dynamic import synchronously in native bundles.
    // Awaiting it inside an async function works with either behavior and also
    // keeps native Firebase out of web/Expo Go execution paths.
    return await import("@react-native-firebase/analytics");
  } catch (error) {
    if (__DEV__) {
      console.warn("Firebase Analytics is unavailable in this build.", error);
    }

    return null;
  }
}

async function getAnalyticsModule() {
  if (!canUseFirebaseAnalytics()) {
    return null;
  }

  if (!analyticsModulePromise) {
    analyticsModulePromise = loadAnalyticsModule();
  }

  return analyticsModulePromise;
}

async function record(
  operation: (analyticsModule: AnalyticsModule) => Promise<void> | void,
) {
  const analyticsModule = await getAnalyticsModule();

  if (!analyticsModule) {
    return;
  }

  try {
    await operation(analyticsModule);
  } catch (error) {
    // Analytics must never interrupt an app action. Development builds still
    // surface configuration mistakes without exposing any user-entered data.
    if (__DEV__) {
      console.warn("Firebase Analytics event was not recorded.", error);
    }
  }
}

export function trackScreen(screenName: AnalyticsScreenName) {
  return record(({ getAnalytics, logScreenView }) =>
    logScreenView(getAnalytics(), {
      screen_name: screenName,
      screen_class: screenName,
    }),
  );
}

export function trackLoginSucceeded() {
  return record(({ getAnalytics, logLogin }) =>
    logLogin(getAnalytics(), { method: "email" }),
  );
}

export function trackSignUpSucceeded() {
  return record(({ getAnalytics, logSignUp }) =>
    logSignUp(getAnalytics(), { method: "email" }),
  );
}

export function trackAdoptionPetViewed() {
  return record(({ getAnalytics, logEvent }) =>
    logEvent(getAnalytics(), "adoption_pet_viewed"),
  );
}

export function trackAdoptionApplicationSubmitted() {
  return record(({ getAnalytics, logEvent }) =>
    logEvent(getAnalytics(), "adoption_application_submitted"),
  );
}

export function trackStrayReportSubmitted() {
  return record(({ getAnalytics, logEvent }) =>
    logEvent(getAnalytics(), "stray_report_submitted"),
  );
}

export function trackSurrenderRequestSubmitted() {
  return record(({ getAnalytics, logEvent }) =>
    logEvent(getAnalytics(), "surrender_request_submitted"),
  );
}

export function trackDonationCtaClicked(frequency: "monthly" | "once_off") {
  return record(({ getAnalytics, logEvent }) =>
    logEvent(getAnalytics(), "donation_cta_clicked", { frequency }),
  );
}
