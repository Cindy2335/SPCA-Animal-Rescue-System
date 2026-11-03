import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "../theme/colors";
import { ms, rs, vs } from "../theme/responsive";
import type { AdoptionPickupDateTimePickerProps } from "./AdoptionPickupDateTimePicker.types";

type ActivePicker = "date" | "time" | null;

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdoptionPickupDateTimePicker({
  disabled = false,
  minimumDate,
  onChange,
  value,
}: AdoptionPickupDateTimePickerProps) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  const openPicker = (picker: Exclude<ActivePicker, null>) => {
    if (!disabled) setActivePicker(picker);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios" || event.type === "dismissed") {
      setActivePicker(null);
    }

    if (event.type === "dismissed" || !selected || !activePicker) return;

    const next = new Date(value);

    if (activePicker === "date") {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }

    onChange(next);
  };

  return (
    <View>
      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <Pressable
            accessibilityLabel="Choose collection date"
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("date")}
            style={({ pressed }) => [
              styles.pickerButton,
              disabled ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.primary} name="calendar-outline" size={17} />
            <Text numberOfLines={1} style={styles.pickerText}>
              {formatDate(value)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Time</Text>
          <Pressable
            accessibilityLabel="Choose collection time"
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => openPicker("time")}
            style={({ pressed }) => [
              styles.pickerButton,
              disabled ? styles.disabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.primary} name="time-outline" size={17} />
            <Text numberOfLines={1} style={styles.pickerText}>
              {formatTime(value)}
            </Text>
          </Pressable>
        </View>
      </View>

      {activePicker ? (
        <View style={Platform.OS === "ios" ? styles.iosPickerPanel : undefined}>
          <DateTimePicker
            display={Platform.OS === "ios" && activePicker === "date" ? "inline" : "default"}
            minimumDate={activePicker === "date" ? minimumDate : undefined}
            mode={activePicker}
            onChange={handlePickerChange}
            value={value}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setActivePicker(null)}
              style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  pickerButton: {
    alignItems: "center",
    borderColor: "#D6EAF6",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: rs(7),
    minHeight: vs(44),
    paddingHorizontal: rs(10),
  },
  pickerText: {
    color: colors.text,
    flex: 1,
    fontSize: ms(12),
    fontWeight: "800",
  },
  iosPickerPanel: {
    borderColor: "#D6EAF6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: vs(8),
    overflow: "hidden",
    paddingBottom: vs(8),
  },
  doneButton: {
    alignSelf: "flex-end",
    minHeight: vs(36),
    justifyContent: "center",
    paddingHorizontal: rs(14),
  },
  doneText: {
    color: colors.primary,
    fontSize: ms(13),
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
