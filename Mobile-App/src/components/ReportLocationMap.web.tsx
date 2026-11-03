import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useImperativeHandle } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import colors from "../theme/colors";
import { ms, rs, vs } from "../theme/responsive";
import type {
  ReportLocationMapHandle,
  ReportLocationMapProps,
} from "./ReportLocationMap.types";
import { ROODEPOORT_REPORT_REGION } from "./ReportLocationMap.types";

const ReportLocationMap = forwardRef<ReportLocationMapHandle, ReportLocationMapProps>(
  ({ onPress, region = ROODEPOORT_REPORT_REGION, selectedCoordinate, style }, ref) => {
    useImperativeHandle(ref, () => ({
      animateToRegion() {
        return undefined;
      },
    }));

    const displayCoordinate = selectedCoordinate ?? {
      latitude: region.latitude,
      longitude: region.longitude,
    };

    return (
      <Pressable
        onPress={() =>
          onPress({
            nativeEvent: {
              coordinate: displayCoordinate,
            },
          })
        }
        style={[style, styles.fallback]}
        accessibilityRole="button"
        accessibilityLabel="Set report location from the current map center"
      >
        <View style={styles.iconShell}>
          <Ionicons name="map-outline" size={31} color={colors.primary} />
        </View>
        <Text style={styles.title}>Map preview is available on mobile</Text>
        <Text style={styles.body}>
          Search above, use your current location, or click here to pin the current coordinates.
        </Text>
        <Text style={styles.coordinate}>
          {displayCoordinate.latitude.toFixed(5)}, {displayCoordinate.longitude.toFixed(5)}
        </Text>
      </Pressable>
    );
  }
);

ReportLocationMap.displayName = "ReportLocationMap";

export default ReportLocationMap;

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(15, 110, 168, 0.22)",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: rs(18),
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 999,
    height: rs(58),
    justifyContent: "center",
    marginBottom: vs(12),
    width: rs(58),
  },
  title: {
    color: colors.primaryDark,
    fontSize: ms(16),
    fontWeight: "900",
    lineHeight: ms(21),
    textAlign: "center",
  },
  body: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontWeight: "700",
    lineHeight: ms(17),
    marginTop: vs(6),
    maxWidth: rs(320),
    textAlign: "center",
  },
  coordinate: {
    color: colors.primary,
    fontSize: ms(12),
    fontWeight: "900",
    lineHeight: ms(16),
    marginTop: vs(10),
  },
});
