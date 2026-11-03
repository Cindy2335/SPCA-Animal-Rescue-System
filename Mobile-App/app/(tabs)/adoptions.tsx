import AdoptionsTabScreen from "@/src/screens/AdoptionsTabScreen";
import { useAuth } from "@/src/context/AuthContext";
import FieldAgentAdoptionsScreen from "@/src/screens/FieldAgentAdoptionsScreen";

export default function AdoptionsTab() {
  const { user } = useAuth();

  if (user?.role === "FIELD_AGENT") {
    return <FieldAgentAdoptionsScreen />;
  }

  return <AdoptionsTabScreen />;
}
