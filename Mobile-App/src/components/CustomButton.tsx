import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle,
} from "react-native";
import colors from "../theme/colors";
import { ms, TOUCH_TARGET, vs } from "../theme/responsive";

type CustomButtonProps = {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
};

const CustomButton = ({
  title,
  onPress,
  style,
  textStyle,
  disabled,
  loading,
}: CustomButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled ? styles.pressed : undefined,
        isDisabled ? styles.disabled : undefined,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={[styles.buttonText, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: TOUCH_TARGET,
    paddingVertical: vs(14),
  },
  buttonText: {
    color: colors.white,
    fontSize: ms(16),
    fontWeight: "700",
  },
  pressed: {
    backgroundColor: colors.primary,
  },
  disabled: {
    backgroundColor: colors.muted,
    opacity: 0.6,
  },
});

