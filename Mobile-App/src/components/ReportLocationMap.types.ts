import type { StyleProp, ViewStyle } from "react-native";

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type Region = LatLng & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export const ROODEPOORT_REPORT_REGION: Region = {
  latitude: -26.1625,
  latitudeDelta: 0.1,
  longitude: 27.8725,
  longitudeDelta: 0.1,
};

export type CoordinateEvent = {
  nativeEvent: {
    coordinate: LatLng;
  };
};

export type ReportLocationMapHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

export type ReportLocationMapProps = {
  hasLocationPermission: boolean;
  markerTitle: string;
  onMarkerDragEnd: (event: CoordinateEvent) => void;
  onPress: (event: CoordinateEvent) => void;
  onRegionChangeComplete: (region: Region) => void;
  region?: Region;
  selectedCoordinate: LatLng | null;
  style?: StyleProp<ViewStyle>;
};
