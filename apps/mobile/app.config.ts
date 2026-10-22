import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * VARIAN APLIKASI — `APP_VARIANT` disetel per profil di `eas.json`.
 *
 * `development`: development build (expo-dev-client) yang memuat JS dari Metro
 * di laptop. Nama paketnya SENGAJA berbeda dari APK lapangan aplikasi lama
 * (`com.naelcapital.app`, proyek EAS lain) — terpasang berdampingan, tidak
 * pernah menimpa atau menerima pembaruan OTA milik karyawan.
 *
 * Varian rilis (preview / produksi) belum ditentukan: nama paket & proyek EAS
 * rilis diputuskan saat aplikasi baru menggantikan aplikasi lama.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const varian = process.env.APP_VARIANT;
  if (varian !== "development") return config as ExpoConfig;

  return {
    ...config,
    name: "Nael Dev",
    slug: config.slug ?? "new-naelcapital",
    android: { ...config.android, package: "com.naelcapital.app.dev" },
    ios: { ...config.ios, bundleIdentifier: "com.naelcapital.app.dev" },
  };
};
