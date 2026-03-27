import AsyncStorage from "@react-native-async-storage/async-storage";
import PocketBase, { AsyncAuthStore } from "pocketbase";
import { POCKETBASE_URL } from "./config";

// Polyfill EventSource for React Native (required for realtime subscriptions)
// Must be set before PocketBase is instantiated
if (typeof global.EventSource === "undefined") {
  const EventSource = require("react-native-sse").default;
  (global as unknown as { EventSource: typeof EventSource }).EventSource =
    EventSource;
}

const store = new AsyncAuthStore({
  save: async (serialized) => AsyncStorage.setItem("pb_auth", serialized),
  initial: AsyncStorage.getItem("pb_auth"),
});

export const pb = new PocketBase(POCKETBASE_URL, store);
