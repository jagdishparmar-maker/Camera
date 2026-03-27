import { useConnectivity } from "@/contexts/ConnectivityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, StyleSheet, Pressable } from "react-native";
import { Icon, Text } from "react-native-paper";

export function ConnectivityBanner() {
  const { status, retry } = useConnectivity();
  const insets = useSafeAreaInsets();

  if (status === "ok") return null;

  const isNoInternet = status === "no-internet";
  const message = isNoInternet
    ? "No internet connection. Check your network and try again."
    : "Database unreachable. Server may be offline or unavailable.";
  const icon = isNoInternet ? "wifi-off" : "cloud-off";

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
      <Icon source={icon} size={20} color="#FFFFFF" />
      <Text variant="bodyMedium" style={styles.text}>
        {message}
      </Text>
      <Pressable
        onPress={retry}
        style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
      >
        <Text variant="labelMedium" style={styles.retryText}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#B91C1C",
  },
  text: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  retryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
  },
  retryBtnPressed: {
    opacity: 0.8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
