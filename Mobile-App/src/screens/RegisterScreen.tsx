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

type RegisterScreenProps = {
  OnRegister: (input: {
    fullname: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => void | Promise<void>;
  OnGoToLogin: () => void;
  error?: string | null;
  loading?: boolean;
};

const RegisterScreen = ({ OnRegister, OnGoToLogin, error, loading }: RegisterScreenProps) => {
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>
                Be the change animals need.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <CustomInput
              label="Full Name"
              labelStyle={styles.inputLabel}
              placeholder="Enter your full name"
              value={fullname}
              onChangeText={setFullname}
            />

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
            <CustomInput
              label="Confirm Password"
              labelStyle={styles.inputLabel}
              placeholder="Confirm your password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <CustomButton
              title="Register"
              onPress={() => OnRegister({ fullname, email, password, confirmPassword })}
              loading={loading}
            />
            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Already have an account?</Text>
              <TouchableOpacity onPress={OnGoToLogin}>
                <Text style={styles.linkAction}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;

const LOGO_SIZE = clamp(screen.height * 0.13, 82, 120);

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
    paddingTop: vs(24),
  },
  scrollContent: {
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: vs(25),
    paddingHorizontal: PAGE_PADDING,
    paddingTop: vs(18),
    width: "100%",
    maxWidth: FORM_MAX_WIDTH,
  },
  header: {
    alignItems: "center",
    marginBottom: vs(24),
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
    fontSize: ms(13),
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
  logo: {
    alignSelf: "center",
    height: LOGO_SIZE,
    marginBottom: vs(18),
    width: LOGO_SIZE,
  },
});
