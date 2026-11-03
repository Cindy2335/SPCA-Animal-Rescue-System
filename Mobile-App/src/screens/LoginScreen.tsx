import React, { useState } from "react";

import { StatusBar } from "expo-status-bar";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import RandomVideoBackground from "../components/RandomVideoBackground";
import colors from "../theme/colors";
import { clamp, FORM_MAX_WIDTH, ms, PAGE_PADDING, rs, screen, vs } from "../theme/responsive";

type LoginScreenProps = {
  OnLogin: (input: { email: string; password: string }) => void | Promise<void>;
  OnGoToRegister: () => void;
  OnContinueAsGuest: () => void;
  error?: string | null;
  loading?: boolean;
};

const LoginScreen = ({ OnLogin, OnGoToRegister, OnContinueAsGuest, error, loading }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <StatusBar style="light" />
      <RandomVideoBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to continue.
              </Text>
            </View>

            <View style={styles.form}>
              <CustomInput
                label="Email"
                labelStyle={styles.inputLabel}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <CustomInput
                label="Password"
                labelStyle={styles.inputLabel}
                placeholder="Enter your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <CustomButton
                title="Sign in"
                onPress={() => OnLogin({ email, password })}
                loading={loading}
              />
              <CustomButton
                title="Continue as guest"
                onPress={OnContinueAsGuest}
                disabled={loading}
                style={styles.guestButton}
                textStyle={styles.guestButtonText}
              />
              <View style={styles.linkRow}>
                <Text style={styles.linkLabel}>New here?</Text>
                <TouchableOpacity onPress={OnGoToRegister}>
                  <Text style={styles.linkAction}>Create account</Text>
                </TouchableOpacity>
              </View>

              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={styles.socialSection}
              >
                <Text style={styles.socialLabel}>Or continue with</Text>
                <View style={styles.socialRow}>
                  <View style={styles.socialOption}>
                    <Image
                      source={require("../../assets/randImages/google-logo.png")}
                      style={styles.socialLogo}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.socialOption}>
                    <Image
                      source={require("../../assets/randImages/facebook-logo.png")}
                      style={styles.socialLogo}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const LOGO_SIZE = clamp(screen.height * 0.14, 88, 126);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.charcoal,
  },
  keyboardArea: {
    flex: 1,
    zIndex: 5,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: vs(24),
    paddingTop: vs(42),
    width: "100%",
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: vs(32),
    paddingHorizontal: PAGE_PADDING,
  },
  header: {
    alignItems: "center",
    marginBottom: vs(28),
  },
  title: {
    color: colors.white,
    fontSize: ms(28),
    fontWeight: "800",
    marginBottom: vs(8),
    textAlign: "center",
  },
  subtitle: {
    color: "#DDECF5",
    fontSize: ms(14),
    lineHeight: ms(20),
    maxWidth: rs(260),
    textAlign: "center",
  },
  form: {
    width: "100%",
  },
  inputLabel: {
    color: colors.white,
  },
  errorText: {
    color: colors.danger,
    fontSize: ms(14),
    marginBottom: vs(12),
    textAlign: "center",
  },
  guestButton: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.36)",
    borderWidth: 1,
    marginTop: vs(10),
  },
  guestButtonText: {
    color: colors.white,
  },
  linkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: rs(4),
    justifyContent: "center",
    marginTop: vs(20),
  },
  linkLabel: {
    color: "#DDECF5",
    fontSize: ms(14),
  },
  linkAction: {
    color: colors.white,
    fontSize: ms(14),
    fontWeight: "700",
  },
  socialSection: {
    marginTop: vs(26),
  },
  socialLabel: {
    color: "#DDECF5",
    fontSize: ms(12),
    fontWeight: "700",
    marginBottom: vs(12),
    textAlign: "center",
  },
  socialRow: {
    flexDirection: "row",
    gap: rs(24),
    justifyContent: "center",
  },
  socialOption: {
    alignItems: "center",
    justifyContent: "center",
  },
  socialLogo: {
    height: rs(34),
    width: rs(34),
  },
  logo: {
    alignSelf: "center",
    height: LOGO_SIZE,
    marginBottom: vs(18),
    width: LOGO_SIZE,
  },
});
