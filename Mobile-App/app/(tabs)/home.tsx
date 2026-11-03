import HomeScreen from "../../src/screens/HomeScreen";
import { FieldAgentHomeScreen } from "@/src/screens/FieldAgentScreens";
import { useAuth } from "@/src/context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  if (user?.role === "FIELD_AGENT") {
    return <FieldAgentHomeScreen />;
  }

  return <HomeScreen />;
}

