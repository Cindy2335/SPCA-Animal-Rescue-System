import type { ChangeEvent, CSSProperties } from "react";
import { StyleSheet, Text, View } from "react-native";
import colors from "../theme/colors";
import { ms, rs, vs } from "../theme/responsive";
import type { AdoptionPickupDateTimePickerProps } from "./AdoptionPickupDateTimePicker.types";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatTimeInput(value: Date) {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const inputStyle: CSSProperties = {
  backgroundColor: "white",
  border: "1px solid #D6EAF6",
  borderRadius: 12,
  boxSizing: "border-box",
  color: colors.text,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 800,
  height: 44,
  minWidth: 0,
  padding: "0 10px",
  width: "100%",
};

export default function AdoptionPickupDateTimePicker({
  disabled = false,
  minimumDate,
  onChange,
  value,
}: AdoptionPickupDateTimePickerProps) {
  const changeDate = (event: ChangeEvent<HTMLInputElement>) => {
    const parts = event.currentTarget.value.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return;

    const next = new Date(value);
    next.setFullYear(parts[0], parts[1] - 1, parts[2]);
    onChange(next);
  };

  const changeTime = (event: ChangeEvent<HTMLInputElement>) => {
    const parts = event.currentTarget.value.split(":").map(Number);
    if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return;

    const next = new Date(value);
    next.setHours(parts[0], parts[1], 0, 0);
    onChange(next);
  };

  return (
    <View style={styles.fields}>
      <View style={styles.field}>
        <Text style={styles.label}>Date</Text>
        <input
          aria-label="Choose collection date"
          disabled={disabled}
          min={formatDateInput(minimumDate)}
          onChange={changeDate}
          style={inputStyle}
          type="date"
          value={formatDateInput(value)}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Time</Text>
        <input
          aria-label="Choose collection time"
          disabled={disabled}
          onChange={changeTime}
          step={60}
          style={inputStyle}
          type="time"
          value={formatTimeInput(value)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    flexDirection: "row",
    gap: rs(8),
    marginBottom: vs(8),
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.charcoal,
    fontSize: ms(10),
    fontWeight: "900",
    marginBottom: vs(4),
    textTransform: "uppercase",
  },
});
