# IntoShip GateMS (Expo)

Gate management app built with [Expo](https://expo.dev) (SDK 54), [Expo Router](https://docs.expo.dev/router/introduction/), and [PocketBase](https://pocketbase.io/).

## Prerequisites

- **Node.js** (LTS recommended)
- **npm**
- For device builds: [EAS CLI](https://docs.expo.dev/build/setup/) (`npm i -g eas-cli` or use `npx eas`)
- For local Android/iOS native runs: Android Studio / Xcode as in [Expo docs](https://docs.expo.dev/workflow/android-studio-emulator/)

## Install and run locally

```bash
npm install
```

### Environment

- Copy `.env.example` to `.env` and set **`EXPO_PUBLIC_POCKETBASE_URL`** (e.g. `http://127.0.0.1:8090` for local PocketBase).
- On a **physical device**, use your computer’s LAN IP instead of `localhost` / `127.0.0.1`.

### Start the dev server

```bash
npx expo start
```

From the dev menu you can open the app in:

- A [**development build**](https://docs.expo.dev/develop/development-builds/introduction/) (recommended when using native modules and `expo-dev-client`)
- An **Android emulator** or **iOS simulator**
- **Expo Go** (quick try; some features are limited vs a dev or production build)

### Web

```bash
npm run web
```

### Lint

```bash
npm run lint
```

## PocketBase backend

The app uses PocketBase for database access, realtime, file storage, and auth. See `lib/database.ts`, `lib/realtime.ts`, `lib/storage.ts`, and related hooks.

## EAS Build profiles (`eas.json`)

| Profile         | Use case                         | `developmentClient` | Channel        |
|----------------|-----------------------------------|---------------------|----------------|
| **development** | Dev client for daily development | yes                 | `development`  |
| **preview**     | Internal / QA APK/IPA            | no                  | `preview`      |
| **production**  | Store or internal release        | no                  | `production`   |

Log in once:

```bash
eas login
```

### Development build (custom dev client)

Installs a build of your app that includes **`expo-dev-client`** so you can load the Metro bundler from `expo start`. Use the **development** profile.

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

After install, start the project with `npx expo start` and open the dev build on device/simulator.

### Preview build (internal testing, no dev menu)

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

### Production build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

`production` uses **`autoIncrement`** for Android version code (see `eas.json`). Submit to stores when ready:

```bash
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

## Over-the-air updates (EAS Update)

The project is configured with **`expo-updates`**, a static **`runtimeVersion`** string in `app.json` (must stay in sync with native release expectations), and **update channels** that match EAS Build profiles. Production/preview/dev installs only receive updates published to **their** channel.

Publish a JS/asset update without a new store binary (when native code and **`runtimeVersion`** still match):

```bash
# Production channel (for builds created with --profile production)
npm run update:production -- --message "Describe this release"

# Preview channel
npm run update:preview -- --message "QA fix"
```

Equivalent:

```bash
eas update --channel production --message "Describe this release"
eas update --channel preview --message "QA fix"
```

Bump **`expo.version`** and **`runtimeVersion`** in `app.json` together when you ship a **new native** build that should receive a separate OTA line.

## Local native builds (optional)

### Quick run from the CLI

With an `android` / `ios` folder present (this repo includes **`android/`** for bare workflow):

```bash
npm run android
npm run ios
```

These run `expo run:android` and `expo run:ios` (build, install, and start Metro). If **`android/`** is missing, generate it with [`npx expo prebuild`](https://docs.expo.dev/workflow/prebuild/).

### Android Studio: build an APK locally

Use this when you want a **standalone `.apk`** without using EAS (e.g. sideloading to a device for testing).

1. **Prerequisites**  
   - [Android Studio](https://developer.android.com/studio) installed (SDK, platform tools).  
   - Project has an **`android/`** directory. If you removed it, run:  
     `npx expo prebuild --platform android`

2. **Open the Android project**  
   - Launch Android Studio → **Open** → choose the **`android`** folder inside this repo (`…/Camera/android`), not only the repo root.  
   - Wait for **Gradle sync** to finish; resolve any SDK/license prompts.

3. **Debug APK (unsigned / debug-signed, fast for testing)**  
   - Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.  
   - Or from a terminal in **`android/`**:  
     - Windows: `.\gradlew.bat assembleDebug`  
     - macOS/Linux: `./gradlew assembleDebug`  
   - Output: **`android/app/build/outputs/apk/debug/app-debug.apk`**  
   - Install on a device with USB debugging or `adb install -r` that path.

4. **Release APK (for distribution)**  
   - Configure **signing** (keystore) in Android Studio: **Build → Generate Signed App Bundle or APK**, or set up `signingConfigs` in `android/app/build.gradle` and run:  
     `.\gradlew.bat assembleRelease` (Windows) / `./gradlew assembleRelease`  
   - Output (when signing is configured): under **`android/app/build/outputs/apk/release/`** (exact name depends on your Gradle config).  
   - See [React Native: signed APK](https://reactnative.dev/docs/signed-apk-android) and [Expo: local app production](https://docs.expo.dev/guides/local-app-production/) for details.

5. **Notes**  
   - **Versioning**: `versionCode` / application id live under `android/`; align with `app.json` / Play Store expectations when you change native builds.  
   - **EAS vs local**: EAS Build is still recommended for **consistent, CI-friendly** production artifacts; Android Studio is ideal for **fast local APKs** and debugging native issues.

### iOS (Xcode)

Open **`ios/*.xcworkspace`** in Xcode if the `ios` folder exists; build and run from there. Generate `ios/` with `npx expo prebuild --platform ios` if needed.

## Project layout

- **`app/`** – Expo Router screens and layouts
- **`components/`** – Shared UI
- **`lib/`** – PocketBase, theme, utilities

## Reset starter (optional)

```bash
npm run reset-project
```

Moves sample code to **`app-example`** and creates a blank **`app`** directory.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Update](https://docs.expo.dev/eas-update/introduction/)
- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
