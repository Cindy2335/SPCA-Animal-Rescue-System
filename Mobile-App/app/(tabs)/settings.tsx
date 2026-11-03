import ProfileScreen from "@/src/screens/ProfileScreen";
import { useAuth } from "@/src/context/AuthContext";
import { FieldAgentProfileScreen } from "@/src/screens/FieldAgentScreens";

export default function SettingsTab() {
  const { user } = useAuth();

  if (user?.role === "FIELD_AGENT") {
    return <FieldAgentProfileScreen />;
  }

  return <ProfileScreen />;
}
