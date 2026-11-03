import { useSegments } from "expo-router";
import { useEffect } from "react";

import { trackScreen, type AnalyticsScreenName } from "../services/analytics";

const SCREEN_BY_ROUTE: Readonly<Record<string, AnalyticsScreenName>> = {
  "": "Landing",
  index: "Landing",
  login: "Login",
  register: "Register",
  "(tabs)/home": "Home",
  home: "Home",
  adoption: "AdoptionBrowse",
  "adoption/[id]": "AdoptionDetail",
  "adoption-application": "AdoptionApplication",
  "(tabs)/adoptions": "MyAdoptions",
  "report-stray": "ReportStray",
  "claim-ownership": "ClaimOwnership",
  "report-cruelty": "ReportCruelty",
  "(tabs)/surrender": "Surrender",
  donations: "Donations",
  "(tabs)/chat": "Chat",
  "(tabs)/settings": "Settings",
  modal: "Help",
};

export default function AnalyticsRouteTracker() {
  const segments = useSegments();
  const route = segments.join("/");
  const screenName = SCREEN_BY_ROUTE[route];

  useEffect(() => {
    if (screenName) {
      void trackScreen(screenName);
    }
  }, [screenName]);

  return null;
}
