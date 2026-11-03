import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { trackDonationCtaClicked } from "../services/analytics";
import colors from "../theme/colors";
import {
  CONTENT_MAX_WIDTH,
  ms,
  PAGE_PADDING,
  rs,
  vs,
} from "../theme/responsive";

type DonationUse = {
  title: string;
  body: string;
  icon: ImageSourcePropType;
};

const donationAmounts = [50, 100, 250, 500];

const donationUses: DonationUse[] = [
  {
    title: "Food",
    body: "Daily meals for animals in short-term care.",
    icon: require("../../assets/UI/icons/food icon.png"),
  },
  {
    title: "Medical",
    body: "Basic treatment, vaccinations, and wound care.",
    icon: require("../../assets/UI/icons/medical care icon.png"),
  },
  {
    title: "Transport",
    body: "Fuel and safe collection trips for urgent cases.",
    icon: require("../../assets/UI/icons/transport icon.png"),
  },
];

export default function DonationsScreen() {
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState("");
  const [isMonthly, setIsMonthly] = useState(false);

  const typedAmount = Number(customAmount.replace(/[^\d.]/g, ""));
  const activeAmount = typedAmount > 0 ? typedAmount : selectedAmount;

  const submitDonation = () => {
    void trackDonationCtaClicked(isMonthly ? "monthly" : "once_off");
    Alert.alert(
      "Donation checkout",
      `R${activeAmount.toFixed(0)} ${isMonthly ? "monthly" : "once-off"} is ready for payment integration.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Support care</Text>
            <Text style={styles.title}>Donations</Text>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <Image
            source={require("../../assets/Donate.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Help cover the next rescue need.</Text>
            <Text style={styles.heroBody}>
              Choose an amount, select a rhythm, and keep the checkout ready for the payment service.
            </Text>
          </View>
        </View>

        <View style={styles.amountPanel}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Amount</Text>
            <Text style={styles.sectionCaption}>R{activeAmount.toFixed(0)}</Text>
          </View>

          <View style={styles.amountGrid}>
            {donationAmounts.map((amount) => {
              const selected = customAmount.length === 0 && selectedAmount === amount;

              return (
                <Pressable
                  key={amount}
                  onPress={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                  }}
                  style={({ pressed }) => [
                    styles.amountButton,
                    selected ? styles.amountButtonSelected : null,
                    pressed ? styles.pressed : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.amountButtonText,
                      selected ? styles.amountButtonTextSelected : null,
                    ]}
                  >
                    R{amount}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <Text style={styles.inputPrefix}>R</Text>
            <TextInput
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="Custom amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              style={styles.customInput}
            />
          </View>

          <Pressable
            onPress={() => setIsMonthly((value) => !value)}
            style={({ pressed }) => [
              styles.monthlyToggle,
              isMonthly ? styles.monthlyToggleSelected : null,
              pressed ? styles.pressed : null,
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: isMonthly }}
          >
            <View style={styles.monthlyCopy}>
              <Text style={styles.monthlyTitle}>Monthly support</Text>
              <Text style={styles.monthlyBody}>
                {isMonthly ? "Recurring pledge selected" : "Once-off donation selected"}
              </Text>
            </View>
            <Ionicons
              name={isMonthly ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isMonthly ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Where it helps</Text>
        </View>

        <View style={styles.useList}>
          {donationUses.map((item) => (
            <View key={item.title} style={styles.useItem}>
              <View style={styles.useIcon}>
                <Image source={item.icon} style={styles.useIconImage} resizeMode="contain" />
              </View>
              <View style={styles.useCopy}>
                <Text style={styles.useTitle}>{item.title}</Text>
                <Text style={styles.useBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={submitDonation}
          style={({ pressed }) => [styles.donateButton, pressed ? styles.donateButtonPressed : null]}
          accessibilityRole="button"
        >
          <Text style={styles.donateButtonText}>Continue with R{activeAmount.toFixed(0)}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    alignSelf: "center",
    paddingBottom: vs(24),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(10),
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: rs(12),
    marginBottom: vs(12),
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: rs(40),
    justifyContent: "center",
    width: rs(40),
  },
  pressed: {
    opacity: 0.76,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: ms(13),
    fontWeight: "700",
    marginBottom: vs(2),
  },
  title: {
    color: colors.primaryDark,
    fontSize: ms(23),
    fontWeight: "900",
    lineHeight: ms(28),
  },
  heroPanel: {
    backgroundColor: colors.white,
    borderRadius: 0,
    marginHorizontal: -PAGE_PADDING,
    marginBottom: vs(12),
    overflow: "hidden",
  },
  heroImage: {
    height: vs(154),
    width: "100%",
  },
  heroCopy: {
    paddingHorizontal: PAGE_PADDING,
    paddingVertical: vs(12),
  },
  heroTitle: {
    color: colors.text,
    fontSize: ms(18),
    fontWeight: "900",
    lineHeight: ms(23),
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "600",
    lineHeight: ms(17),
    marginTop: vs(5),
  },
  amountPanel: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: vs(12),
    padding: rs(10),
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: vs(8),
  },
  sectionTitle: {
    color: colors.text,
    fontSize: ms(17),
    fontWeight: "900",
  },
  sectionCaption: {
    color: colors.primaryDark,
    fontSize: ms(13),
    fontWeight: "900",
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(7),
    marginBottom: vs(8),
  },
  amountButton: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: vs(40),
    justifyContent: "center",
  },
  amountButtonSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  amountButtonText: {
    color: colors.text,
    fontSize: ms(15),
    fontWeight: "900",
  },
  amountButtonTextSelected: {
    color: colors.white,
  },
  customRow: {
    alignItems: "center",
    backgroundColor: colors.lightgray,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(8),
    minHeight: vs(40),
    paddingHorizontal: rs(11),
  },
  inputPrefix: {
    color: colors.primaryDark,
    fontSize: ms(16),
    fontWeight: "900",
  },
  customInput: {
    color: colors.text,
    flex: 1,
    fontSize: ms(14),
    fontWeight: "700",
    minHeight: vs(40),
  },
  monthlyToggle: {
    alignItems: "center",
    backgroundColor: colors.lightgray,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(12),
    justifyContent: "space-between",
    marginTop: vs(8),
    minHeight: vs(50),
    paddingHorizontal: rs(11),
  },
  monthlyToggleSelected: {
    backgroundColor: colors.accentSoft,
  },
  monthlyCopy: {
    flex: 1,
  },
  monthlyTitle: {
    color: colors.text,
    fontSize: ms(13),
    fontWeight: "900",
  },
  monthlyBody: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    marginTop: vs(2),
  },
  useList: {
    gap: vs(8),
    marginBottom: vs(12),
  },
  useItem: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(10),
    minHeight: vs(64),
    padding: rs(10),
  },
  useIcon: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 8,
    height: rs(42),
    justifyContent: "center",
    width: rs(42),
  },
  useIconImage: {
    height: rs(38),
    width: rs(38),
  },
  useCopy: {
    flex: 1,
  },
  useTitle: {
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "900",
    lineHeight: ms(18),
  },
  useBody: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontWeight: "600",
    lineHeight: ms(16),
    marginTop: vs(2),
  },
  donateButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    flexDirection: "row",
    gap: rs(8),
    justifyContent: "center",
    minHeight: vs(46),
    paddingHorizontal: rs(14),
  },
  donateButtonPressed: {
    backgroundColor: colors.primary,
  },
  donateButtonText: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "900",
  },
});
