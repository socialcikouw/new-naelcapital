const { realpathSync } = require("node:fs");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * Konfigurasi bawaan Expo + satu penjaga: tolak bundling bila path terminal
 * berbeda huruf besar-kecil dari path di disk (`desktop` vs `Desktop`).
 * Windows menerima keduanya, tapi Metro mencatat berkas yang sama lewat dua
 * path sebagai dua modul — React Native & pustaka native termuat dua kali dan
 * Expo Go iOS crash saat dibuka (`Tried to register two views with the same
 * name RNCSafeAreaProvider`). Berlaku juga untuk `eas update` (bundling lokal).
 *
 * Bukan pembungkus di `scripts` package.json: skrip ikut sidik jari runtime,
 * mengubahnya memutus OTA ke APK yang sudah terpasang.
 */
const sekarang = process.cwd();
const asli = realpathSync.native(sekarang);
if (asli !== sekarang && asli.toLowerCase() === sekarang.toLowerCase()) {
  throw new Error(
    `Path terminal beda huruf besar-kecil dari path asli — bundel akan memuat modul dua kali (Expo Go iOS crash).\n  Sekarang: ${sekarang}\n  Jalankan: cd "${asli}"`,
  );
}

module.exports = getDefaultConfig(__dirname);
