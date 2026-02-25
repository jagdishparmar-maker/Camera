# Push Notifications Setup

This guide explains how to enable **push notifications** when a new vehicle is checked in, so users receive alerts even when the app is in the background or closed.

## What's Already Implemented

### 1. In-App Notifications (Foreground)
When the app is **open** and a new vehicle is checked in, a **Snackbar** appears at the bottom with:
- Message: "New vehicle checked in: [vehicleno]"
- "View" button to open the vehicle details

This works in **Expo Go** and requires no extra setup.

### 2. Push Notification Infrastructure
- `expo-notifications` and `expo-device` are installed
- `lib/notifications.ts` provides `registerForPushNotifications()` and `getExpoPushToken()`
- App is configured with the expo-notifications plugin

## Enabling Push Notifications (Background/Closed App)

Push notifications require a **development build** (Expo Go does not support push on Android from SDK 53+).

### Step 1: Create EAS Project (if not done)
```bash
npx eas login
npx eas build:configure
```
This creates `eas.json` and links your project. Note your **Project ID** from [expo.dev](https://expo.dev) → Your Project → Settings.

### Step 2: Add Project ID to Environment
Create or update `.env`:
```
EXPO_PUBLIC_EAS_PROJECT_ID=your-project-id-here
```

### Step 3: PocketBase – Store Push Tokens

Create a **push_tokens** collection in PocketBase Admin:

| Field | Type | Options |
|-------|------|---------|
| user | Relation | users (optional) |
| token | Text | required |
| device | Text | optional |

### Step 4: Register Token from App

Call `registerForPushNotifications()` when the user logs in (or on app launch) and save the token to PocketBase:

```ts
import { registerForPushNotifications } from "@/lib/notifications";
import { pb } from "@/lib/pocketbase";

// After login or on app start
const token = await registerForPushNotifications();
if (token && pb.authStore.model?.id) {
  await pb.collection("push_tokens").create({
    user: pb.authStore.model.id,
    token,
  });
}
```

### Step 5: PocketBase Hook – Send Push on Vehicle Create

In PocketBase Admin → Settings → Hooks, add a new hook:

**Event:** `onRecordAfterCreateRequest`  
**Collection:** `vehicles`  
**Trigger:** After create

**Script (JavaScript):**

```javascript
onRecordAfterCreateRequest((e) => {
  const record = e.record
  const vehicleno = record.get("vehicleno") || "—"
  const vehicleId = record.id

  // Fetch all push tokens
  const tokens = $app.dao().findRecordsByFilter(
    "push_tokens",
    "token != ''",
    "-created",
    0,
    500
  )

  if (tokens.length === 0) return

  const expoTokens = tokens.map(t => t.get("token")).filter(Boolean)
  if (expoTokens.length === 0) return

  const payload = {
    to: expoTokens,
    title: "New Vehicle Check-in",
    body: `Vehicle ${vehicleno} has been checked in`,
    data: { vehicleId, vehicleno }
  }

  $app.newRequest().url("https://exp.host/--/api/v2/push/send")
    .method("POST")
    .header("Content-Type", "application/json")
    .body(JSON.stringify(payload))
    .send()
})
```

*Note: PocketBase's JSVM may use different APIs. Check the [PocketBase JSVM docs](https://pocketbase.io/jsvm/) for the correct `$http` or fetch equivalent in your version.*

### Alternative: External Service

If PocketBase hooks don't support HTTP outbound easily, use an external service:

1. **Supabase Edge Function** or **Vercel/Netlify serverless** that:
   - Subscribes to PocketBase realtime (or is called via webhook)
   - Fetches push tokens from PocketBase
   - Calls Expo Push API

2. **PocketBase → Webhook**: Configure PocketBase to send a webhook on `vehicles` create to your endpoint.

### Step 6: Build and Test

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Test on a **physical device** (push does not work on simulators).
