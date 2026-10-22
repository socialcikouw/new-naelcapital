import Constants from "expo-constants";
import { Platform } from "react-native";

/** Keterangan HP ini untuk daftar perangkat tertaut di layar bos. */
export function infoPerangkat(): { nama?: string; platform: "android" | "ios" } {
  const nama = Constants.deviceName?.slice(0, 100);
  return { ...(nama ? { nama } : {}), platform: Platform.OS === "ios" ? "ios" : "android" };
}
