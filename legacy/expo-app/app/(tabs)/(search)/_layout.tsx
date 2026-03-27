import { Stack } from "expo-router";

export default function SearchStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#2C2C2E" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#2C2C2E" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Dock" }} />
    </Stack>
  );
}
