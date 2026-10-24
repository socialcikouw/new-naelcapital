/**
 * NativeWind mengubah JSX menjadi `react-native-css-interop` supaya `className`
 * terbaca — HANYA untuk kode kita sendiri. Pustaka di `node_modules` tidak
 * pernah menerima `className` dari kita, dan bila JSX-nya ikut diubah, React
 * Native 0.88 memuat NativeWind (beserta Reanimated & Worklets) di tengah
 * `setup-env` lewat LogBox / VirtualizedList: Expo Go macet saat start dengan
 * `property is not writable` / `Global was not installed` (25 Okt 2026).
 */
const POLA_PUSTAKA = /[\\/]node_modules[\\/]/;
// Fungsi, bukan RegExp: Metro memuat config sekali tanpa nama file.
const pustaka = (berkas) => typeof berkas === "string" && POLA_PUSTAKA.test(berkas);

module.exports = (api) => {
  api.cache(true);
  return {
    overrides: [
      {
        exclude: pustaka,
        presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
      },
      { test: pustaka, presets: ["babel-preset-expo"] },
    ],
  };
};
