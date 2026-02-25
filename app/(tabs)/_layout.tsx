import { CommonActions } from "@react-navigation/native";
import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";
import { BottomNavigation, Icon } from "react-native-paper";

function MaterialTabBar({
  navigation,
  state,
  descriptors,
  insets,
}: {
  navigation: import("@react-navigation/native").NavigationProp<import("@react-navigation/native").ParamListBase>;
  state: { key?: string; index: number; routes: Array<{ key: string; name: string; params?: object }> };
  descriptors: Record<string, import("@react-navigation/bottom-tabs").BottomTabDescriptor>;
  insets: { top: number; right: number; bottom: number; left: number };
}) {
  const theme = useTheme();

  return (
    <BottomNavigation.Bar
      navigationState={state}
      safeAreaInsets={insets}
      onTabPress={({ route, preventDefault }) => {
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (event.defaultPrevented) {
          preventDefault();
        } else {
          navigation.dispatch({
            ...CommonActions.navigate(route.name, route.params),
            target: state.key,
          });
        }
      }}
      renderIcon={({ route, focused, color }) => {
        const { options } = descriptors[route.key] ?? {};
        return options?.tabBarIcon?.({ focused, color, size: 24 }) ?? (
          <Icon source="circle" size={24} color={color} />
        );
      }}
      getLabelText={({ route }) => {
        const { options } = descriptors[route.key] ?? {};
        const label =
          typeof options?.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options?.title === "string"
              ? options.title
              : route.name;
        return label ?? "";
      }}
      activeColor={theme.colors.primary}
      inactiveColor="#A0A0A0"
      shifting
      labeled
      style={{ backgroundColor: "#2C2C2E" }}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBar: (props) => <MaterialTabBar {...props} />,
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(search)"
        options={{
          title: "Dock",
          tabBarIcon: ({ color }) => (
            <Icon source="warehouse" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Icon
              source={focused ? "cog" : "cog-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
