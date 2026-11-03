import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import colors from "@/src/theme/colors";
import { ms, rs, vs } from "@/src/theme/responsive";

type ComingSoonProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
};

export default function ComingSoonScreen({ icon, title, subtitle }: ComingSoonProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={34} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: rs(24),
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: rs(72),
    justifyContent: "center",
    marginBottom: vs(18),
    width: rs(72),
  },
  title: {
    color: colors.primaryDark,
    fontSize: ms(24),
    fontWeight: "800",
    marginBottom: vs(8),
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontWeight: "600",
    lineHeight: ms(22),
    textAlign: "center",
  },
});
