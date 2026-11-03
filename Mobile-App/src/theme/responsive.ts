import { Dimensions, PixelRatio } from "react-native";

const { width, height } = Dimensions.get("window");

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return PixelRatio.roundToNearestPixel(value);
}

const widthScale = clampValue(width / BASE_WIDTH, 0.86, 1.16);
const heightScale = clampValue(height / BASE_HEIGHT, 0.84, 1.18);
const textScale = clampValue(Math.min(widthScale, heightScale), 0.9, 1.1);

export const screen = {
  width,
  height,
  isCompact: width < 370,
  isShort: height < 760,
  isLarge: width >= 430 || height >= 900,
};

export const CONTENT_MAX_WIDTH = 640;
export const FORM_MAX_WIDTH = 420;
export const PAGE_PADDING = round(clampValue(width * 0.052, 16, 28));
export const TOUCH_TARGET = round(clampValue(44 * widthScale, 42, 52));

export function clamp(value: number, min: number, max: number) {
  return round(clampValue(value, min, max));
}

export function rs(size: number) {
  return round(size * widthScale);
}

export function vs(size: number) {
  return round(size * heightScale);
}

export function ms(size: number, factor = 0.5) {
  return round(size + (size * textScale - size) * factor);
}
