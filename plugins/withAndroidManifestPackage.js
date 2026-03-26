const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * React Native's Gradle autolinking (new architecture) expects
 * `project.android.packageName` to exist in `react-native config` output.
 *
 * In newer Expo Android templates, the generated AndroidManifest might omit
 * the `<manifest package="...">` attribute (it uses `namespace` + `applicationId`
 * instead). This plugin restores the manifest `package` attribute so the
 * autolinking step can determine the package name reliably in EAS builds.
 */
module.exports = function withAndroidManifestPackage(config) {
  const androidPackage =
    config?.android?.package ??
    // Some projects use a different key when migrating from older templates.
    config?.android?.packageName;

  if (!androidPackage) return config;

  return withAndroidManifest(config, (config) => {
    config.modResults.manifest.$ = config.modResults.manifest.$ || {};
    config.modResults.manifest.$.package = androidPackage;
    return config;
  });
};

