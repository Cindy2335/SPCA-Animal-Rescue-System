import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/src/theme/colors";
import { useAuth } from "@/src/context/AuthContext";
import { ms, vs } from "@/src/theme/responsive";

type TabIconProps = {
  color: ColorValue;
  size: number;
};

function HomeTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="paw-outline" color={color} size={size} />;
}

function ChatTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="file-tray-full-outline" color={color} size={size} />;
}

function AdoptionsTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="heart-circle-outline" color={color} size={size} />;
}

function SurrenderTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="paw" color={color} size={size} />;
}

function AccountTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="person-circle-outline" color={color} size={size} />;
}

function AgentHomeTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="home-outline" color={color} size={size} />;
}

function AgentReportsTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="document-text-outline" color={color} size={size} />;
}

function AgentActionTabIcon({ color }: TabIconProps) {
  return <Ionicons name="heart-circle-outline" color={color} size={26} />;
}

function AgentMapTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="location-outline" color={color} size={size} />;
}

function AgentProfileTabIcon({ color, size }: TabIconProps) {
  return <Ionicons name="person" color={color} size={size} />;
}

export default function TabsLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, vs(8));
  const isFieldAgent = user?.role === "FIELD_AGENT";
  const activeTint = colors.primary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: vs(58) + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: vs(6),
        },
        tabBarLabelStyle: {
          fontSize: ms(11),
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isFieldAgent ? "Home" : "Care",
          tabBarIcon: isFieldAgent ? AgentHomeTabIcon : HomeTabIcon,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Reports",
          tabBarIcon: isFieldAgent ? AgentReportsTabIcon : ChatTabIcon,
        }}
      />
      <Tabs.Screen
        name="adoptions"
        options={{
          title: "Adoptions",
          tabBarIcon: isFieldAgent ? AgentActionTabIcon : AdoptionsTabIcon,
        }}
      />
      <Tabs.Screen
        name="claims"
        options={{
          title: "My Claims",
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />,
          href: isFieldAgent ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="surrender"
        options={{
          title: isFieldAgent ? "Map" : "Surrender",
          tabBarIcon: isFieldAgent ? AgentMapTabIcon : SurrenderTabIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: isFieldAgent ? "Profile" : "Account",
          tabBarIcon: isFieldAgent ? AgentProfileTabIcon : AccountTabIcon,
        }}
      />
    </Tabs>
  );
}
