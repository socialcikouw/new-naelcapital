import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * VARIAN APLIKASI — `APP_VARIANT` disetel per profil di `eas.json`. Satu nama
 * jalur dipakai di mana-mana: profil EAS = channel = branch EAS Update
 * (lihat "Jalur rilis aplikasi HP" di CLAUDE.md).
 *
 * `development`: development build (expo-dev-client) yang memuat JS dari Metro
 * di laptop.
 * `preview`: APK uji pemilik ("Nael Uji"); JS dari EAS Update channel
 * `preview`, API dari variabel EAS lingkungan `preview`.
 *
 * Nama paket SENGAJA berbeda dari APK lapangan aplikasi lama
 * (`com.naelcapital.app`, proyek EAS lain) — terpasang berdampingan, tidak
 * pernah menimpa atau menerima pembaruan OTA milik karyawan.
 *
 * `APP_VARIANT` ikut menentukan sidik jari runtime (`runtimeVersion`
 * fingerprint): `eas update` wajib dijalankan dengan varian yang sama dengan
 * build-nya, kalau tidak update-nya tidak pernah masuk (skrip `update:preview`).
 *
 * Varian produksi belum ditentukan: nama paket & proyek EAS rilis diputuskan
 * saat aplikasi baru menggantikan aplikasi lama.
 */
const VARIAN = {
  development: { name: "Nael Dev", paket: "com.naelcapital.app.dev" },
  preview: { name: "Nael Uji", paket: "com.naelcapital.app.preview" },
} as const;

export default ({ config }: ConfigContext): ExpoConfig => {
  const varian = process.env.APP_VARIANT;
  if (varian !== "development" && varian !== "preview") return config as ExpoConfig;
  const { name, paket } = VARIAN[varian];

  // APK preview dipakai tanpa laptop: alamat API wajib dari variabel EAS
  // lingkungan `preview`. Tanpa itu `.env` lokal (IP laptop) ikut terbundel
  // diam-diam saat `eas update` dijalankan dari laptop.
  const alamatApi = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (varian === "preview" && !alamatApi.startsWith("https://")) {
    throw new Error(
      `Varian preview butuh EXPO_PUBLIC_API_URL https:// dari variabel EAS lingkungan "preview" (sekarang: "${alamatApi}").`,
    );
  }

  return {
    ...config,
    name,
    slug: config.slug ?? "new-naelcapital",
    android: { ...config.android, package: paket },
    ios: { ...config.ios, bundleIdentifier: paket },
  };
};
