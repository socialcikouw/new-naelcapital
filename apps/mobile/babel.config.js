/**
 * NativeWind mengubah JSX menjadi `react-native-css-interop` supaya `className`
 * terbaca. Paket inti DIKECUALIKAN — sama dengan pengecualian plugin
 * css-interop sendiri (`allowedFileRegex`). Tanpa ini, React Native 0.88
 * memuat runtime NativeWind (dan seluruh `react-native/index.js`) di tengah
 * `setup-env` lewat JSX LogBox, sebelum devtools & penanganan galat siap:
 * Expo Go macet dengan `property is not writable` / `Global was not installed`.
 */
const POLA_INTI =
  /[\\/]node_modules[\\/](react|react-native|react-native-web|react-native-css-interop)[\\/]/;
// Fungsi, bukan RegExp: Metro memuat config sekali tanpa nama file.
const inti = (berkas) => typeof berkas === "string" && POLA_INTI.test(berkas);

module.exports = (api) => {
  api.cache(true);
  return {
    overrides: [
      {
        exclude: inti,
        presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
      },
      { test: inti, presets: ["babel-preset-expo"] },
    ],
  };
};
