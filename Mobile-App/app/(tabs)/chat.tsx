import ReportsScreen from "@/src/screens/ReportsScreen";
import { useAuth } from "@/src/context/AuthContext";
import { FieldAgentReportsScreen } from "@/src/screens/FieldAgentScreens";

export default function ChatTab() {
  const { user } = useAuth();

  if (user?.role === "FIELD_AGENT") {
    return <FieldAgentReportsScreen />;
  }

  return <ReportsScreen />;
}
