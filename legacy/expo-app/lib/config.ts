/**
 * PocketBase configuration
 *
 * For local development:
 * - Emulator/Simulator: use http://10.0.2.2:8090 (Android) or http://localhost:8090 (iOS)
 * - Physical device: use your machine's local IP, e.g. http://192.168.1.100:8090
 *
 * For production: use your deployed PocketBase URL
 */
export const POCKETBASE_URL =
  process.env.EXPO_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
