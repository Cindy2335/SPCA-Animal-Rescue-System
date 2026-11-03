import React from "react";
import {
    StyleSheet,
    Text,
    TextStyle,
    TextInput,
    TextInputProps,
    View,
} from "react-native";
import colors from "../theme/colors";
import { ms, rs, vs } from "../theme/responsive";

type CustomInputProps = TextInputProps & {
  label: string;
  labelStyle?: TextStyle;
};

const CustomInput = ({ label, labelStyle, style, ...props }: CustomInputProps) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
    </View>
  );
};

export default CustomInput;

const styles = StyleSheet.create({
  container: {
    marginBottom: vs(14),
  },
  label: {
    color: colors.text,
    fontSize: ms(14),
    fontWeight: "600",
    marginBottom: vs(6),
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: ms(15),
    paddingHorizontal: rs(14),
    paddingVertical: vs(12),
  },
});
