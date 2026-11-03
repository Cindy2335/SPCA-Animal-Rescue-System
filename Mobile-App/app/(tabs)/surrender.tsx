import SurrenderAnimalScreen from "@/src/screens/SurrenderAnimalScreen";
import { useAuth } from "@/src/context/AuthContext";
import { FieldAgentMapScreen } from "@/src/screens/FieldAgentScreens";

export default function SurrenderTab() {
  const { user } = useAuth();

  if (user?.role === "FIELD_AGENT") {
    return <FieldAgentMapScreen />;
  }

  return <SurrenderAnimalScreen />;
}
