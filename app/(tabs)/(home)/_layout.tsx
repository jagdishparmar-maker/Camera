import { Stack } from "expo-router";

const headerOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: "#2C2C2E" },
  headerTintColor: "#FFFFFF",
  headerTitleStyle: { fontWeight: "600", fontSize: 17 },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: "#2C2C2E" },
  animation: "slide_from_right" as const,
};

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: "New Vehicle",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="vehicle/[id]"
        options={({ route }) => ({
          title: (route.params as { vehicleno?: string })?.vehicleno ?? "Details",
          headerBackVisible: true,
        })}
      />
      <Stack.Screen
        name="vehicle/edit/[id]"
        options={{
          title: "Edit Vehicle",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="all"
        options={{
          title: "All Vehicles",
          headerBackVisible: true,
        }}
      />
    </Stack>
  );
}
