const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Monorepo Bun (instalasi isolated) didukung bawaan `expo/metro-config` sejak SDK 54.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
