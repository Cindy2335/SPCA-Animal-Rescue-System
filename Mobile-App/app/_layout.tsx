import AuthProvider from "@/src/context/AuthContext";
import AnalyticsRouteTracker from "@/src/components/AnalyticsRouteTracker";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <AuthProvider>
        <AnalyticsRouteTracker />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="claim-ownership" />
          <Stack.Screen name="report-stray" />
          <Stack.Screen name="adoption" />
          <Stack.Screen name="adoption/[id]" />
          <Stack.Screen name="adoption-application" />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
      </AuthProvider>

      <StatusBar style="dark" />
    </>
  );
}
