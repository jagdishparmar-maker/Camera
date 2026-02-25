/**
 * Notification utilities for in-app and push notifications.
 *
 * Push notifications require:
 * - Development build (npx expo prebuild && npx expo run:ios/android)
 * - expo-notifications plugin in app.json
 * - Push token stored in PocketBase for server to send
 */

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    console.warn("EXPO_PUBLIC_EAS_PROJECT_ID not set - push tokens may not work");
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  return tokenData?.data ?? null;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("vehicles", {
      name: "Vehicle Check-ins",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return getExpoPushToken();
}
